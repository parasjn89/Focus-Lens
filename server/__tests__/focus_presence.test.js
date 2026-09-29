import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/client.js';
import { realtimeMessageService } from '../services/realtimeMessageService.js';
import { dbStore } from '../db/store.js';

test('FocusLens Focus Buddy Live Presence ("Live Focus Status") Test Suite', async (t) => {
  let app;
  let cookieA, userA, userAId;
  let cookieB, userB, userBId;
  let cookieC, userC, userCId;
  let sessionIdA;
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  t.before(async () => {
    await runMigrations().catch(() => {});
    app = buildApp({ logger: false });
    await app.ready();

    // 1. Register User A (Paras)
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Paras Jain',
        username: `paras_${suffix}`,
        email: `paras_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
    userA = JSON.parse(regA.payload).user;
    userAId = userA.id;

    // 2. Register User B (Naman)
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Naman Dubey',
        username: `naman_${suffix}`,
        email: `naman_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userB = JSON.parse(regB.payload).user;
    userBId = userB.id;

    // 3. Register User C (Outsider)
    const regC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Charlie Outsider',
        username: `charlie_${suffix}`,
        email: `charlie_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieC = `${regC.cookies[0].name}=${regC.cookies[0].value}`;
    userC = JSON.parse(regC.payload).user;
    userCId = userC.id;

    // 4. Establish accepted buddy relationship between User A & User B
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/buddies/request',
      headers: { cookie: cookieA },
      payload: { usernameOrEmail: userB.username },
    });
    const buddyRequestId = JSON.parse(reqRes.payload).request.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/buddies/requests/${buddyRequestId}`,
      headers: { cookie: cookieB },
      payload: { action: 'ACCEPT' },
    });
  });

  t.after(async () => {
    realtimeMessageService.closeAll();
    await app.close();
  });

  await t.test('1. Initial presence state is IDLE for both buddies', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieA },
    });
    assert.equal(resA.statusCode, 200);
    const buddiesOfA = JSON.parse(resA.payload);
    assert.equal(buddiesOfA.length, 1);
    assert.equal(buddiesOfA[0].userId, userBId);
    assert.equal(buddiesOfA[0].status, 'IDLE');

    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    assert.equal(resB.statusCode, 200);
    const buddiesOfB = JSON.parse(resB.payload);
    assert.equal(buddiesOfB.length, 1);
    assert.equal(buddiesOfB[0].userId, userAId);
    assert.equal(buddiesOfB[0].status, 'IDLE');
  });

  await t.test('2. Authorization: Non-buddy cannot see presence', async () => {
    // User C has no accepted buddy relationships
    const resC = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieC },
    });
    assert.equal(resC.statusCode, 200);
    const buddiesOfC = JSON.parse(resC.payload);
    assert.equal(buddiesOfC.length, 0, 'Outsider must have 0 buddies in presence list');

    // Unauthenticated request is rejected
    const unauth = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
    });
    assert.equal(unauth.statusCode, 401);
  });

  await t.test('3. Session Start -> FOCUSING presence with server timestamps & broadcast', async () => {
    let capturedEvent = null;
    const presenceHandler = (data) => {
      if (data.userId === userAId) capturedEvent = data;
    };
    realtimeMessageService.on('focus.presence.started', presenceHandler);

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 25 * 60 * 1000,
        selectedActivity: 'Coding',
        goalText: 'Finish Presence Feature',
      },
    });
    assert.equal(startRes.statusCode, 201);
    const session = JSON.parse(startRes.payload).session;
    sessionIdA = session.id;

    // Check broadcast event
    assert.ok(capturedEvent, 'focus.presence.started event must be broadcast');
    assert.equal(capturedEvent.type, 'focus.presence.started');
    assert.equal(capturedEvent.userId, userAId);
    assert.equal(capturedEvent.status, 'FOCUSING');
    assert.ok(capturedEvent.startedAt, 'Must include startedAt');
    assert.ok(capturedEvent.endsAt, 'Must include endsAt');

    // Check Naman (User B) reading buddy presence via GET /api/buddies/presence
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const presenceList = JSON.parse(resB.payload);
    const parasPresence = presenceList.find(b => b.userId === userAId);
    assert.ok(parasPresence);
    assert.equal(parasPresence.status, 'FOCUSING');
    assert.ok(parasPresence.startedAt);
    assert.ok(parasPresence.endsAt);

    realtimeMessageService.off('focus.presence.started', presenceHandler);
  });

  await t.test('4. Session Heartbeat (isPaused: true) -> PAUSED presence & broadcast', async () => {
    let capturedEvent = null;
    const presenceHandler = (data) => {
      if (data.userId === userAId) capturedEvent = data;
    };
    realtimeMessageService.on('focus.presence.paused', presenceHandler);

    const hbRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionIdA}/heartbeat`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 120000,
        pausedDurationMs: 0,
        isPaused: true,
      },
    });
    assert.equal(hbRes.statusCode, 200);

    // Verify broadcast
    assert.ok(capturedEvent, 'focus.presence.paused event must be broadcast');
    assert.equal(capturedEvent.status, 'PAUSED');

    // Verify Naman sees PAUSED
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.equal(parasPresence.status, 'PAUSED');

    realtimeMessageService.off('focus.presence.paused', presenceHandler);
  });

  await t.test('5. Session Heartbeat (isPaused: false) -> Resumed to FOCUSING', async () => {
    let capturedEvent = null;
    const presenceHandler = (data) => {
      if (data.userId === userAId) capturedEvent = data;
    };
    realtimeMessageService.on('focus.presence.resumed', presenceHandler);

    const hbRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionIdA}/heartbeat`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 150000,
        pausedDurationMs: 10000,
        isPaused: false,
      },
    });
    assert.equal(hbRes.statusCode, 200);

    // Verify broadcast
    assert.ok(capturedEvent, 'focus.presence.resumed event must be broadcast');
    assert.equal(capturedEvent.status, 'FOCUSING');

    // Verify Naman sees FOCUSING
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.equal(parasPresence.status, 'FOCUSING');

    realtimeMessageService.off('focus.presence.resumed', presenceHandler);
  });

  await t.test('6. Privacy Guard: Zero private data leakage in presence response or event', async () => {
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const rawPayload = resB.payload;

    // Strict privacy checks: NO camera, screen, mic, AI monitoring, or personal contact info
    assert.equal(rawPayload.includes('camera'), false, 'Payload must not contain camera data');
    assert.equal(rawPayload.includes('screen'), false, 'Payload must not contain screen data');
    assert.equal(rawPayload.includes('audio'), false, 'Payload must not contain audio data');
    assert.equal(rawPayload.includes('microphone'), false, 'Payload must not contain microphone data');
    assert.equal(rawPayload.includes('score'), false, 'Payload must not contain scores');
    assert.equal(rawPayload.includes('Finish Presence Feature'), false, 'Payload must not contain private goal text');
    assert.equal(rawPayload.includes('Coding'), false, 'Payload must not contain selected activity category');
    assert.equal(rawPayload.includes('email'), false, 'Payload must not contain email addresses');
    assert.equal(rawPayload.includes('phone'), false, 'Payload must not contain phone numbers');
  });

  await t.test('7. Privacy Setting: Turning OFF shareFocusStatus hides presence completely', async () => {
    // User A turns OFF shareFocusStatus
    const patchRes = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: { shareFocusStatus: false },
    });
    assert.equal(patchRes.statusCode, 200);

    // Naman checks presence -> Paras must now show as IDLE with NO startedAt / endsAt
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.ok(parasPresence);
    assert.equal(parasPresence.status, 'IDLE');
    assert.equal(parasPresence.startedAt, undefined);
    assert.equal(parasPresence.endsAt, undefined);

    // Restore setting
    await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie: cookieA },
      payload: { shareFocusStatus: true },
    });
  });

  await t.test('8. Session Completion -> Presence returns to IDLE & broadcast completed', async () => {
    let capturedEvent = null;
    const presenceHandler = (data) => {
      if (data.userId === userAId) capturedEvent = data;
    };
    realtimeMessageService.on('focus.presence.completed', presenceHandler);

    const finalizeRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionIdA}/finalize`,
      headers: { cookie: cookieA },
      payload: {
        status: 'COMPLETED',
        actualDurationMs: 25 * 60 * 1000,
        pausedDurationMs: 10000,
      },
    });
    assert.equal(finalizeRes.statusCode, 200);

    assert.ok(capturedEvent, 'focus.presence.completed event must be broadcast');
    assert.equal(capturedEvent.status, 'IDLE');

    // Naman sees IDLE
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    const parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.equal(parasPresence.status, 'IDLE');

    realtimeMessageService.off('focus.presence.completed', presenceHandler);
  });

  await t.test('9. User Logout -> Presence immediately removed & broadcast expired', async () => {
    // Start another quick session for User A
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 15 * 60 * 1000,
        selectedActivity: 'Reading',
      },
    });
    assert.equal(startRes.statusCode, 201);

    // Verify User A is focusing
    let resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    let parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.equal(parasPresence.status, 'FOCUSING');

    let capturedEvent = null;
    const presenceHandler = (data) => {
      if (data.userId === userAId) capturedEvent = data;
    };
    realtimeMessageService.on('focus.presence.expired', presenceHandler);

    // User A logs out
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieA },
    });
    assert.equal(logoutRes.statusCode, 200);

    // Verify broadcast
    assert.ok(capturedEvent, 'focus.presence.expired must be broadcast on logout');
    assert.equal(capturedEvent.status, 'IDLE');

    // Naman sees Paras as IDLE
    resB = await app.inject({
      method: 'GET',
      url: '/api/buddies/presence',
      headers: { cookie: cookieB },
    });
    parasPresence = JSON.parse(resB.payload).find(b => b.userId === userAId);
    assert.equal(parasPresence.status, 'IDLE');

    realtimeMessageService.off('focus.presence.expired', presenceHandler);
  });

  await t.test('10. TTL Expiration: Stale presence beyond expiresAt returns IDLE', async () => {
    // Manually insert an expired presence
    await dbStore.upsertPresence(userAId, {
      sessionId: null,
      status: 'FOCUSING',
      startedAt: new Date(Date.now() - 100000),
      endsAt: new Date(Date.now() + 100000),
      expiresAt: new Date(Date.now() - 10000), // expired 10s ago
    });

    const presence = await dbStore.getPresenceByUserId(userAId);
    assert.equal(presence.status, 'IDLE', 'Expired presence must be resolved to IDLE');
  });
});
