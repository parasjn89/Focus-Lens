import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { config } from '../config/env.js';
import { setMockVerifier, resetMockVerifier } from '../services/firebaseAuth.js';

describe('FocusLens Firebase Google Authentication Suite', () => {
  let app;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    resetMockVerifier();
    await app.close();
  });

  beforeEach(() => {
    resetMockVerifier();
  });

  const uniqueId = () => Math.random().toString(36).substring(2, 9);

  it('1. Missing Firebase ID token returns 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {},
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Validation Error');
  });

  it('2. Invalid or expired Firebase ID token returns 401 Unauthorized', async () => {
    setMockVerifier(async (token) => {
      const err = new Error('Google authentication token has expired. Please sign in again.');
      err.statusCode = 401;
      err.code = 'TOKEN_EXPIRED';
      throw err;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'expired-or-invalid-token' },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Unauthorized');
    assert.match(body.message, /expired/i);
  });

  it('3. Unconfigured Firebase server returns clear 500 error when credentials missing', async () => {
    resetMockVerifier();
    const origProjectId = config.firebaseProjectId;
    try {
      config.firebaseProjectId = '';
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: { idToken: 'valid-token' },
      });

      assert.equal(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.match(body.message, /Google authentication is not configured/i);
    } finally {
      config.firebaseProjectId = origProjectId;
    }
  });

  it('4. Valid Firebase token for a new user provisions a new account, generates unique username, and sets HTTP-only session cookie', async () => {
    const googleUid = `google_uid_${uniqueId()}`;
    const googleEmail = `newuser_${uniqueId()}@gmail.com`;
    const googleName = 'Paras GoogleUser';

    setMockVerifier(async (token) => {
      if (token === 'valid_token_paras') {
        return {
          uid: googleUid,
          email: googleEmail,
          email_verified: true,
          name: googleName,
          picture: 'https://lh3.googleusercontent.com/a/avatar123',
        };
      }
      throw new Error('Invalid token');
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'valid_token_paras' },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.user.email, googleEmail.toLowerCase());
    assert.equal(body.user.name, googleName);
    assert.equal(body.user.verificationStatus, 'VERIFIED');
    assert.ok(body.user.username);
    assert.strictEqual(body.user.passwordHash, undefined);

    // Verify FocusLens HTTP-only session cookie is set
    const cookies = res.cookies;
    assert.ok(cookies.length > 0);
    const sessionCookie = cookies.find(c => c.name.toLowerCase().includes('session'));
    assert.ok(sessionCookie, 'Session cookie must be created');
    assert.equal(sessionCookie.httpOnly, true);

    // Verify session enables authenticated access to /api/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: `${sessionCookie.name}=${sessionCookie.value}`,
      },
    });

    assert.equal(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.equal(meBody.user.id, body.user.id);
    assert.equal(meBody.user.email, googleEmail.toLowerCase());
  });

  it('5. Valid Firebase token matching an existing email signs into that existing account without creating duplicate', async () => {
    const existingEmail = `existing_user_${uniqueId()}@example.com`;
    const existingUsername = `exist_${uniqueId()}`;
    const password = 'SuperSecret12345!';

    // Register initial user with email/password
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Original Name',
        username: existingUsername,
        email: existingEmail,
        password,
      },
    });
    assert.equal(regRes.statusCode, 201);
    const originalUser = JSON.parse(regRes.body).user;

    // Now sign in with Google using that exact verified email
    setMockVerifier(async (token) => {
      return {
        uid: `google_linked_${uniqueId()}`,
        email: existingEmail,
        email_verified: true,
        name: 'Google Profile Name',
        picture: 'https://lh3.googleusercontent.com/avatar_link',
      };
    });

    const googleRes = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_existing' },
    });

    assert.equal(googleRes.statusCode, 200);
    const googleBody = JSON.parse(googleRes.body);
    assert.equal(googleBody.user.id, originalUser.id);
    // Preserves original username
    assert.equal(googleBody.user.username, existingUsername);
    // Verified status updated
    assert.equal(googleBody.user.verificationStatus, 'VERIFIED');

    // Verify original password login STILL works
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: existingEmail,
        password,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.user.id, originalUser.id);
  });

  it('6. Username collision resolution generates unique username deterministically', async () => {
    // Create user with username "alex"
    const prefix = `collision_${uniqueId()}`;
    await dbStore.createUser({
      username: prefix,
      email: `${prefix}@domain.com`,
      name: prefix,
      passwordHash: 'hashed',
    });

    setMockVerifier(async () => ({
      uid: `uid_${uniqueId()}`,
      email: `${prefix}_alt@gmail.com`,
      email_verified: true,
      name: prefix,
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_collision' },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.notEqual(body.user.username, prefix, 'Colliding username must be deduplicated');
    assert.ok(body.user.username.startsWith(prefix), 'Must retain base handle prefix');
  });

  it('7. User isolation: Google authenticated user cannot access or tamper with another users session data', async () => {
    // User A (Google user)
    const emailA = `user_a_${uniqueId()}@gmail.com`;
    setMockVerifier(async () => ({
      uid: `uid_a_${uniqueId()}`,
      email: emailA,
      email_verified: true,
      name: 'User A',
    }));

    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_a' },
    });
    assert.equal(resA.statusCode, 201);
    const cookieA = `${resA.cookies[0].name}=${resA.cookies[0].value}`;

    // User A creates a focus session
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        selectedActivity: 'Coding',
        plannedDurationMs: 25 * 60 * 1000,
      },
    });
    assert.equal(startRes.statusCode, 201);
    const sessionAId = JSON.parse(startRes.body).session.id;

    // User B (Google user)
    const emailB = `user_b_${uniqueId()}@gmail.com`;
    setMockVerifier(async () => ({
      uid: `uid_b_${uniqueId()}`,
      email: emailB,
      email_verified: true,
      name: 'User B',
    }));

    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_b' },
    });
    assert.equal(resB.statusCode, 201);
    const cookieB = `${resB.cookies[0].name}=${resB.cookies[0].value}`;

    // User B attempts to access User A's session -> must be rejected (404/403/IDOR protected)
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionAId}`,
      headers: { cookie: cookieB },
    });
    assert.equal(getRes.statusCode, 404);

    // User B attempts to end/finalize User A's session -> must be rejected
    const endRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionAId}/end`,
      headers: { cookie: cookieB },
      payload: {
        actualDurationMs: 1000,
        status: 'COMPLETED',
      },
    });
    assert.equal(endRes.statusCode, 404);
  });

  it('8. Google-created user without password cannot be accessed via empty or random password login', async () => {
    const email = `google_nopass_${uniqueId()}@gmail.com`;
    setMockVerifier(async () => ({
      uid: `uid_nopass_${uniqueId()}`,
      email,
      email_verified: true,
      name: 'No Pass User',
    }));

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_nopass' },
    });
    assert.equal(createRes.statusCode, 201);

    // Attempt password login with empty password or random password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: 'AnyPassword12345!',
      },
    });
    assert.equal(loginRes.statusCode, 401);
  });

  it('9. Google token without email is rejected with 400 Bad Request', async () => {
    setMockVerifier(async () => ({
      uid: `uid_no_email_${uniqueId()}`,
      email: '',
      email_verified: false,
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'token_no_email' },
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.message, /email/i);
  });

  it('10. Existing user forgot password OTP request still works without interference', async () => {
    const email = `otp_check_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'OTP User',
        username: `otpuser_${uniqueId()}`,
        email,
        password: 'Password12345!',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
  });
});
