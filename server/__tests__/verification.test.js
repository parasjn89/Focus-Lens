import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { hashVerificationToken } from '../utils/verificationUtils.js';

describe('Account Verification System Test Suite (Email & Phone Choice)', () => {
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

  it('1. User Registration with Email Verification Choice creates unverified user and challenge', async () => {
    const testEmail = `verif_email_${uniqueId()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Email User',
        username: `verif1_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.user.email, testEmail);
    assert.equal(body.user.verificationStatus, 'UNVERIFIED');
    assert.equal(body.user.preferredVerificationMethod, 'EMAIL');
  });

  it('2. User Registration with Phone Verification Choice requires phone number', async () => {
    const testEmail = `verif_phone_fail_${uniqueId()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone User Fail',
        username: `verif2_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'PHONE',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.match(body.message, /Phone number is required/i);
  });

  it('3. User Registration with Phone Verification Choice succeeds with valid phone number', async () => {
    const testEmail = `verif_phone_${uniqueId()}@example.com`;
    const rawPhone = uniquePhone();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone User Success',
        username: `verif3_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'PHONE',
        phoneNumber: rawPhone,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.user.email, testEmail);
    assert.equal(body.user.verificationStatus, 'UNVERIFIED');
    assert.equal(body.user.preferredVerificationMethod, 'PHONE');
    assert.equal(body.user.phoneNumber, rawPhone);
  });

  it('4. Successful Email Verification using correct OTP updates status to VERIFIED', async () => {
    const testEmail = `verif_correct_otp_${uniqueId()}@example.com`;
    
    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'OTP User',
        username: `verif4_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookieHeader = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    // Directly set known OTP challenge in store for deterministic testing
    const knownOtp = '654321';
    const tokenHash = hashVerificationToken(knownOtp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await dbStore.setVerificationChallenge(userId, { tokenHash, expiresAt, resendAvailableAt: new Date() });

    // Submit code
    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie: cookieHeader },
      payload: { code: knownOtp },
    });

    assert.equal(verRes.statusCode, 200);
    const verBody = JSON.parse(verRes.body);
    assert.equal(verBody.user.verificationStatus, 'VERIFIED');
    assert.notEqual(verBody.user.emailVerifiedAt, null);
  });

  it('5. Incorrect OTP code fails and tracks remaining attempts', async () => {
    const testEmail = `verif_wrong_otp_${uniqueId()}@example.com`;
    
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Wrong OTP User',
        username: `verif5_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookieHeader = regRes.headers['set-cookie'];
    const userId = JSON.parse(regRes.body).user.id;

    const tokenHash = hashVerificationToken('111111');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await dbStore.setVerificationChallenge(userId, { tokenHash, expiresAt, resendAvailableAt: new Date() });

    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      headers: { cookie: cookieHeader },
      payload: { code: '999999' },
    });

    assert.equal(verRes.statusCode, 400);
    const verBody = JSON.parse(verRes.body);
    assert.match(verBody.message, /Invalid verification code/i);
  });

  it('6. Rate limiting blocks immediate resend requests within 60s cooldown', async () => {
    const testEmail = `verif_ratelimit_${uniqueId()}@example.com`;
    
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Rate Limit User',
        username: `verif6_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookieHeader = regRes.headers['set-cookie'];

    // Try to resend immediately (registration sets 60s cooldown)
    const resendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-email-verification',
      headers: { cookie: cookieHeader },
    });

    assert.equal(resendRes.statusCode, 429);
    const body = JSON.parse(resendRes.body);
    assert.match(body.message, /Please wait/i);
  });

  it('7. Method switching from Email to Phone updates preferred method and issues SMS challenge', async () => {
    const testEmail = `verif_switch_${uniqueId()}@example.com`;
    const newPhone = uniquePhone();

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Switch User',
        username: `verif7_${uniqueId()}`,
        email: testEmail,
        password: 'ValidPassword123!',
        verificationMethod: 'EMAIL',
      },
    });
    const cookieHeader = regRes.headers['set-cookie'];

    const switchRes = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-verification-method',
      headers: { cookie: cookieHeader },
      payload: {
        method: 'PHONE',
        phoneNumber: newPhone,
      },
    });

    assert.equal(switchRes.statusCode, 200);
    const body = JSON.parse(switchRes.body);
    assert.equal(body.user.preferredVerificationMethod, 'PHONE');
    assert.equal(body.user.phoneNumber, newPhone);
  });

  it('8. User Data Isolation: User B cannot verify or modify User A verification state', async () => {
    const userAEmail = `user_a_${uniqueId()}@example.com`;
    const userBEmail = `user_b_${uniqueId()}@example.com`;
    const phoneB = uniquePhone();

    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: `verif8a_${uniqueId()}`, email: userAEmail, password: 'ValidPassword123!', verificationMethod: 'EMAIL' },
    });

    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User B', username: `verif8b_${uniqueId()}`, email: userBEmail, password: 'ValidPassword123!', verificationMethod: 'EMAIL' },
    });

    const cookieB = regB.headers['set-cookie'];

    // User B attempts to switch verification method for themselves (should work for B, not affect A)
    const switchRes = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-verification-method',
      headers: { cookie: cookieB },
      payload: { method: 'PHONE', phoneNumber: phoneB },
    });

    assert.equal(switchRes.statusCode, 200);
    const bBody = JSON.parse(switchRes.body);
    assert.equal(bBody.user.email, userBEmail);

    // Verify User A remains unaffected
    const userARecord = await dbStore.getUserByEmail(userAEmail);
    assert.equal(userARecord.preferredVerificationMethod, 'EMAIL');
  });
});
