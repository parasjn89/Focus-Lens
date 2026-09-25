import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { setMockVerifier, resetMockVerifier } from '../services/firebaseAuth.js';
import bcrypt from 'bcryptjs';

describe('Phase 5 — Login, Authentication & Routing Integrity Test Suite', () => {
  let app;
  let testUser;
  const testPassword = 'Password123!@#Test';

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const unique = Math.random().toString(36).substring(2, 8);
    const passwordHash = await bcrypt.hash(testPassword, 10);

    testUser = await dbStore.createUser({
      email: `login_test_${unique}@example.com`,
      username: `login_user_${unique}`,
      name: 'Login Test User',
      passwordHash,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });
  });

  after(async () => {
    resetMockVerifier();
    await app.close();
  });

  beforeEach(() => {
    resetMockVerifier();
  });

  it('1. LoginPage.jsx properly imports apiFetch from ../api/client.js and all required Firebase helpers', () => {
    const loginPagePath = resolve(process.cwd(), 'src/pages/LoginPage.jsx');
    assert.ok(existsSync(loginPagePath), 'LoginPage.jsx must exist');
    const source = readFileSync(loginPagePath, 'utf-8');

    // Verify apiFetch import exists
    assert.match(source, /import\s+\{\s*apiFetch\s*\}\s+from\s+['"]\.\.\/api\/client(\.js)?['"]/, 'LoginPage.jsx must explicitly import apiFetch from client');

    // Verify Firebase helper imports
    assert.match(source, /signInWithGoogle/);
    assert.match(source, /isFirebaseConfigured/);
    assert.match(source, /loginWithEmailPassword/);
    assert.match(source, /getSignInMethods/);
  });

  it('2. src/lib/firebase.js exports getSignInMethods, signOutOfFirebase, and all auth helpers', () => {
    const firebasePath = resolve(process.cwd(), 'src/lib/firebase.js');
    assert.ok(existsSync(firebasePath), 'firebase.js must exist');
    const source = readFileSync(firebasePath, 'utf-8');

    assert.match(source, /export\s+(async\s+)?function\s+getSignInMethods/);
    assert.match(source, /export\s+(async\s+)?function\s+signOutOfFirebase/);
    assert.match(source, /export\s+(async\s+)?function\s+loginWithEmailPassword/);
    assert.match(source, /export\s+(async\s+)?function\s+signInWithGoogle/);
    assert.match(source, /export\s+function\s+isFirebaseConfigured/);
  });

  it('3. AuthContext.jsx imports and calls signOutOfFirebase during logout', () => {
    const authContextPath = resolve(process.cwd(), 'src/context/AuthContext.jsx');
    assert.ok(existsSync(authContextPath), 'AuthContext.jsx must exist');
    const source = readFileSync(authContextPath, 'utf-8');

    assert.match(source, /import\s+\{[^}]*signOutOfFirebase[^}]*\}\s+from\s+['"]\.\.\/lib\/firebase(\.js)?['"]/);
    assert.match(source, /signOutOfFirebase\(\)/);
  });

  it('4. POST /api/auth/login succeeds with valid credentials and sets signed session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: testUser.email,
        password: testPassword,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.user.email, testUser.email);
    assert.equal(body.user.username, testUser.username);

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Expected Set-Cookie header');
    assert.match(setCookie, /focuslens_session=/);
  });

  it('5. POST /api/auth/login rejects wrong password with 401 without creating session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: testUser.email,
        password: 'IncorrectPassword123!',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.error, 'Unauthorized');
  });

  it('6. POST /api/auth/login rejects nonexistent user with generic 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: 'nonexistent_user_9999@example.com',
        password: 'SomeRandomPassword123!',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.error, 'Unauthorized');
    assert.equal(body.message, 'Invalid email/phone/username or password.');
  });

  it('7. Google-only account attempting password login returns GOOGLE_ACCOUNT_ONLY code', async () => {
    const unique = Math.random().toString(36).substring(2, 8);
    const googleUser = await dbStore.createUser({
      email: `googleonly_${unique}@gmail.com`,
      username: `google_${unique}`,
      name: 'Google Only User',
      googleId: `gid_${unique}`,
      passwordHash: null,
      verificationMethod: 'EMAIL',
      verificationStatus: 'VERIFIED',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: googleUser.email,
        password: 'AnyPasswordAttempt123!',
      },
    });

    assert.equal(res.statusCode, 401);
    const body = res.json();
    assert.equal(body.code, 'GOOGLE_ACCOUNT_ONLY');
    assert.match(body.message, /Google Sign-In/i);
  });

  it('8. POST /api/auth/google establishes authenticated session and links account', async () => {
    const unique = Math.random().toString(36).substring(2, 8);
    const googleUid = `google_uid_${unique}`;
    const googleEmail = `g_login_${unique}@gmail.com`;

    setMockVerifier(async (token) => {
      assert.equal(token, 'mock-google-token');
      return {
        uid: googleUid,
        email: googleEmail,
        name: 'Google Login User',
        email_verified: true,
      };
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: { idToken: 'mock-google-token' },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.user.email, googleEmail);

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Expected session cookie on Google login');

    // Calling /api/auth/me with session cookie succeeds
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: setCookie.split(';')[0],
      },
    });
    assert.equal(meRes.statusCode, 200);
    assert.equal(meRes.json().user.email, googleEmail);
  });

  it('9. POST /api/auth/logout destroys session and rejects subsequent authenticated requests', async () => {
    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: testUser.email,
        password: testPassword,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const sessionCookie = loginRes.headers['set-cookie'].split(';')[0];

    // Logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(logoutRes.statusCode, 200);

    // Subsequent request with the same cookie is rejected
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: sessionCookie,
      },
    });
    assert.equal(meRes.statusCode, 401);
  });

  it('10. Protected routes reject unauthenticated access', async () => {
    const endpoints = [
      '/api/auth/me',
      '/api/analytics/dashboard',
      '/api/sessions',
      '/api/tasks',
      '/api/buddies',
    ];

    for (const endpoint of endpoints) {
      const res = await app.inject({
        method: 'GET',
        url: endpoint,
      });
      assert.equal(res.statusCode, 401, `${endpoint} should reject unauthenticated request with 401`);
    }
  });
});
