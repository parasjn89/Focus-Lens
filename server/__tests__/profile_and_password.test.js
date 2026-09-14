import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';

describe('FocusLens Account Settings & Password Security Test Suite', () => {
  let app;
  let userACookie = null;
  let userBCookie = null;
  let userAEmail = null;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Register User A (with valid 12+ char password)
    userAEmail = `profile_usera_${Date.now()}@example.com`;
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Initial User A',
        username: `profilea_${Date.now()}`,
        email: userAEmail,
        password: 'Password12345!',
      },
    });
    assert.strictEqual(regA.statusCode, 201);
    userACookie = `${regA.cookies[0].name}=${regA.cookies[0].value}`;

    // Register User B
    const userBEmail = `profile_userb_${Date.now()}@example.com`;
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User B',
        username: `profileb_${Date.now()}`,
        email: userBEmail,
        password: 'Password67890!',
      },
    });
    assert.strictEqual(regB.statusCode, 201);
    userBCookie = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
  });

  after(async () => {
    await app.close();
  });

  test('1. Authenticated user can update their own profile name', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: userACookie },
      payload: { name: 'Updated User A Name' },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.user.name, 'Updated User A Name');
    assert.strictEqual(body.user.email, userAEmail);
    assert.strictEqual(body.user.passwordHash, undefined); // Password hash NEVER exposed
  });

  test('2. Unauthenticated request to PUT /api/auth/profile is rejected (HTTP 401)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      payload: { name: 'Hacker Name' },
    });

    assert.strictEqual(res.statusCode, 401);
  });

  test('3. User A cannot modify User B profile (server derives user strictly from session)', async () => {
    // User A updates profile -> affects User A, User B profile remains intact
    await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: userACookie },
      payload: { name: 'User A Modified' },
    });

    const meB = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: userBCookie },
    });
    assert.strictEqual(JSON.parse(meB.payload).user.name, 'User B');
  });

  test('4. Profile name validation rejects blank or short names', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: userACookie },
      payload: { name: 'A' },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.error, 'Validation Error');
  });

  test('5. 11-character password is rejected by policy (HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: 'shortpass11', // 11 chars
        confirmPassword: 'shortpass11',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('at least 12 characters'));
  });

  test('6. Obviously weak/common password is rejected (HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: '123456789012',
        confirmPassword: '123456789012',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('too common or easily guessable'));
  });

  test('7. Password containing personal details (name) is rejected (HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: 'MyNameIsUserAModifiedNow',
        confirmPassword: 'MyNameIsUserAModifiedNow',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('personal details'));
  });

  test('8. Password reuse (new === current) is rejected (HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: 'Password12345!',
        confirmPassword: 'Password12345!',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('same as your current password'));
  });

  test('9. Password change rejects incorrect current password (HTTP 401)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewValidPassword123!',
        confirmPassword: 'NewValidPassword123!',
      },
    });

    assert.strictEqual(res.statusCode, 401);
  });

  test('10. Mismatched confirmPassword is rejected (HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: 'NewValidPassword123!',
        confirmPassword: 'DifferentPassword123!',
      },
    });

    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('do not match'));
  });

  test('11. Successful password change works with long passphrase (HTTP 200)', async () => {
    const newPassphrase = 'correct-horse-battery-staple-passphrase';

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie: userACookie },
      payload: {
        currentPassword: 'Password12345!',
        newPassword: newPassphrase,
        confirmPassword: newPassphrase,
      },
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);

    // Old password MUST NO LONGER WORK
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: userAEmail, password: 'Password12345!' },
    });
    assert.strictEqual(oldLogin.statusCode, 401);

    // New passphrase MUST WORK FOR LOGIN
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: userAEmail, password: newPassphrase },
    });
    assert.strictEqual(newLogin.statusCode, 200);
  });
});
