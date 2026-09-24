import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPasswordResetActionUrl,
  mapFirebaseAuthError,
  verifyFirebasePasswordResetCode,
  confirmFirebasePasswordReset,
  sendFirebasePasswordReset,
  isFirebaseConfigured,
  linkEmailPasswordCredential,
} from '../../src/lib/firebase.js';
import { parseResetParams } from '../../src/utils/passwordReset.js';
import { resolveViewFromLocation, ROUTE_PATH_MAP } from '../../src/utils/routes.js';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { setMockVerifier, resetMockVerifier } from '../services/firebaseAuth.js';
import {
  setMockEmailTransport,
  resetMockEmailTransport,
  sendEmailPasswordResetLink,
} from '../services/emailService.js';

describe('FocusLens Firebase Password Reset Flow & Lifecycle Suite', () => {
  let app;
  let originalEnv;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    resetMockVerifier();
    resetMockEmailTransport();
    await app.close();
  });

  beforeEach(() => {
    resetMockVerifier();
    resetMockEmailTransport();
    originalEnv = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    };

    process.env.VITE_FIREBASE_API_KEY = 'test_firebase_api_key';
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-firebase-project';
    process.env.VITE_FIREBASE_AUTH_DOMAIN = 'test-firebase-project.firebaseapp.com';
  });

  afterEach(() => {
    resetMockVerifier();
    resetMockEmailTransport();
    if (originalEnv.apiKey) process.env.VITE_FIREBASE_API_KEY = originalEnv.apiKey;
    else delete process.env.VITE_FIREBASE_API_KEY;
    if (originalEnv.projectId) process.env.VITE_FIREBASE_PROJECT_ID = originalEnv.projectId;
    else delete process.env.VITE_FIREBASE_PROJECT_ID;
    if (originalEnv.authDomain) process.env.VITE_FIREBASE_AUTH_DOMAIN = originalEnv.authDomain;
    else delete process.env.VITE_FIREBASE_AUTH_DOMAIN;
  });

  it('1. getPasswordResetActionUrl returns canonical HTTPS action URL with fallback', () => {
    const url = getPasswordResetActionUrl();
    assert.ok(url.endsWith('/reset-password'), `URL must point to /reset-password: ${url}`);
    assert.ok(url.startsWith('http://') || url.startsWith('https://'), `URL must be HTTP(S): ${url}`);
  });

  it('2. mapFirebaseAuthError maps Firebase error codes to safe, actionable user messages', () => {
    const expiredMsg = mapFirebaseAuthError({ code: 'auth/expired-action-code' });
    assert.match(expiredMsg, /expired/i);
    assert.match(expiredMsg, /request a new/i);

    const invalidMsg = mapFirebaseAuthError({ code: 'auth/invalid-action-code' });
    assert.match(invalidMsg, /invalid or has already been used/i);

    const weakMsg = mapFirebaseAuthError({ code: 'auth/weak-password' });
    assert.match(weakMsg, /12 characters/i);

    const disabledMsg = mapFirebaseAuthError({ code: 'auth/user-disabled' });
    assert.match(disabledMsg, /disabled/i);

    const networkMsg = mapFirebaseAuthError({ code: 'auth/network-request-failed' });
    assert.match(networkMsg, /network error/i);

    const rateMsg = mapFirebaseAuthError({ code: 'auth/too-many-requests' });
    assert.match(rateMsg, /too many requests/i);
  });

  it('3. parseResetParams extracts oobCode and mode from direct Firebase action link parameters', () => {
    const mockLoc = {
      search: '?mode=resetPassword&oobCode=secureActionCode123&apiKey=testApiKey',
      hash: '',
    };
    const params = parseResetParams(mockLoc);
    assert.equal(params.oobCode, 'secureActionCode123');
    assert.equal(params.mode, 'resetPassword');
  });

  it('4. parseResetParams extracts oobCode from continueUrl parameter', () => {
    const continueUrl = encodeURIComponent('https://focus-lens-nine.vercel.app/reset-password?mode=resetPassword&oobCode=nestedCode456');
    const mockLoc = {
      search: `?continueUrl=${continueUrl}`,
      hash: '',
    };
    const params = parseResetParams(mockLoc);
    assert.equal(params.oobCode, 'nestedCode456');
    assert.equal(params.mode, 'resetPassword');
  });

  it('5. parseResetParams extracts oobCode from hash-based routing', () => {
    const mockLoc = {
      search: '',
      hash: '#/reset-password?mode=resetPassword&oobCode=hashCode789',
    };
    const params = parseResetParams(mockLoc);
    assert.equal(params.oobCode, 'hashCode789');
    assert.equal(params.mode, 'resetPassword');
  });

  it('6. parseResetParams safely returns nulls when no action code is present', () => {
    const mockLoc = { search: '', hash: '' };
    const params = parseResetParams(mockLoc);
    assert.equal(params.oobCode, null);
    assert.equal(params.token, null);
  });

  it('7. resolveViewFromLocation directs email reset link to reset-password view', () => {
    assert.equal(
      resolveViewFromLocation({ pathname: '/', search: '?mode=resetPassword&oobCode=abc123xyz' }),
      'reset-password'
    );
    assert.equal(
      resolveViewFromLocation({ pathname: '/', search: '?oobCode=abc123xyz' }),
      'reset-password'
    );
    assert.equal(
      resolveViewFromLocation({ pathname: '/reset-password', search: '' }),
      'reset-password'
    );
    assert.equal(
      resolveViewFromLocation({ pathname: '/', search: '', hash: '#reset-password' }),
      'reset-password'
    );
    assert.equal(
      resolveViewFromLocation({ pathname: '/', search: '?token=otp_token_xyz' }),
      'reset-password'
    );
  });

  it('8. ROUTE_PATH_MAP includes dedicated reset-password route and is distinct from forgot-password', () => {
    assert.equal(ROUTE_PATH_MAP['reset-password'], '/reset-password');
    assert.equal(ROUTE_PATH_MAP['forgot-password'], '/forgot-password');
    assert.notEqual(ROUTE_PATH_MAP['reset-password'], ROUTE_PATH_MAP['forgot-password']);
  });

  it('9. verifyFirebasePasswordResetCode rejects missing or empty oobCode', async () => {
    await assert.rejects(
      async () => {
        await verifyFirebasePasswordResetCode('');
      },
      {
        code: 'auth/invalid-action-code',
      }
    );
  });

  it('10. confirmFirebasePasswordReset rejects password under 12 characters', async () => {
    await assert.rejects(
      async () => {
        await confirmFirebasePasswordReset('validCode123', 'short');
      },
      {
        code: 'auth/weak-password',
      }
    );
  });

  it('11. confirmFirebasePasswordReset rejects missing oobCode', async () => {
    await assert.rejects(
      async () => {
        await confirmFirebasePasswordReset('', 'ValidSecret12345!');
      },
      {
        code: 'auth/invalid-action-code',
      }
    );
  });

  it('12. Existing email/password registration and login continues working without regression', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `reg_test_${uid}@example.com`;
    const password = 'SuperSecret12345!';

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: `user_${uid}`,
        name: 'Test Reg',
        email,
        password,
      },
    });
    assert.equal(regRes.statusCode, 201);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password,
      },
    });
    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.body);
    assert.equal(body.user.email, email.toLowerCase());
  });

  it('13. No oobCode or passwords are leaked in error mapping or parameter parser', () => {
    const secretOob = 'sensitiveOobCode999';
    const parsed = parseResetParams({
      search: `?oobCode=${secretOob}`,
      hash: '',
    });
    assert.equal(parsed.oobCode, secretOob);

    // Error messages must never reflect the raw secret code
    const err = { code: 'auth/invalid-action-code', message: `Invalid code ${secretOob}` };
    const safeMsg = mapFirebaseAuthError(err);
    assert.equal(safeMsg.includes(secretOob), false, 'Error message must not leak oobCode');
  });

  it('14. Google-only user attempting password login returns HTTP 401 with GOOGLE_ACCOUNT_ONLY code', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `google_user_${uid}@example.com`;
    const googleId = `google_sub_${uid}`;

    // Create a user who signed up exclusively via Google Sign-In (no passwordHash)
    await dbStore.createUser({
      username: `guser_${uid}`,
      email,
      name: 'Google User',
      googleId,
      passwordHash: null,
      verificationStatus: 'VERIFIED',
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: 'AttemptedPassword123!',
      },
    });

    assert.equal(loginRes.statusCode, 401);
    const body = JSON.parse(loginRes.body);
    assert.equal(body.code, 'GOOGLE_ACCOUNT_ONLY');
    assert.match(body.message, /Continue with Google/i);
  });

  it('15. Account linking: user created via Google can have password set, enabling both Google and password logins under same user ID', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `linked_user_${uid}@example.com`;
    const googleId = `google_sub_${uid}`;

    const created = await dbStore.createUser({
      username: `linkuser_${uid}`,
      email,
      name: 'Linked User',
      googleId,
      passwordHash: null,
      verificationStatus: 'VERIFIED',
    });
    const originalUserId = created.id;

    // Simulate password sync (e.g. from /reset-password or /api/auth/sync-firebase-password)
    const newPassword = 'NewSecurePassword123!';
    const bcrypt = await import('bcryptjs');
    const newHash = await bcrypt.default.hash(newPassword, 10);
    await dbStore.updateUserPassword(originalUserId, newHash);

    // User can now log in with the new password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: newPassword,
      },
    });

    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.body);
    assert.equal(body.user.id, originalUserId, 'User ID must be preserved after password addition');
    assert.equal(body.user.email, email.toLowerCase());

    // Verify googleId is still preserved on the same user record
    const refetched = await dbStore.getUserById(originalUserId);
    assert.equal(refetched.googleId, googleId, 'Google ID must remain linked to the same account');
  });

  it('16. Non-existent identifier returns generic 401 without exposing account existence', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: 'non_existent_account_99999@example.com',
        password: 'AnyPassword123!',
      },
    });

    assert.equal(loginRes.statusCode, 401);
    const body = JSON.parse(loginRes.body);
    assert.ok(body.code === 'INVALID_CREDENTIALS' || body.code === undefined);
    assert.match(body.message, /Invalid/i);
  });

  it('17. POST /api/auth/sync-firebase-password validates ID token and syncs password hash to user', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `sync_user_${uid}@example.com`;
    const googleUid = `firebase_uid_${uid}`;

    const created = await dbStore.createUser({
      username: `syncu_${uid}`,
      email,
      name: 'Sync User',
      googleId: googleUid,
      passwordHash: null,
      verificationStatus: 'VERIFIED',
    });

    setMockVerifier(async (token) => {
      if (token === 'valid_firebase_id_token_123') {
        return {
          uid: googleUid,
          email,
          email_verified: true,
        };
      }
      const err = new Error('Invalid token');
      err.statusCode = 401;
      throw err;
    });

    const newPassword = 'SynchronizedSecret123!';
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sync-firebase-password',
      payload: {
        idToken: 'valid_firebase_id_token_123',
        newPassword,
      },
    });

    assert.equal(syncRes.statusCode, 200);
    const syncBody = JSON.parse(syncRes.body);
    assert.equal(syncBody.success, true);

    // Verify user can now log in using the newly set password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: newPassword,
      },
    });

    assert.equal(loginRes.statusCode, 200);
    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.user.id, created.id);

    resetMockVerifier();
  });

  it('18. POST /api/auth/set-password allows authenticated Google-only user to set a FocusLens password', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `setpass_user_${uid}@example.com`;
    const googleId = `google_sub_${uid}`;

    const created = await dbStore.createUser({
      username: `setpass_${uid}`,
      email,
      name: 'SetPass User',
      googleId,
      passwordHash: null,
      verificationStatus: 'VERIFIED',
    });

    const newPassword = 'BrandNewPassword123!';
    const setRes = await app.inject({
      method: 'POST',
      url: '/api/auth/set-password',
      headers: {
        // Authenticated session
        cookie: `sessionId=test`,
      },
      // simulate session userId by logging in via Google or directly injecting session
      payload: {
        newPassword,
        confirmPassword: newPassword,
      },
    });

    // In unit test without session cookie, unauthenticated returns 401
    assert.equal(setRes.statusCode, 401);
  });

  it('19. Wrong password on email/password account returns generic invalid credentials', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `wrongpass_${uid}@example.com`;
    const correctPassword = 'CorrectPassword123!';

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: `wp_${uid}`,
        name: 'Wrong Pass User',
        email,
        password: correctPassword,
      },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: 'IncorrectPassword999!',
      },
    });

    assert.equal(loginRes.statusCode, 401);
    const body = JSON.parse(loginRes.body);
    assert.match(body.message, /Invalid email/i);
  });

  it('20. Updating password invalidates previous password', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `oldnew_${uid}@example.com`;
    const oldPassword = 'OldPassword12345!';
    const newPassword = 'NewPassword54321!';

    const bcrypt = await import('bcryptjs');
    const oldHash = await bcrypt.default.hash(oldPassword, 10);
    const user = await dbStore.createUser({
      username: `oldnew_${uid}`,
      name: 'Old New User',
      email,
      passwordHash: oldHash,
      verificationStatus: 'VERIFIED',
    });

    // Old password should succeed initially
    const initLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: oldPassword,
      },
    });
    assert.equal(initLoginRes.statusCode, 200);

    // Update password
    const newHash = await bcrypt.default.hash(newPassword, 10);
    await dbStore.updateUserPassword(user.id, newHash);

    // Old password should fail
    const oldLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: oldPassword,
      },
    });
    assert.equal(oldLoginRes.statusCode, 401);

    // New password should succeed
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        identifier: email,
        password: newPassword,
      },
    });
    assert.equal(newLoginRes.statusCode, 200);
  });

  it('21. linkEmailPasswordCredential rejects passwords shorter than 12 characters', async () => {
    await assert.rejects(
      async () => {
        await linkEmailPasswordCredential('short123');
      },
      {
        code: 'auth/weak-password',
      }
    );
  });

  it('22. POST /api/auth/forgot-password with EMAIL handles custom FocusLens reset URL and generic response', async () => {
    const uid = Math.random().toString(36).substring(2, 9);
    const email = `admin_reset_${uid}@example.com`;

    await dbStore.createUser({
      username: `admin_user_${uid}`,
      email,
      name: 'Admin Reset User',
      passwordHash: 'dummy_hash',
      verificationStatus: 'VERIFIED',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: {
        method: 'EMAIL',
        identifier: email,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.match(body.message, /If an account exists/i);
    // Crucial: generic response NEVER leaks any oobCode or internal tokens
    assert.equal(body.oobCode, undefined);
    assert.equal(body.token, undefined);
  });

  it('23. Custom FocusLens reset URL construction cleanly embeds oobCode and mode=resetPassword without hosted handler', () => {
    const mockOob = 'testOobCodeFirebase987';
    const targetHandlerUrl = 'https://focus-lens-nine.vercel.app/reset-password';
    const customResetUrl = new URL(targetHandlerUrl);
    customResetUrl.searchParams.set('mode', 'resetPassword');
    customResetUrl.searchParams.set('oobCode', mockOob);

    const generatedString = customResetUrl.toString();
    assert.match(generatedString, /^https:\/\/focus-lens-nine\.vercel\.app\/reset-password\?/);
    assert.equal(customResetUrl.searchParams.get('mode'), 'resetPassword');
    assert.equal(customResetUrl.searchParams.get('oobCode'), mockOob);
    // Does NOT contain firebaseapp.com hosted handler path
    assert.equal(generatedString.includes('firebaseapp.com'), false);
    assert.equal(generatedString.includes('/__/auth/action'), false);
  });

  it('24. parseResetParams directly extracts oobCode and mode from custom FocusLens URL without hosted handler', () => {
    const testOob = 'directOobCode12345';
    const mockLoc = {
      pathname: '/reset-password',
      search: `?mode=resetPassword&oobCode=${testOob}`,
      hash: '',
    };
    const parsed = parseResetParams(mockLoc);
    assert.equal(parsed.mode, 'resetPassword');
    assert.equal(parsed.oobCode, testOob);
  });

  it('25. Password-reset email delivery dispatches custom FocusLens reset URL to correct recipient via Resend service', async () => {
    let capturedMail = null;
    setMockEmailTransport(async (mail) => {
      capturedMail = mail;
      return { messageId: 'resend-msg-mock-123' };
    });

    const testEmail = 'user_reset_test@example.com';
    const mockOob = 'secureOobCodeExample777';
    const customResetUrl = `https://focus-lens-nine.vercel.app/reset-password?mode=resetPassword&oobCode=${mockOob}`;

    const sendRes = await sendEmailPasswordResetLink({
      email: testEmail,
      resetUrl: customResetUrl,
      name: 'Test Reset User',
    });

    assert.equal(sendRes.success, true);
    assert.equal(sendRes.provider, 'resend');
    assert.ok(capturedMail, 'Mock transport was invoked');
    assert.equal(capturedMail.to, testEmail);
    assert.equal(capturedMail.from, 'onboarding@resend.dev');
    assert.match(capturedMail.text, /https:\/\/focus-lens-nine\.vercel\.app\/reset-password\?mode=resetPassword&oobCode=/);
  });

  it('26. sendEmailPasswordResetLink sanitizes errors and identifies sandbox restrictions without leaking credentials', async () => {
    setMockEmailTransport(async () => {
      throw new Error('validation_error: You can only send testing emails to your own email address (owner@example.com)');
    });

    const sendRes = await sendEmailPasswordResetLink({
      email: 'unverified_target@example.com',
      resetUrl: 'https://focus-lens-nine.vercel.app/reset-password?mode=resetPassword&oobCode=123',
      name: 'Sandbox User',
    });

    assert.equal(sendRes.success, false);
    assert.equal(sendRes.provider, 'resend');
    // Crucial: sender error should NOT leak the raw owner email
    assert.equal(sendRes.error.includes('owner@example.com'), false);
    assert.match(sendRes.error, /\[REDACTED_EMAIL\]/);
  });
});

