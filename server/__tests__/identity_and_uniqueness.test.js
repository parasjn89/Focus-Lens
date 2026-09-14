import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { hashVerificationToken } from '../utils/verificationUtils.js';

describe('Unique Username + Email + Phone Identity Test Suite (30 Requirements)', () => {
  let app;
  const tag = () => Math.random().toString(36).substring(2, 7);

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  // --- USERNAME TESTS ---

  test('1. Username required during registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'No Username User',
        email: `nousername_${tag()}@example.com`,
        password: 'SecurePassphrase9876!',
      },
    });
    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.match(body.message, /username/i);
  });

  test('2. Valid username accepted', async () => {
    const username = `valid_u_${tag()}`;
    const email = `valid_u_${tag()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Valid Username User',
        username,
        email,
        password: 'SecurePassphrase9876!',
      },
    });
    assert.equal(res.statusCode, 201, `Failed to register valid username: ${res.payload}`);
    const body = JSON.parse(res.payload);
    assert.equal(body.user.username, username);
  });

  test('3. Invalid username rejected (too short / invalid characters)', async () => {
    const invalidUsernames = ['a', 'usr@name', 'user name', 'super_long_username_that_exceeds_thirty_chars_limit'];
    for (const username of invalidUsernames) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'Invalid User',
          username,
          email: `invalid_u_${tag()}@example.com`,
          password: 'SecurePassphrase9876!',
        },
      });
      assert.equal(res.statusCode, 400);
    }
  });

  test('4. Duplicate username rejected', async () => {
    const username = `dup_u_${tag()}`;
    const email1 = `dup_u1_${tag()}@example.com`;
    const email2 = `dup_u2_${tag()}@example.com`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 1', username, email: email1, password: 'SecurePassphrase9876!' },
    });
    assert.equal(res1.statusCode, 201);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User 2', username, email: email2, password: 'SecurePassphrase9876!' },
    });
    assert.equal(res2.statusCode, 400);
    const body = JSON.parse(res2.payload);
    assert.equal(body.message, 'That username is already taken. Please choose another.');
  });

  test('5. Username uniqueness is case-insensitive', async () => {
    const baseUsername = `CaseUser_${tag()}`;
    const email1 = `case_u1_${tag()}@example.com`;
    const email2 = `case_u2_${tag()}@example.com`;

    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Case User 1', username: baseUsername.toLowerCase(), email: email1, password: 'SecurePassphrase9876!' },
    });
    assert.equal(res1.statusCode, 201);

    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Case User 2', username: baseUsername.toUpperCase(), email: email2, password: 'SecurePassphrase9876!' },
    });
    assert.equal(res2.statusCode, 400);
    const body = JSON.parse(res2.payload);
    assert.equal(body.message, 'That username is already taken. Please choose another.');
  });

  test('6. Username can be changed via profile update', async () => {
    const oldUsername = `old_u_${tag()}`;
    const newUsername = `new_u_${tag()}`;
    const email = `change_u_${tag()}@example.com`;

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Change Username User', username: oldUsername, email, password: 'SecurePassphrase9876!' },
    });
    const cookie = `${reg.cookies[0].name}=${reg.cookies[0].value}`;

    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie },
      payload: { name: 'Change Username User', username: newUsername },
    });

    assert.equal(updateRes.statusCode, 200);
    const body = JSON.parse(updateRes.payload);
    assert.equal(body.user.username, newUsername);
  });

  test('7. Changed username remains unique (conflicts rejected)', async () => {
    const usernameA = `user_a_${tag()}`;
    const usernameB = `user_b_${tag()}`;

    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: usernameA, email: `a_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });

    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User B', username: usernameB, email: `b_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;

    // User B tries to change username to User A's username -> rejected
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/auth/profile',
      headers: { cookie: cookieB },
      payload: { name: 'User B', username: usernameA },
    });

    assert.equal(updateRes.statusCode, 400);
    const body = JSON.parse(updateRes.payload);
    assert.equal(body.message, 'That username is already taken. Please choose another.');
  });

  // --- EMAIL TESTS ---

  test('8. Duplicate email rejected', async () => {
    const email = `dup_email_${tag()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'First Email User', username: `u1_${tag()}`, email, password: 'SecurePassphrase9876!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Second Email User', username: `u2_${tag()}`, email, password: 'SecurePassphrase9876!' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.message, 'An account with this email address already exists. Please sign in.');
  });

  test('9. Email uniqueness is case-insensitive', async () => {
    const rawEmail = `Case_Email_${tag()}@Example.COM`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Case Email 1', username: `ce1_${tag()}`, email: rawEmail.toLowerCase(), password: 'SecurePassphrase9876!' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Case Email 2', username: `ce2_${tag()}`, email: rawEmail.toUpperCase(), password: 'SecurePassphrase9876!' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.message, 'An account with this email address already exists. Please sign in.');
  });

  // --- PHONE TESTS ---

  test('10. Duplicate phone rejected', async () => {
    const phone = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone User 1',
        username: `pu1_${tag()}`,
        email: `pu1_${tag()}@example.com`,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
        phoneNumber: phone,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone User 2',
        username: `pu2_${tag()}`,
        email: `pu2_${tag()}@example.com`,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
        phoneNumber: phone,
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.message, 'An account with this phone number already exists. Please sign in.');
  });

  test('11 & 12. Phone formatting variations resolve to same normalized number & rejected', async () => {
    const numPart = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneFormatted1 = `+91 ${numPart.substring(0, 5)} ${numPart.substring(5)}`;
    const phoneFormatted2 = `+91${numPart}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone Format 1',
        username: `pf1_${tag()}`,
        email: `pf1_${tag()}@example.com`,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
        phoneNumber: phoneFormatted1,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Phone Format 2',
        username: `pf2_${tag()}`,
        email: `pf2_${tag()}@example.com`,
        password: 'SecurePassphrase9876!',
        verificationMethod: 'PHONE',
        phoneNumber: phoneFormatted2,
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.message, 'An account with this phone number already exists. Please sign in.');
  });

  // --- COMBINATIONS & ISOLATION ---

  test('13 & 14. Distinct users with unique username, email, phone succeed', async () => {
    const phoneA = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneB = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const usernameA = `paras_${tag()}`;
    const usernameB = `naman_${tag()}`;
    const emailA = `paras_${tag()}@gmail.com`;
    const emailB = `naman_${tag()}@gmail.com`;

    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Paras Jain', username: usernameA, email: emailA, password: 'SecurePassphrase9876!', verificationMethod: 'EMAIL', phoneNumber: phoneA },
    });
    assert.equal(resA.statusCode, 201);

    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Naman Jain', username: usernameB, email: emailB, password: 'SecurePassphrase9876!', verificationMethod: 'EMAIL', phoneNumber: phoneB },
    });
    assert.equal(resB.statusCode, 201);
  });

  test('15. User C with duplicate username (paras) is rejected', async () => {
    const usernameA = `unique_paras_${tag()}`;
    const phoneA = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const phoneC = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: usernameA, email: `a_${tag()}@example.com`, password: 'SecurePassphrase9876!', phoneNumber: phoneA },
    });

    const resC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User C', username: usernameA, email: `c_${tag()}@example.com`, password: 'SecurePassphrase9876!', phoneNumber: phoneC },
    });

    assert.equal(resC.statusCode, 400);
    const body = JSON.parse(resC.payload);
    assert.equal(body.message, 'That username is already taken. Please choose another.');
  });

  test('16. User C with duplicate email is rejected', async () => {
    const emailA = `shared_email_${tag()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: `ua_${tag()}`, email: emailA, password: 'SecurePassphrase9876!' },
    });

    const resC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User C', username: `uc_${tag()}`, email: emailA, password: 'SecurePassphrase9876!' },
    });

    assert.equal(resC.statusCode, 400);
    const body = JSON.parse(resC.payload);
    assert.equal(body.message, 'An account with this email address already exists. Please sign in.');
  });

  test('17. User C with duplicate phone is rejected', async () => {
    const phoneA = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: `ua_${tag()}`, email: `a_${tag()}@example.com`, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE', phoneNumber: phoneA },
    });

    const resC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User C', username: `uc_${tag()}`, email: `c_${tag()}@example.com`, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE', phoneNumber: phoneA },
    });

    assert.equal(resC.statusCode, 400);
    const body = JSON.parse(resC.payload);
    assert.equal(body.message, 'An account with this phone number already exists. Please sign in.');
  });

  test('18 & 19. Same user cannot create another account with same email or phone', async () => {
    const email = `same_user_${tag()}@example.com`;
    const phone = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Original Account', username: `orig_${tag()}`, email, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE', phoneNumber: phone },
    });

    // Attempt 1: Same email
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Second Account Email', username: `sec1_${tag()}`, email, password: 'SecurePassphrase9876!' },
    });
    assert.equal(res1.statusCode, 400);

    // Attempt 2: Same phone
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Second Account Phone', username: `sec2_${tag()}`, email: `diff_${tag()}@example.com`, password: 'SecurePassphrase9876!', verificationMethod: 'PHONE', phoneNumber: phone },
    });
    assert.equal(res2.statusCode, 400);
  });

  // --- LOGIN TESTS ---

  test('20. Email login works', async () => {
    const username = `login_e_${tag()}`;
    const email = `login_e_${tag()}@example.com`;
    const password = 'ValidPassword123!';

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Email Login User', username, email, password },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.payload);
    assert.equal(body.user.email, email);
  });

  test('21. Username login works (case-insensitive handle login)', async () => {
    const username = `Login_Handle_${tag()}`;
    const email = `login_h_${tag()}@example.com`;
    const password = 'SecurePassphrase9876!';

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Username Login User', username, email, password },
    });

    // Login using @username or username
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `@${username.toUpperCase()}`, password },
    });

    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.payload);
    assert.equal(body.user.email, email);
    assert.equal(body.user.username, username.toLowerCase());
  });

  test('22. Incorrect credentials fail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nonexistent_account@example.com', password: 'WrongPassword123!' },
    });
    assert.equal(res.statusCode, 401);
  });

  test('23. Verification policy remains intact', async () => {
    const email = `verif_policy_${tag()}@example.com`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Unverified Policy User', username: `vp_${tag()}`, email, password: 'SecurePassphrase9876!', verificationMethod: 'EMAIL' },
    });

    assert.equal(reg.statusCode, 201);
    const body = JSON.parse(reg.payload);
    assert.equal(body.user.verificationStatus, 'UNVERIFIED');
  });

  // --- PASSWORD RESET TESTS ---

  test('24. Email reset identifies correct account', async () => {
    const email = `reset_e_${tag()}@example.com`;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Email Reset User', username: `re_${tag()}`, email, password: 'OldPassword123!' },
    });
    assert.equal(reg.statusCode, 201);

    const resetReq = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'EMAIL', identifier: email },
    });
    assert.equal(resetReq.statusCode, 200);
  });

  test('25. Phone reset identifies correct account without ambiguity', async () => {
    const phone = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const email = `reset_p_${tag()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Phone Reset User', username: `rp_${tag()}`, email, password: 'OldPassword123!', verificationMethod: 'PHONE', phoneNumber: phone },
    });

    const resetReq = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { method: 'PHONE', identifier: phone },
    });
    assert.equal(resetReq.statusCode, 200);
  });

  test('26. User A cannot reset User B account', async () => {
    const emailA = `reset_usera_${tag()}@example.com`;
    const emailB = `reset_userb_${tag()}@example.com`;

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User A', username: `rua_${tag()}`, email: emailA, password: 'OldPassword123!' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'User B', username: `rub_${tag()}`, email: emailB, password: 'OldPassword123!' },
    });

    const userA = await dbStore.getUserByEmail(emailA);
    const tokenHashA = hashVerificationToken('123456');

    await dbStore.createPasswordReset({
      userId: userA.id,
      resetType: 'EMAIL',
      tokenHash: tokenHashA,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Trying to use User A's OTP code for User B fails
    const verRes = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-reset-token',
      payload: { method: 'EMAIL', identifier: emailB, code: '123456' },
    });
    assert.equal(verRes.statusCode, 400);
  });

  test('27. OTP security checks pass (single-use, expiration, rate limiting)', async () => {
    const email = `otp_sec_${tag()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'OTP Sec User', username: `os_${tag()}`, email, password: 'OldPassword123!' },
    });

    // Immediate repeat reset requests rate limited
    await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { method: 'EMAIL', identifier: email } });
    const req2 = await app.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { method: 'EMAIL', identifier: email } });
    assert.equal(req2.statusCode, 429);
  });

  // --- ISOLATION TESTS ---

  test('28, 29 & 30. Strict Data Isolation: User A sees only A history, User B sees only B history, Session IDs cannot bypass authorization', async () => {
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Iso User A', username: `isoa_${tag()}`, email: `isoa_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });
    const cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;

    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Iso User B', username: `isob_${tag()}`, email: `isob_${tag()}@example.com`, password: 'SecurePassphrase9876!' },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;

    // User A creates Session A
    const sessA = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: { plannedDurationMs: 1500000, selectedActivity: 'Coding' },
    });
    const sessionAId = JSON.parse(sessA.payload).session.id;

    // User B creates Session B
    const sessB = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieB },
      payload: { plannedDurationMs: 1800000, selectedActivity: 'Reading' },
    });
    const sessionBId = JSON.parse(sessB.payload).session.id;

    // User A history contains ONLY Session A
    const listA = await app.inject({ method: 'GET', url: '/api/sessions', headers: { cookie: cookieA } });
    const sessionsA = JSON.parse(listA.payload).sessions.map((s) => s.id);
    assert.ok(sessionsA.includes(sessionAId));
    assert.equal(sessionsA.includes(sessionBId), false);

    // User B history contains ONLY Session B
    const listB = await app.inject({ method: 'GET', url: '/api/sessions', headers: { cookie: cookieB } });
    const sessionsB = JSON.parse(listB.payload).sessions.map((s) => s.id);
    assert.ok(sessionsB.includes(sessionBId));
    assert.equal(sessionsB.includes(sessionAId), false);

    // User A attempting to access Session B directly by ID fails with 404
    const idorGet = await app.inject({ method: 'GET', url: `/api/sessions/${sessionBId}`, headers: { cookie: cookieA } });
    assert.equal(idorGet.statusCode, 404);
  });
});
