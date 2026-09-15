import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';

describe('FocusLens Optional Email & Phone Alternatives Test Suite (16 Requirements)', () => {
  let app;
  const tag = () => Math.random().toString(36).substring(2, 7);
  const genPhone = () => `+919${Math.floor(100000000 + Math.random() * 900000000)}`;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // 1. Email-only account -> succeeds
  test('1. Email-only account registration succeeds without phone number', async () => {
    const username = `emailonly_${tag()}`;
    const email = `emailonly_${tag()}@example.com`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Email Only User',
        username,
        email,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.username, username);
    assert.equal(body.user.email, email);
    assert.equal(body.user.phoneNumber, null);
  });

  // 2. Phone-only account -> succeeds
  test('2. Phone-only account registration succeeds without email address', async () => {
    const username = `phoneonly_${tag()}`;
    const phone = genPhone();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone Only User',
        username,
        phoneNumber: phone,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.username, username);
    assert.equal(body.user.phoneNumber, phone);
    assert.equal(body.user.email, null);
  });

  // 3. Account with both -> succeeds
  test('3. Account with both email and phone succeeds', async () => {
    const username = `both_${tag()}`;
    const email = `both_${tag()}@example.com`;
    const phone = genPhone();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Both Contacts User',
        username,
        email,
        phoneNumber: phone,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.username, username);
    assert.equal(body.user.email, email);
    assert.equal(body.user.phoneNumber, phone);
  });

  // 4. Missing email + phone selected -> succeeds
  test('4. Missing email when PHONE verification selected succeeds', async () => {
    const username = `nomailemail_${tag()}`;
    const phone = genPhone();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'No Email User',
        username,
        phoneNumber: phone,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
      },
    });

    assert.equal(res.statusCode, 201);
  });

  // 5. Missing phone + email selected -> succeeds
  test('5. Missing phone when EMAIL verification selected succeeds', async () => {
    const username = `nophoneemail_${tag()}`;
    const email = `nophone_${tag()}@example.com`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'No Phone User',
        username,
        email,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 201);
  });

  // 6. Email selected but missing email -> rejected
  test('6. Email selected but missing email is rejected', async () => {
    const username = `noemailselected_${tag()}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Fail Email User',
        username,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'EMAIL',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /Email address is required/i);
  });

  // 7. Phone selected but missing phone -> rejected
  test('7. Phone selected but missing phone is rejected', async () => {
    const username = `nophoneselected_${tag()}`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Fail Phone User',
        username,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /Phone number is required/i);
  });

  // 8. Duplicate username -> rejected
  test('8. Duplicate username rejected regardless of contact method', async () => {
    const username = `dup_handle_${tag()}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 1', username, email: `u1_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 2', username, phoneNumber: genPhone(), password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.payload).message, 'That username is already taken. Please choose another.');
  });

  // 9. Duplicate email -> rejected
  test('9. Duplicate email rejected when provided', async () => {
    const email = `dup_em_${tag()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 1', username: `u1_${tag()}`, email, password: 'SecurePassphrase9876!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 2', username: `u2_${tag()}`, email, password: 'SecurePassphrase9876!' },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.payload).message, 'An account with this email address already exists. Please sign in.');
  });

  // 10. Duplicate phone -> rejected
  test('10. Duplicate phone rejected when provided', async () => {
    const phone = genPhone();

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 1', username: `u1_${tag()}`, phoneNumber: phone, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 2', username: `u2_${tag()}`, phoneNumber: phone, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.payload).message, 'An account with this phone number already exists. Please sign in.');
  });

  // 11 & 12. Email-only account does not require phone & Phone-only account does not require email
  test('11 & 12. Accounts function normally without requiring second contact method', async () => {
    const phoneOnlyUser = `p_only_${tag()}`;
    const phone = genPhone();

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'P Only', username: phoneOnlyUser, phoneNumber: phone, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });
    assert.equal(reg.statusCode, 201);
    const cookie = `${reg.cookies[0].name}=${reg.cookies[0].value}`;

    // Can fetch profile without errors
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(meRes.statusCode, 200);
    const body = JSON.parse(meRes.payload);
    assert.equal(body.user.email, null);
    assert.equal(body.user.phoneNumber, phone);
  });

  // 13 & 14. Adding second contact later works & requires verification
  test('13 & 14. Adding missing phone to email-only account sends SMS OTP and requires verification', async () => {
    const email = `add_phone_${tag()}@example.com`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Add Phone User', username: `ap_${tag()}`, email, password: 'SecurePassphrase9876!', verificationMethod: 'EMAIL' },
    });
    const cookie = `${reg.cookies[0].name}=${reg.cookies[0].value}`;

    const newPhone = genPhone();
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/send-phone-verification',
      headers: { cookie },
      payload: { phoneNumber: newPhone },
    });

    assert.equal(sendRes.statusCode, 200);
    const body = JSON.parse(sendRes.payload);
    assert.equal(body.phoneNumber, newPhone);

    // Profile check shows phone set, phoneVerifiedAt initially null
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    const meBody = JSON.parse(meRes.payload);
    assert.equal(meBody.user.phoneNumber, newPhone);
    assert.equal(meBody.user.phoneVerifiedAt, null);
  });

  // 15. Password reset works using available verified method
  test('15. Password reset succeeds using phone for phone-only user and username lookup', async () => {
    const phone = genPhone();
    const username = `reset_phone_${tag()}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Reset Phone User', username, phoneNumber: phone, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });

    // Request reset using handle @username
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'AUTO', identifier: `@${username}` },
    });

    assert.equal(resetRes.statusCode, 200);
    const body = JSON.parse(resetRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.resetType, 'PHONE');
  });

  // 16. Existing history/user-data isolation remains intact
  test('16. User session history isolation remains intact across email-only and phone-only users', async () => {
    const reg1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 1', username: `u1_iso_${tag()}`, email: `e1_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });
    const cookie1 = `${reg1.cookies[0].name}=${reg1.cookies[0].value}`;

    const reg2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 2', username: `u2_iso_${tag()}`, phoneNumber: genPhone(), password: 'SecurePassphrase9876!', verificationMethod: 'PHONE' },
    });
    const cookie2 = `${reg2.cookies[0].name}=${reg2.cookies[0].value}`;

    // User 1 creates session
    const s1 = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookie1 },
      payload: { plannedDurationMs: 1500000, selectedActivity: 'Coding' },
    });
    const s1Id = JSON.parse(s1.payload).session.id;

    // User 2 cannot access User 1 session
    const idorRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${s1Id}`,
      headers: { cookie: cookie2 },
    });
    assert.equal(idorRes.statusCode, 404);
  });
});
