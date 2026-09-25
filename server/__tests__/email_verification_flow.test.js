import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { hashVerificationToken } from '../utils/verificationUtils.js';

describe('Phase 6 — Email Verification End-to-End Flow & Regression Test Suite', () => {
  let app;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  const uniqueId = () => Math.random().toString(36).substring(2, 8);

  it('1. User registration creates UNVERIFIED status, sets server session, and hashes 6-digit OTP in DB', async () => {
    const email = `phase6_reg_${uniqueId()}@example.com`;
    const username = `p6_${uniqueId()}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Phase 6 User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.user.email, email);
    assert.equal(body.user.verificationStatus, 'UNVERIFIED');
    assert.equal(body.user.emailVerifiedAt, null);
    // Ensure sensitive verification token hash or OTP is never returned to client
    assert.equal(body.user.verificationTokenHash, undefined);
    assert.equal(body.user.otp, undefined);

    // Verify session cookie was set
    const cookie = res.headers['set-cookie'];
    assert.ok(cookie, 'Session cookie must be set on registration');

    // Verify DB record has SHA-256 token hash and 15-minute expiry
    const userInDb = await dbStore.getUserByEmail(email);
    assert.ok(userInDb.verificationTokenHash, 'Verification token hash must exist in DB');
    assert.ok(userInDb.verificationExpiresAt, 'Expiry must exist');
    assert.ok(new Date(userInDb.verificationExpiresAt) > new Date(), 'Expiry must be in the future');
  });

  it('2. Invalid OTP submission fails and decrements remaining attempts', async () => {
    const email = `phase6_fail_${uniqueId()}@example.com`;
    const username = `p6_fail_${uniqueId()}`;

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Fail OTP User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Explicitly set a known token hash in DB
    const knownOtp = '345678';
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken(knownOtp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    // Try wrong OTP
    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: '999999' },
    });

    assert.equal(verRes.statusCode, 400);
    const body = JSON.parse(verRes.body);
    assert.match(body.message, /Invalid verification code/i);
    assert.match(body.message, /attempts remaining/i);

    // Verify user remains UNVERIFIED in DB
    const userInDb = await dbStore.getUserById(userId);
    assert.equal(userInDb.verificationStatus, 'UNVERIFIED');
    assert.equal(userInDb.verificationAttempts, 1);
  });

  it('3. Expired OTP submission is rejected', async () => {
    const email = `phase6_exp_${uniqueId()}@example.com`;
    const username = `p6_exp_${uniqueId()}`;

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Expired OTP User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Set expired challenge (in the past)
    const knownOtp = '555444';
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken(knownOtp),
      expiresAt: new Date(Date.now() - 5000), // 5 seconds ago
      resendAvailableAt: new Date(),
    });

    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: knownOtp },
    });

    assert.equal(verRes.statusCode, 400);
    const body = JSON.parse(verRes.body);
    assert.match(body.message, /expired/i);
  });

  it('4. Correct OTP verifies user, sets emailVerifiedAt, clears challenge, and enables access', async () => {
    const email = `phase6_success_${uniqueId()}@example.com`;
    const username = `p6_succ_${uniqueId()}`;

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Success User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    const correctOtp = '654321';
    await dbStore.setVerificationChallenge(userId, {
      tokenHash: hashVerificationToken(correctOtp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      resendAvailableAt: new Date(),
    });

    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: correctOtp },
    });

    assert.equal(verRes.statusCode, 200);
    const verBody = JSON.parse(verRes.body);
    assert.equal(verBody.user.verificationStatus, 'VERIFIED');
    assert.ok(verBody.user.emailVerifiedAt);

    // Verify DB state
    const userInDb = await dbStore.getUserById(userId);
    assert.equal(userInDb.verificationStatus, 'VERIFIED');
    assert.equal(userInDb.verificationTokenHash, null);
    assert.equal(userInDb.verificationExpiresAt, null);

    // Subsequent GET /api/auth/me returns VERIFIED
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    assert.equal(meRes.statusCode, 200);
    const meBody = JSON.parse(meRes.body);
    assert.equal(meBody.user.verificationStatus, 'VERIFIED');
  });

  it('5. Submitting verification or resend when already verified returns already verified response', async () => {
    const email = `phase6_already_${uniqueId()}@example.com`;
    const username = `p6_alr_${uniqueId()}`;

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Already Verified User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Verify user immediately
    await dbStore.verifyUserEmail(userId);

    // Verify submit
    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie },
      payload: { code: '123456' },
    });

    assert.equal(verRes.statusCode, 200);
    const verBody = JSON.parse(verRes.body);
    assert.match(verBody.message, /already verified/i);
    assert.equal(verBody.user.verificationStatus, 'VERIFIED');

    // Resend request
    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie },
      payload: { email },
    });

    assert.equal(resendRes.statusCode, 400);
    const resendBody = JSON.parse(resendRes.body);
    assert.match(resendBody.message, /already verified/i);
  });

  it('6. Resend cooldown (60 seconds) prevents rapid spamming', async () => {
    const email = `phase6_cooldown_${uniqueId()}@example.com`;
    const username = `p6_cd_${uniqueId()}`;

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Cooldown User',
        email,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookie = regRes.headers['set-cookie'];

    // Registration sets resendAvailableAt to now + 60s. Immediate resend should return 429.
    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie },
    });

    assert.equal(resendRes.statusCode, 429);
    const body = JSON.parse(resendRes.body);
    assert.match(body.message, /Please wait \d+ seconds/i);
  });

  it('7. Login before verification maintains UNVERIFIED status, and login after maintains VERIFIED status', async () => {
    const email = `phase6_logincheck_${uniqueId()}@example.com`;
    const username = `p6_lc_${uniqueId()}`;
    const password = 'ValidPassword123!';

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username,
        name: 'Login Check User',
        email,
        password,
        verificationMethod: 'EMAIL',
      },
    });
    const userId = JSON.parse(regRes.body).user.id;

    // Login while UNVERIFIED
    const login1Res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: email, password },
    });
    assert.equal(login1Res.statusCode, 200);
    const login1Body = JSON.parse(login1Res.body);
    assert.equal(login1Body.user.verificationStatus, 'UNVERIFIED');

    // Mark verified
    await dbStore.verifyUserEmail(userId);

    // Login after VERIFIED
    const login2Res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: email, password },
    });
    assert.equal(login2Res.statusCode, 200);
    const login2Body = JSON.parse(login2Res.body);
    assert.equal(login2Body.user.verificationStatus, 'VERIFIED');
    assert.ok(login2Body.user.emailVerifiedAt);
  });
});
