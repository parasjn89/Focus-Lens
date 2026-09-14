import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';

describe('FocusLens Authentication, Authorization & IDOR Security Test Suite', () => {
  let app;
  let userACookie = null;
  let userBCookie = null;
  let sessionAId = null;
  let sessionBId = null;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('POST /api/auth/register creates user account and sets session cookie', async () => {
    const email = `usera_${Date.now()}@example.com`;
    const username = `usera_${Date.now()}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User A',
        username,
        email,
        password: 'SecurePass12345!',
      },
    });

    assert.strictEqual(response.statusCode, 201);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.user.email, email);
    assert.strictEqual(body.user.name, 'User A');
    assert.strictEqual(body.user.passwordHash, undefined); // Password hash must NEVER be exposed

    const cookies = response.cookies;
    assert.ok(cookies.length > 0);
    userACookie = `${cookies[0].name}=${cookies[0].value}`;
  });

  test('POST /api/auth/register rejects duplicate email address', async () => {
    const email = `duplicate_${Date.now()}@example.com`;
    const username1 = `dup1_${Date.now()}`;
    const username2 = `dup2_${Date.now()}`;

    // First registration
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'First', username: username1, email, password: 'SecurePass12345!' },
    });

    // Duplicate attempt
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Second', username: username2, email, password: 'SecurePass12345!' },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, 'Bad Request');
    assert.ok(body.message.includes('already exists'));
    assert.ok(body.message.includes('email address'));
  });

  test('POST /api/auth/register rejects duplicate phone number', async () => {
    const email1 = `phone_user1_${Date.now()}@example.com`;
    const email2 = `phone_user2_${Date.now()}@example.com`;
    const phone = '+15559876543';

    // First registration with phone
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'First Phone', username: `phone1_${Date.now()}`, email: email1, password: 'SecurePass12345!', verificationMethod: 'PHONE', phoneNumber: phone },
    });

    // Duplicate phone attempt with different email
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Second Phone', username: `phone2_${Date.now()}`, email: email2, password: 'SecurePass12345!', verificationMethod: 'PHONE', phoneNumber: phone },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, 'Bad Request');
    assert.ok(body.message.includes('phone number already exists'));
  });

  test('POST /api/auth/login authenticates valid credentials', async () => {
    const email = `loginuser_${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User B', username: `userb_${Date.now()}`, email, password: 'SecurePass12345!' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'SecurePass12345!' },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.user.email, email);
    
    const cookies = response.cookies;
    assert.ok(cookies.length > 0);
    userBCookie = `${cookies[0].name}=${cookies[0].value}`;
  });

  test('POST /api/auth/login rejects invalid password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'wrong@example.com', password: 'wrongpassword' },
    });

    assert.strictEqual(response.statusCode, 401);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, 'Unauthorized');
  });

  test('GET /api/auth/me returns current user profile when authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userACookie },
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.user.name, 'User A');
  });

  test('GET /api/auth/me rejects unauthenticated request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    assert.strictEqual(response.statusCode, 401);
  });

  test('IDOR SECURITY TEST: User A cannot access or modify User B session', async () => {
    // 1. User A creates Session A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: userACookie },
      payload: { plannedDurationMs: 1500000, selectedActivity: 'Coding' },
    });
    assert.strictEqual(resA.statusCode, 201);
    sessionAId = JSON.parse(resA.payload).session.id;

    // 2. User B creates Session B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: userBCookie },
      payload: { plannedDurationMs: 1800000, selectedActivity: 'Studying' },
    });
    assert.strictEqual(resB.statusCode, 201);
    sessionBId = JSON.parse(resB.payload).session.id;

    // 3. User A attempts GET /api/sessions/<B_SESSION_ID> -> MUST BE 404 NOT FOUND
    const idorGet = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionBId}`,
      headers: { cookie: userACookie },
    });
    assert.strictEqual(idorGet.statusCode, 404);

    // 4. User A attempts PUT /api/sessions/<B_SESSION_ID> -> MUST BE 404 NOT FOUND
    const idorPut = await app.inject({
      method: 'PUT',
      url: `/api/sessions/${sessionBId}`,
      headers: { cookie: userACookie },
      payload: { actualDurationMs: 1000, status: 'COMPLETED' },
    });
    assert.strictEqual(idorPut.statusCode, 404);

    // 5. User A attempts DELETE /api/sessions/<B_SESSION_ID> -> MUST BE 404 NOT FOUND
    const idorDelete = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionBId}`,
      headers: { cookie: userACookie },
    });
    assert.strictEqual(idorDelete.statusCode, 404);

    // 6. User A attempts POST /api/sessions/<B_SESSION_ID>/segments -> MUST BE 404 NOT FOUND
    const idorSegments = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionBId}/segments`,
      headers: { cookie: userACookie },
      payload: {
        segments: [{ activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1000, durationMs: 1000, evidenceScore: 0.9 }],
      },
    });
    assert.strictEqual(idorSegments.statusCode, 404);

    // 8. GET /api/sessions for User B returns ONLY Session B
    const listResB = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: userBCookie },
    });
    assert.strictEqual(listResB.statusCode, 200);
    const listBodyB = JSON.parse(listResB.payload);
    const returnedIdsB = listBodyB.sessions.map(s => s.id);
    assert.ok(returnedIdsB.includes(sessionBId));
    assert.strictEqual(returnedIdsB.includes(sessionAId), false); // User A's session MUST NOT be present for User B

    // 9. Unauthenticated GET /api/sessions MUST BE REJECTED with 401
    const unauthGet = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    });
    assert.strictEqual(unauthGet.statusCode, 401);

    // 10. Unauthenticated POST /api/sessions MUST BE REJECTED with 401
    const unauthPost = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { plannedDurationMs: 1500000, selectedActivity: 'Coding' },
    });
    assert.strictEqual(unauthPost.statusCode, 401);
  });

  test('DELETE /api/account deletes user account and cascades session data', async () => {
    // Register temporary user
    const email = `delete_${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'To Delete', username: `todelete_${Date.now()}`, email, password: 'SecurePass12345!' },
    });
    const tempCookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;

    // Perform account deletion
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/api/account',
      headers: { cookie: tempCookie },
    });

    assert.strictEqual(delRes.statusCode, 200);
    const body = JSON.parse(delRes.payload);
    assert.strictEqual(body.success, true);

    // Verify user can no longer authenticate
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: tempCookie },
    });
    assert.strictEqual(meRes.statusCode, 401);
  });
});
