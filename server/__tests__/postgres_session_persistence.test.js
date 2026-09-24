import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import bcrypt from 'bcryptjs';

describe('Phase 4 — Persistent Session Architecture & Security Regressions', () => {
  let app;
  let userA;
  let userB;
  let userAPassword = 'UserAPassword123!@#';
  let userBPassword = 'UserBPassword123!@#';

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Create User A and User B
    const uniqueSuffixA = Math.random().toString(36).substring(2, 8);
    const uniqueSuffixB = Math.random().toString(36).substring(2, 8);

    const hashA = await bcrypt.hash(userAPassword, 10);
    const hashB = await bcrypt.hash(userBPassword, 10);

    userA = await dbStore.createUser({
      email: `usera_${uniqueSuffixA}@example.com`,
      username: `usera_${uniqueSuffixA}`,
      name: 'User Alpha',
      passwordHash: hashA,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });

    userB = await dbStore.createUser({
      email: `userb_${uniqueSuffixB}@example.com`,
      username: `userb_${uniqueSuffixB}`,
      name: 'User Beta',
      passwordHash: hashB,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });
  });

  after(async () => {
    await app.close();
  });

  let userACookie = '';

  it('A. User A login -> establishes persistent session and returns HTTP 200 with Set-Cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: userA.email,
        password: userAPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.user.id, userA.id);

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Expected Set-Cookie header to be set');
    assert.match(setCookie, /focuslens_session=/);
    assert.match(setCookie.toLowerCase(), /httponly/);

    userACookie = setCookie.split(';')[0];
  });

  it('B. Refresh / new sequential requests -> remains authenticated with valid user session', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: userACookie,
        },
      });

      assert.equal(res.statusCode, 200, `Request ${i} should return HTTP 200`);
      const body = res.json();
      assert.equal(body.user.id, userA.id);
    }
  });

  it('C. User A cannot access User B resources (Strict User Isolation)', async () => {
    // User B creates a focus session
    const userBSession = await dbStore.createSession({
      userId: userB.id,
      selectedActivity: 'Deep Work',
      plannedDurationMs: 1500000,
    });

    // User A attempts to access User B's session
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${userBSession.id}`,
      headers: {
        cookie: userACookie,
      },
    });

    // Cross-user IDOR protection: returns 404 (not found for this user)
    assert.equal(res.statusCode, 404, 'User A should receive 404 for User B resource');
  });

  it('D. Logout -> invalidates session and authenticated requests fail', async () => {
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: userACookie,
      },
    });

    assert.equal(logoutRes.statusCode, 200);
    const body = logoutRes.json();
    assert.equal(body.success, true);

    // Subsequent request with the previous cookie MUST fail with 401
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: userACookie,
      },
    });

    assert.equal(meRes.statusCode, 401, 'Post-logout request must be rejected with HTTP 401');
  });

  it('E. Invalid or tampered session cookie -> rejected with 401', async () => {
    const tamperedCookie = 'focuslens_session=s%3Ainvalid_session_id_with_tampered_signature.tampered';
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: tamperedCookie,
      },
    });

    assert.equal(res.statusCode, 401, 'Tampered cookie must return HTTP 401');
  });

  it('F. Existing cross-user 404 behavior remains intact across endpoints', async () => {
    // Re-login User A
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: userA.email,
        password: userAPassword,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const freshCookie = loginRes.headers['set-cookie'].split(';')[0];

    // Create a task for User B
    const userBTask = await dbStore.createTask({
      userId: userB.id,
      title: 'Secret Beta Task',
    });

    // User A attempts to update or delete User B's task
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${userBTask.id}`,
      headers: {
        cookie: freshCookie,
      },
      payload: {
        completed: true,
      },
    });

    assert.equal(updateRes.statusCode, 404, 'Cross-user task update should return 404');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${userBTask.id}`,
      headers: {
        cookie: freshCookie,
      },
    });

    assert.equal(deleteRes.statusCode, 404, 'Cross-user task delete should return 404');
  });
});
