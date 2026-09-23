import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { config } from '../config/env.js';
import {
  sendEmailVerificationChallenge,
  sendEmailPasswordResetOtp,
  sendEmailPasswordResetLink,
  setMockEmailTransport,
  resetMockEmailTransport,
} from '../services/emailService.js';
import { generateNumericOTP, hashVerificationToken } from '../utils/verificationUtils.js';

describe('Zero-Cost Gmail SMTP Email Delivery & Verification Test Suite', () => {
  let app;
  let originalEmailProvider;
  let originalEmailHost;
  let originalEmailPort;
  let originalEmailSecure;
  let originalEmailUsername;
  let originalEmailPassword;
  let originalEmailFrom;
  let originalResendKey;

  before(async () => {
    // Preserve original config
    originalEmailProvider = config.emailProvider;
    originalEmailHost = config.emailHost;
    originalEmailPort = config.emailPort;
    originalEmailSecure = config.emailSecure;
    originalEmailUsername = config.emailUsername;
    originalEmailPassword = config.emailPassword;
    originalEmailFrom = config.emailFrom;
    originalResendKey = config.resendApiKey;

    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    // Restore original config
    config.emailProvider = originalEmailProvider;
    config.emailHost = originalEmailHost;
    config.emailPort = originalEmailPort;
    config.emailSecure = originalEmailSecure;
    config.emailUsername = originalEmailUsername;
    config.emailPassword = originalEmailPassword;
    config.emailFrom = originalEmailFrom;
    config.resendApiKey = originalResendKey;

    resetMockEmailTransport();
    await app.close();
  });

  afterEach(() => {
    resetMockEmailTransport();
  });

  const uniqueId = () => Math.random().toString(36).substring(2, 8);

  // -------------------------------------------------------------
  // 1. SMTP PROVIDER SELECTION & CONFIGURATION
  // -------------------------------------------------------------
  it('1. Selects SMTP provider when EMAIL_PROVIDER=smtp and EMAIL_HOST is set', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    config.emailPort = '587';
    config.emailSecure = false;
    config.emailUsername = 'focuslens.system@gmail.com';
    config.emailPassword = 'mock-app-password';
    config.emailFrom = 'focuslens.system@gmail.com';

    let capturedMail = null;
    setMockEmailTransport(async (mail) => {
      capturedMail = mail;
      return { messageId: '<smtp-test-1@gmail.com>' };
    });

    const result = await sendEmailVerificationChallenge({
      email: 'user@example.com',
      otp: '123456',
      name: 'Test User',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'smtp');
    assert.strictEqual(result.messageId, '<smtp-test-1@gmail.com>');
    assert.strictEqual(capturedMail.from, 'focuslens.system@gmail.com');
    assert.strictEqual(capturedMail.to, 'user@example.com');
    assert.match(capturedMail.text, /123456/);
  });

  it('2. Does NOT fall back to Resend when EMAIL_PROVIDER=smtp, even if RESEND_API_KEY is present', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    config.resendApiKey = 're_dummy_test_key_12345';

    let smtpCalled = false;
    setMockEmailTransport(async () => {
      smtpCalled = true;
      return { messageId: '<smtp-selected@gmail.com>' };
    });

    const result = await sendEmailVerificationChallenge({
      email: 'user@example.com',
      otp: '654321',
      name: 'Test User',
    });

    assert.strictEqual(smtpCalled, true);
    assert.strictEqual(result.provider, 'smtp');
    assert.strictEqual(result.success, true);
  });

  it('3. Fails safely if EMAIL_PROVIDER=smtp but EMAIL_HOST is missing (no silent fallback to dev in prod)', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = ''; // missing host

    const result = await sendEmailVerificationChallenge({
      email: 'user@example.com',
      otp: '112233',
      name: 'Test User',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'smtp');
    assert.match(result.error, /EMAIL_HOST is not configured/i);
  });

  // -------------------------------------------------------------
  // 2. EMAIL VERIFICATION SEND SUCCESS
  // -------------------------------------------------------------
  it('4. Successfully delivers verification challenge through SMTP and returns success: true', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    config.emailUsername = 'focuslens.system@gmail.com';
    config.emailPassword = 'super-secret-google-app-password';

    setMockEmailTransport(async (mail) => {
      assert.strictEqual(mail.to, 'alex@example.com');
      assert.match(mail.subject, /Verify Your FocusLens Account/);
      return { messageId: '<gmail-verified-123@smtp.gmail.com>' };
    });

    const result = await sendEmailVerificationChallenge({
      email: 'alex@example.com',
      otp: '889900',
      name: 'Alex',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'smtp');
    assert.strictEqual(result.messageId, '<gmail-verified-123@smtp.gmail.com>');
  });

  it('5. Successfully delivers password reset OTP through SMTP and returns success: true', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    config.emailUsername = 'focuslens.system@gmail.com';

    setMockEmailTransport(async (mail) => {
      assert.strictEqual(mail.to, 'alex@example.com');
      assert.match(mail.subject, /Reset Your FocusLens Password/);
      return { messageId: '<gmail-reset-456@smtp.gmail.com>' };
    });

    const result = await sendEmailPasswordResetOtp({
      email: 'alex@example.com',
      otp: '774411',
      name: 'Alex',
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'smtp');
    assert.strictEqual(result.messageId, '<gmail-reset-456@smtp.gmail.com>');
  });

  // -------------------------------------------------------------
  // 3. SMTP SEND FAILURE & ERROR HANDLING
  // -------------------------------------------------------------
  it('6. When SMTP transport rejects email, sendEmailVerificationChallenge returns success: false', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';

    setMockEmailTransport(async () => {
      const err = new Error('535 5.7.8 Username and Password not accepted');
      err.code = 'EAUTH';
      throw err;
    });

    const result = await sendEmailVerificationChallenge({
      email: 'user@example.com',
      otp: '998877',
      name: 'Fail User',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.provider, 'smtp');
    assert.match(result.error, /Username and Password not accepted/i);
  });

  it('7. User registration does NOT falsely claim "email sent" when SMTP fails', async () => {
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';

    setMockEmailTransport(async () => {
      throw new Error('Connection timeout connecting to smtp.gmail.com:587');
    });

    const testEmail = `smtp_fail_${uniqueId()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Fail User',
        username: `smtpfail_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    // User is created so they aren't locked out, but warning indicates email failure
    assert.strictEqual(body.warning, 'EMAIL_DELIVERY_FAILED');
    assert.doesNotMatch(body.message, /Verification code sent via EMAIL/i);
    assert.match(body.message, /could not deliver the verification email/i);
  });

  it('8. Resend email verification endpoint returns HTTP 502 when SMTP fails', async () => {
    // First register user successfully under dev mode
    config.emailProvider = 'dev';
    const testEmail = `resend_fail_${uniqueId()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Resend User',
        username: `resendf_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Reset cooldown in DB so resend is immediately available
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken('111111'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resendAvailableAt: new Date(Date.now() - 10000),
    });

    // Switch to failing SMTP
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    setMockEmailTransport(async () => {
      throw new Error('SMTP connection rejected: 421 Service not available');
    });

    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie },
      payload: { email: testEmail },
    });

    assert.strictEqual(resendRes.statusCode, 502);
    const body = JSON.parse(resendRes.body);
    assert.match(body.message, /Unable to deliver verification email at this time/i);
    assert.doesNotMatch(body.message, /Verification code sent/i);
  });

  // -------------------------------------------------------------
  // 4. OTP GENERATION, EXPIRATION, RESEND, AND INVALIDATION
  // -------------------------------------------------------------
  it('9. generateNumericOTP() generates a 6-digit numeric string', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateNumericOTP();
      assert.strictEqual(typeof otp, 'string');
      assert.strictEqual(otp.length, 6);
      assert.match(otp, /^\d{6}$/);
      const val = parseInt(otp, 10);
      assert.ok(val >= 100000 && val <= 999999);
    }
  });

  it('10. OTP expires after 15 minutes and expired OTP cannot be verified', async () => {
    config.emailProvider = 'dev';
    const testEmail = `expired_otp_${uniqueId()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Expired OTP User',
        username: `exp_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Set an expired OTP challenge (expired 5 minutes ago)
    const expiredOtp = '654321';
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken(expiredOtp),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      resendAvailableAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: expiredOtp },
    });

    assert.strictEqual(verifyRes.statusCode, 400);
    const body = JSON.parse(verifyRes.body);
    assert.match(body.message, /expired/i);
  });

  it('11. Resending a verification code enforces 60-second cooldown', async () => {
    config.emailProvider = 'dev';
    const testEmail = `cooldown_${uniqueId()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Cooldown User',
        username: `cool_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];

    // Immediate second request must trigger rate limit 429
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie },
      payload: { email: testEmail },
    });

    assert.strictEqual(secondRes.statusCode, 429);
    const body = JSON.parse(secondRes.body);
    assert.match(body.message, /Please wait \d+ seconds/i);
  });

  it('12. Resending a code invalidates old OTP and only new OTP can be verified', async () => {
    config.emailProvider = 'dev';
    const testEmail = `inval_otp_${uniqueId()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Invalidate User',
        username: `inv_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    const oldOtp = '111222';
    // Set old challenge and allow immediate resend
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken(oldOtp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resendAvailableAt: new Date(Date.now() - 1000),
    });

    // Capture newly generated OTP on resend
    let capturedNewOtp = null;
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    setMockEmailTransport(async (mail) => {
      const match = mail.text.match(/\b\d{6}\b/);
      if (match) capturedNewOtp = match[0];
      return { messageId: '<new-code-123@gmail.com>' };
    });

    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie },
      payload: { email: testEmail },
    });

    assert.strictEqual(resendRes.statusCode, 200);
    assert.ok(capturedNewOtp, 'A new OTP must be generated');
    assert.notStrictEqual(capturedNewOtp, oldOtp);

    // Verifying with OLD OTP must fail
    const oldVerifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: oldOtp },
    });
    assert.strictEqual(oldVerifyRes.statusCode, 400);

    // Verifying with NEW OTP must succeed
    const newVerifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: capturedNewOtp },
    });
    assert.strictEqual(newVerifyRes.statusCode, 200);
    const newBody = JSON.parse(newVerifyRes.body);
    assert.strictEqual(newBody.user.verificationStatus, 'VERIFIED');
  });

  // -------------------------------------------------------------
  // 5. SECURITY: NO SECRET OR RAW OTP LEAKAGE
  // -------------------------------------------------------------
  it('13. SMTP transmission failure sanitizes logs and does NOT leak password or secrets', async () => {
    const sensitivePassword = 'SECRET_APP_PASSWORD_98765';
    config.emailProvider = 'smtp';
    config.emailHost = 'smtp.gmail.com';
    config.emailPassword = sensitivePassword;

    setMockEmailTransport(async () => {
      // Simulate an error that includes the raw password in its stack/message
      throw new Error(`Auth failed with password: ${sensitivePassword}`);
    });

    const result = await sendEmailVerificationChallenge({
      email: 'leakcheck@example.com',
      otp: '654321',
      name: 'Leak Test',
    });

    assert.strictEqual(result.success, false);
    assert.ok(!result.error.includes(sensitivePassword), 'Error message must NOT contain sensitive password');
    assert.ok(result.error.includes('[REDACTED_PASSWORD]'), 'Error message must redact sensitive password');
  });

  it('14. Registration and verification API responses NEVER leak raw OTP', async () => {
    config.emailProvider = 'dev';
    const testEmail = `no_leak_${uniqueId()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'No Leak User',
        username: `noleak_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });

    const rawResponse = regRes.body;
    const body = JSON.parse(rawResponse);
    assert.strictEqual(body.otp, undefined);
    assert.strictEqual(body.token, undefined);
    assert.strictEqual(body.verificationToken, undefined);

    // Check database record: must only store hash, never plaintext OTP
    const userInDb = await dbStore.getUserByEmail(testEmail);
    assert.ok(userInDb.verificationTokenHash);
    assert.strictEqual(userInDb.verificationTokenHash.length, 64); // SHA-256 hex length
  });
});
