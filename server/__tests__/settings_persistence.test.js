import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import bcrypt from 'bcryptjs';

describe('Phase 7 — User Settings & Profile Persistence in PostgreSQL', () => {
  let app;
  let userA;
  let userB;
  let userAPassword = 'UserAPassword123!@#';
  let userBPassword = 'UserBPassword123!@#';
  let cookieA = '';
  let cookieB = '';

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const uniqueSuffixA = Math.random().toString(36).substring(2, 8);
    const uniqueSuffixB = Math.random().toString(36).substring(2, 8);

    const hashA = await bcrypt.hash(userAPassword, 10);
    const hashB = await bcrypt.hash(userBPassword, 10);

    userA = await dbStore.createUser({
      email: `settings_user_a_${uniqueSuffixA}@example.com`,
      username: `settings_a_${uniqueSuffixA}`,
      name: 'User Settings Alpha',
      passwordHash: hashA,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });

    userB = await dbStore.createUser({
      email: `settings_user_b_${uniqueSuffixB}@example.com`,
      username: `settings_b_${uniqueSuffixB}`,
      name: 'User Settings Beta',
      passwordHash: hashB,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });

    // Login User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: userA.email, password: userAPassword },
    });
    assert.equal(resA.statusCode, 200);
    cookieA = resA.headers['set-cookie'].split(';')[0];

    // Login User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: userB.email, password: userBPassword },
    });
    assert.equal(resB.statusCode, 200);
    cookieB = resB.headers['set-cookie'].split(';')[0];
  });

  after(async () => {
    if (userA?.id) {
      await dbStore.deleteUser(userA.id).catch(() => {});
    }
    if (userB?.id) {
      await dbStore.deleteUser(userB.id).catch(() => {});
    }
    await app.close();
  });

  it('1. Unauthenticated requests to /api/settings are rejected with 401', async () => {
    const endpoints = [
      { method: 'GET', url: '/api/settings' },
      { method: 'PATCH', url: '/api/settings', payload: { defaultDuration: 45 } },
      { method: 'PUT', url: '/api/settings', payload: { defaultDuration: 45 } },
      { method: 'POST', url: '/api/settings/reset' },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
        payload: ep.payload,
      });
      assert.equal(res.statusCode, 401, `Expected 401 for unauthenticated ${ep.method} ${ep.url}`);
      const body = res.json();
      assert.equal(body.error, 'Unauthorized');
    }
  });

  it('2. Authenticated user receives default settings on first access', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.settings, 'Expected settings object in response');
    assert.equal(body.settings.defaultDuration, 25);
    assert.equal(body.settings.autoResumePause, true);
    assert.equal(body.settings.confirmBeforePause, true);
    assert.equal(body.settings.confirmBeforeEnd, false);
    assert.equal(body.settings.defaultCamera, true);
    assert.equal(body.settings.defaultScreen, true);
    assert.equal(body.settings.defaultCategory, 'ALL');
    assert.equal(body.settings.showFocusScore, true);
    assert.equal(body.settings.showFocusPoints, true);
    assert.equal(body.settings.showFocusStreak, true);
    assert.equal(body.settings.autoResumeWarning, true);
    assert.equal(body.settings.theme, 'dark');
  });

  it('3. User A can update settings and changes persist across GET requests', async () => {
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: {
        defaultDuration: 45,
        defaultCategory: 'Coding',
        confirmBeforeEnd: true,
        showFocusPoints: false,
      },
    });

    assert.equal(patchRes.statusCode, 200);
    const patchBody = patchRes.json();
    assert.equal(patchBody.success, true);
    assert.equal(patchBody.settings.defaultDuration, 45);
    assert.equal(patchBody.settings.defaultCategory, 'Coding');
    assert.equal(patchBody.settings.confirmBeforeEnd, true);
    assert.equal(patchBody.settings.showFocusPoints, false);
    // Unmodified settings should retain their values
    assert.equal(patchBody.settings.autoResumePause, true);
    assert.equal(patchBody.settings.defaultCamera, true);

    // Verify subsequent GET returns persisted settings
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: cookieA },
    });
    assert.equal(getRes.statusCode, 200);
    const getBody = getRes.json();
    assert.equal(getBody.settings.defaultDuration, 45);
    assert.equal(getBody.settings.defaultCategory, 'Coding');
    assert.equal(getBody.settings.confirmBeforeEnd, true);
    assert.equal(getBody.settings.showFocusPoints, false);
  });

  it('4. Strict schema validation rejects invalid inputs and unknown fields with 400', async () => {
    // Unknown field
    const unknownFieldRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: {
        defaultDuration: 30,
        unrecognizedSetting: 'malicious',
      },
    });
    assert.equal(unknownFieldRes.statusCode, 400);
    assert.match(unknownFieldRes.json().message, /unrecognized key/i);

    // Invalid duration (negative or out of bounds)
    const invalidDurationRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: { defaultDuration: -10 },
    });
    assert.equal(invalidDurationRes.statusCode, 400);

    // Invalid theme value
    const invalidThemeRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: { theme: 'neon_pink' },
    });
    assert.equal(invalidThemeRes.statusCode, 400);

    // Invalid type for boolean
    const invalidTypeRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: { autoResumePause: 'not_a_boolean' },
    });
    assert.equal(invalidTypeRes.statusCode, 400);
  });

  it('5. Cross-user isolation: User B settings are isolated from User A (zero leakage)', async () => {
    // User B fetches settings -> must receive defaults, NOT User A's updated settings
    const resB = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: cookieB },
    });
    assert.equal(resB.statusCode, 200);
    const bodyB = resB.json();
    assert.equal(bodyB.settings.defaultDuration, 25, "User B must not see User A's duration (45)");
    assert.equal(bodyB.settings.defaultCategory, 'ALL', "User B must not see User A's category ('Coding')");
    assert.equal(bodyB.settings.confirmBeforeEnd, false, "User B must not see User A's confirmBeforeEnd (true)");
    assert.equal(bodyB.settings.showFocusPoints, true, "User B must not see User A's showFocusPoints (false)");

    // User B updates their own settings
    const updateB = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieB },
      payload: {
        defaultDuration: 60,
        defaultCategory: 'Study',
      },
    });
    assert.equal(updateB.statusCode, 200);
    assert.equal(updateB.json().settings.defaultDuration, 60);
    assert.equal(updateB.json().settings.defaultCategory, 'Study');

    // Verify User A still has their distinct settings
    const verifyA = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: cookieA },
    });
    assert.equal(verifyA.statusCode, 200);
    assert.equal(verifyA.json().settings.defaultDuration, 45, "User A settings must remain intact");
    assert.equal(verifyA.json().settings.defaultCategory, 'Coding', "User A settings must remain intact");
  });

  it('6. Reset to defaults restores default settings without affecting other users', async () => {
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/settings/reset',
      headers: { cookie: cookieA },
    });
    assert.equal(resetRes.statusCode, 200);
    const resetBody = resetRes.json();
    assert.equal(resetBody.success, true);
    assert.equal(resetBody.settings.defaultDuration, 25);
    assert.equal(resetBody.settings.defaultCategory, 'ALL');
    assert.equal(resetBody.settings.confirmBeforeEnd, false);
    assert.equal(resetBody.settings.showFocusPoints, true);

    // Verify User B's settings remain untouched (duration: 60, category: Study)
    const verifyB = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: cookieB },
    });
    assert.equal(verifyB.statusCode, 200);
    assert.equal(verifyB.json().settings.defaultDuration, 60);
    assert.equal(verifyB.json().settings.defaultCategory, 'Study');
  });

  it('7. Settings survive logout and subsequent re-login', async () => {
    // User B logs out
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieB },
    });
    assert.equal(logoutRes.statusCode, 200);

    // User B logs back in
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: userB.email, password: userBPassword },
    });
    assert.equal(loginRes.statusCode, 200);
    const newCookieB = loginRes.headers['set-cookie'].split(';')[0];

    // User B fetches settings with new session
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { cookie: newCookieB },
    });
    assert.equal(getRes.statusCode, 200);
    const settings = getRes.json().settings;
    assert.equal(settings.defaultDuration, 60, 'Settings must survive re-login');
    assert.equal(settings.defaultCategory, 'Study', 'Settings must survive re-login');
  });

  it('8. Profile update and unique username constraints work correctly', async () => {
    // User A updates profile
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: cookieA },
      payload: {
        name: 'Alpha Renovated',
      },
    });
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.json().user.name, 'Alpha Renovated');

    // GET /api/profile alias returns profile data
    const getProfileRes = await app.inject({
      method: 'GET',
      url: '/api/profile',
      headers: { cookie: cookieA },
    });
    assert.equal(getProfileRes.statusCode, 200);
    assert.equal(getProfileRes.json().user.name, 'Alpha Renovated');

    // Duplicate username rejection across users
    const duplicateRes = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: cookieA },
      payload: {
        username: userB.username, // Try taking User B's username
      },
    });
    assert.equal(duplicateRes.statusCode, 400);
    assert.match(duplicateRes.json().message, /already taken/i);
  });
});
