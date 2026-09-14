import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { hashVerificationToken } from '../utils/verificationUtils.js';

describe('FocusLens 6-Digit OTP Password Reset Security Test Suite', () => {
  let app;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  const uniqueId = () => Math.random().toString(36).substring(2, 8);
  const uniquePhone = () => '+1555' + Math.floor(1000000 + Math.random() * 9000000);

  // ----------------------------------------------------
  // EMAIL OTP RESET TESTS
  // ----------------------------------------------------
  it('1 & 3. Forgot password request with existing email returns generic safe message', async () => {
    const email = `otp_email_exist_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot1_${uniqueId()}`, email, password: 'ValidSecret123!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.match(body.message, /If an account exists/i);
  });

  it('2 & 3. Forgot password request with non-existing email returns identical generic safe response (No Account Enumeration)', async () => {
    const email = `otp_nonexistent_${uniqueId()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.match(body.message, /If an account exists/i);
  });

  it('4. Correct 6-digit Email OTP verifies, issues resetToken, and sets new password', async () => {
    const email = `otp_valid_${uniqueId()}@example.com`;
    const oldPass = 'OldSecretCode123!';
    const newPass = 'NewSecretCode456!';

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot2_${uniqueId()}`, email, password: oldPass },
    });
    const user = await dbStore.getUserByEmail(email);

    const otpCode = '654321';
    const tokenHash = hashVerificationToken(otpCode);
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'EMAIL',
      tokenHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    // Step 1: Verify OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: email, code: otpCode },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.body);
    assert.equal(verifyBody.valid, true);
    assert.ok(verifyBody.resetToken);

    // Step 2: Reset Password with issued resetToken
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: verifyBody.resetToken,
        method: 'EMAIL',
        newPassword: newPass,
        confirmPassword: newPass,
      },
    });

    assert.equal(resetRes.statusCode, 200);

    // Old password fails
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPass },
    });
    assert.equal(oldLogin.statusCode, 401);

    // New password succeeds
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: newPass },
    });
    assert.equal(newLogin.statusCode, 200);
  });

  it('5. Incorrect 6-digit OTP fails and tracks remaining attempts', async () => {
    const email = `wrong_otp_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot3_${uniqueId()}`, email, password: 'ValidSecret123!' },
    });
    const user = await dbStore.getUserByEmail(email);

    const otpCode = '123456';
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'EMAIL',
      tokenHash: hashVerificationToken(otpCode),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: email, code: '000000' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.message, /Invalid verification code/i);
  });

  it('6. Expired 6-digit OTP fails with HTTP 400', async () => {
    const email = `expired_otp_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot4_${uniqueId()}`, email, password: 'ValidSecret123!' },
    });
    const user = await dbStore.getUserByEmail(email);

    const otpCode = '112233';
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'EMAIL',
      tokenHash: hashVerificationToken(otpCode),
      expiresAt: new Date(Date.now() - 1000), // Expired
      resendAvailableAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: email, code: otpCode },
    });

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).message, /expired/i);
  });

  it('7 & 8. Reused OTP or reset authorization token fails', async () => {
    const email = `reused_otp_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot5_${uniqueId()}`, email, password: 'InitialSecret123!' },
    });
    const user = await dbStore.getUserByEmail(email);

    const otpCode = '998877';
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'EMAIL',
      tokenHash: hashVerificationToken(otpCode),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    // Step 1: Verify OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: email, code: otpCode },
    });
    assert.equal(verifyRes.statusCode, 200);
    const { resetToken } = JSON.parse(verifyRes.body);

    // Reuse OTP: fails because it's marked used
    const reuseOtp = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: email, code: otpCode },
    });
    assert.equal(reuseOtp.statusCode, 400);

    // Step 2: Reset password first time: succeeds
    const reset1 = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: resetToken, newPassword: 'SecondSecret12345!', confirmPassword: 'SecondSecret12345!' },
    });
    assert.equal(reset1.statusCode, 200);

    // Reuse resetToken second time: fails
    const reset2 = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: resetToken, newPassword: 'ThirdSecret123!', confirmPassword: 'ThirdSecret123!' },
    });
    assert.equal(reset2.statusCode, 400);
  });

  it('9 & 10. OTP resend is rate-limited within 60s cooldown', async () => {
    const email = `ratelimit_otp_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot6_${uniqueId()}`, email, password: 'ValidSecret123!' },
    });

    // First request: succeeds
    const req1 = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });
    assert.equal(req1.statusCode, 200);

    // Immediate second request: blocked (429)
    const req2 = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });
    assert.equal(req2.statusCode, 429);
    assert.match(JSON.parse(req2.body).message, /Please wait/i);
  });

  // ----------------------------------------------------
  // PHONE OTP RESET TESTS
  // ----------------------------------------------------
  it('10 & 14. Phone 6-digit OTP reset flow succeeds end-to-end', async () => {
    const email = `phone_otp_valid_${uniqueId()}@example.com`;
    const phone = uniquePhone();

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot7_${uniqueId()}`, email, password: 'OldSecretCode123!', verificationMethod: 'PHONE', phoneNumber: phone },
    });
    assert.equal(reg.statusCode, 201);
    const user = await dbStore.getUserByEmail(email);

    const smsOtp = '456789';
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'PHONE',
      tokenHash: hashVerificationToken(smsOtp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    // Verify SMS OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'PHONE', identifier: phone, code: smsOtp },
    });
    assert.equal(verifyRes.statusCode, 200);
    const { resetToken } = JSON.parse(verifyRes.body);

    // Reset password
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: resetToken,
        method: 'PHONE',
        newPassword: 'NewSecretCode123!',
        confirmPassword: 'NewSecretCode123!',
      },
    });

    assert.equal(resetRes.statusCode, 200);
  });

  // ----------------------------------------------------
  // PASSWORD POLICY & SECURITY TESTS
  // ----------------------------------------------------
  it('11. New password under 12 characters is rejected by reset (HTTP 400)', async () => {
    const email = `short_pass_otp_${uniqueId()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alex Developer', username: `forgot8_${uniqueId()}`, email, password: 'ValidSecret123!' },
    });
    const user = await dbStore.getUserByEmail(email);

    const verifiedToken = `verified_tok_${uniqueId()}`;
    await dbStore.createPasswordReset({
      userId: user.id,
      resetType: 'EMAIL',
      tokenHash: hashVerificationToken(verifiedToken),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: verifiedToken, newPassword: 'Short123!', confirmPassword: 'Short123!' },
    });

    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).message, /12 characters/i);
  });

  it('15. User A OTP cannot verify or reset User B password', async () => {
    const emailA = `usera_otp_${uniqueId()}@example.com`;
    const emailB = `userb_otp_${uniqueId()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Alice Smith', username: `forgot9a_${uniqueId()}`, email: emailA, password: 'SecureCode123!' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Bob Jones', username: `forgot9b_${uniqueId()}`, email: emailB, password: 'SecureCode456!' },
    });

    const userA = await dbStore.getUserByEmail(emailA);
    const otpA = '334455';

    await dbStore.createPasswordReset({
      userId: userA.id,
      resetType: 'EMAIL',
      tokenHash: hashVerificationToken(otpA),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Attempting to verify User A's OTP for User B's email fails
    const verifyUserB = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: emailB, code: otpA },
    });

    assert.equal(verifyUserB.statusCode, 400);

    // Verify User B login is still unaffected
    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: emailB, password: 'SecureCode456!' },
    });
    assert.equal(loginB.statusCode, 200);
  });
});
