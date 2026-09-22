import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { pool } from '../db/client.js';
import { setMockVerifier, resetMockVerifier } from '../services/firebaseAuth.js';

describe('FocusLens Firebase Phone OTP Authentication Suite', () => {
  let app;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    resetMockVerifier();
    await app.close();
    await pool.end();
  });

  beforeEach(() => {
    resetMockVerifier();
  });

  const uniqueId = () => Math.random().toString(36).substring(2, 9);
  const generateIndiaPhone = () => {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    return `+91${randomDigits}`;
  };

  it('1. Missing Firebase ID token returns 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {},
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Validation Error');
  });

  it('2. Invalid or expired Firebase ID token returns 401 Unauthorized', async () => {
    setMockVerifier(async (token) => {
      const err = new Error('Firebase authentication token has expired. Please sign in again.');
      err.statusCode = 401;
      err.code = 'TOKEN_EXPIRED';
      throw err;
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: { idToken: 'expired-or-invalid-token' },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Unauthorized');
    assert.match(body.message, /expired/i);
  });

  it('3. Firebase token missing phone_number claim returns 400 Bad Request', async () => {
    setMockVerifier(async (token) => {
      return {
        uid: 'firebase_test_user_no_phone',
        email: 'test@example.com',
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: { idToken: 'valid-token-no-phone' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Bad Request');
    assert.match(body.message, /does not contain a verified phone number/i);
  });

  it('4. Phone login with unregistered phone number returns 404 Not Found', async () => {
    const nonExistentPhone = generateIndiaPhone();

    setMockVerifier(async (token) => {
      return {
        uid: `firebase_uid_${uniqueId()}`,
        phone_number: nonExistentPhone,
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: { idToken: 'unregistered-phone-token' },
    });

    assert.equal(res.statusCode, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.error, 'Not Found');
    assert.match(body.message, /no focuslens account found/i);
  });

  it('5. Phone registration with valid Firebase token provisions a new user, marks phone verified, and sets session cookie', async () => {
    const verifiedPhone = generateIndiaPhone();
    const username = `phoneuser_${uniqueId()}`;
    const name = 'Phone Verified User';
    const email = `phone_${uniqueId()}@example.com`;

    setMockVerifier(async (token) => {
      return {
        uid: `firebase_uid_${uniqueId()}`,
        phone_number: verifiedPhone,
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'valid-token-reg-1',
        username,
        name,
        email,
        password: 'ValidSecurePassword123!@#',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.user);
    assert.equal(body.user.username, username);
    assert.equal(body.user.phoneNumber, verifiedPhone);
    assert.equal(body.user.verificationStatus, 'VERIFIED');
    assert.ok(body.user.phoneVerifiedAt);

    // Verify session cookie was set
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Should set session cookie');

    // Verify session works with /api/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookies },
    });
    assert.equal(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.equal(meBody.user.id, body.user.id);
  });

  it('6. Phone registration rejects duplicate phone number with 409 Conflict', async () => {
    const verifiedPhone = generateIndiaPhone();
    const username1 = `puser1_${uniqueId()}`;
    const username2 = `puser2_${uniqueId()}`;

    setMockVerifier(async (token) => {
      return {
        uid: `firebase_uid_${uniqueId()}`,
        phone_number: verifiedPhone,
      };
    });

    // First user creates account with phone
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-reg-dup-1',
        username: username1,
        name: 'First User',
        password: 'ValidPassword123!@#',
      },
    });
    assert.equal(res1.statusCode, 201);

    // Second user attempts to register with same phone
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-reg-dup-2',
        username: username2,
        name: 'Second User',
        password: 'ValidPassword123!@#',
      },
    });
    assert.equal(res2.statusCode, 409);
    const body = JSON.parse(res2.body);
    assert.equal(body.error, 'Conflict');
    assert.match(body.message, /already exists/i);
  });

  it('7. Phone registration rejects duplicate username with 409 Conflict', async () => {
    const verifiedPhone1 = generateIndiaPhone();
    const verifiedPhone2 = generateIndiaPhone();
    const duplicateUsername = `sameuser_${uniqueId()}`;

    // First user registers
    setMockVerifier(async () => ({
      uid: `firebase_uid_${uniqueId()}`,
      phone_number: verifiedPhone1,
    }));

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-uname-1',
        username: duplicateUsername,
        name: 'User One',
        password: 'ValidPassword123!@#',
      },
    });
    assert.equal(res1.statusCode, 201);

    // Second user with different phone attempts duplicate username
    setMockVerifier(async () => ({
      uid: `firebase_uid_${uniqueId()}`,
      phone_number: verifiedPhone2,
    }));

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-uname-2',
        username: duplicateUsername,
        name: 'User Two',
        password: 'ValidPassword123!@#',
      },
    });
    assert.equal(res2.statusCode, 409);
    const body = JSON.parse(res2.body);
    assert.equal(body.error, 'Conflict');
    assert.match(body.message, /username is already taken/i);
  });

  it('8. Phone login with valid Firebase token signs into existing account and establishes session', async () => {
    const verifiedPhone = generateIndiaPhone();
    const username = `login_puser_${uniqueId()}`;

    // Setup: create user with verified phone
    setMockVerifier(async () => ({
      uid: `firebase_uid_${uniqueId()}`,
      phone_number: verifiedPhone,
    }));

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-reg-login',
        username,
        name: 'Login Test User',
        password: 'ValidPassword123!@#',
      },
    });
    assert.equal(regRes.statusCode, 201);
    const registeredUser = JSON.parse(regRes.body).user;

    // Now perform phone login (no username/password payload, just idToken)
    setMockVerifier(async () => ({
      uid: `firebase_uid_${uniqueId()}`,
      phone_number: verifiedPhone,
    }));

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/firebase-phone',
      payload: {
        idToken: 'token-login-pure',
      },
    });

    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.user.id, registeredUser.id);
    assert.equal(loginBody.user.phoneNumber, verifiedPhone);
    assert.match(loginBody.message, /logged in successfully/i);

    // Verify session cookie allows accessing /api/auth/me
    const loginCookies = loginRes.headers['set-cookie'];
    assert.ok(loginCookies);
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: loginCookies },
    });
    assert.equal(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.equal(meBody.user.id, registeredUser.id);
  });

  it('9. Existing standard email/password authentication remains fully operational', async () => {
    const email = `std_auth_${uniqueId()}@example.com`;
    const username = `std_user_${uniqueId()}`;
    const password = 'StrongPassword123!@#';

    // Register via traditional POST /api/auth/register
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Standard User',
        email,
        password,
        preferredVerificationMethod: 'EMAIL',
      },
    });
    assert.equal(regRes.statusCode, 201);

    // Login via traditional POST /api/auth/login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.user.username, username);
  });
});
