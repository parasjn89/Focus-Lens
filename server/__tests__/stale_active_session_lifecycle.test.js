import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { pool } from '../db/client.js';

test('Stale Active Session Lifecycle & Automatic Reconciliation Regression Suite', async (t) => {
  let app;
  let cookieA, userAId;
  let cookieB, userBId;
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Register User A
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Lifecycle User A',
        username: `life_usera_${suffix}`,
        email: `life_usera_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
    userAId = JSON.parse(regA.payload).user.id;

    // Register User B
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Lifecycle User B',
        username: `life_userb_${suffix}`,
        email: `life_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
    await pool.end();
  });

  await t.test('1. Newly started session -> ACTIVE', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 25 * 60 * 1000,
        selectedActivity: 'Studying',
        startedAt: new Date().toISOString(),
      },
    });

    assert.equal(createRes.statusCode, 201);
    const created = JSON.parse(createRes.payload).session;
    assert.equal(created.status, 'ACTIVE', 'Newly started session within planned duration must be ACTIVE');
    assert.ok(created.lastHeartbeatAt, 'Newly started session must initialize lastHeartbeatAt');
  });

  await t.test('2. Genuinely running session with heartbeats -> remains ACTIVE', async () => {
    // Start session
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 30 * 60 * 1000,
        selectedActivity: 'Coding',
        startedAt: new Date().toISOString(),
      },
    });
    const created = JSON.parse(createRes.payload).session;

    // Send heartbeat pings as the client runs
    const pingRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${created.id}/heartbeat`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 15 * 1000,
        pausedDurationMs: 0,
        isPaused: false,
      },
    });
    assert.equal(pingRes.statusCode, 200);
    const pingData = JSON.parse(pingRes.payload);
    assert.equal(pingData.isAlive, true);
    assert.equal(pingData.status, 'ACTIVE');

    // Fetch history: running session must still be ACTIVE
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    assert.equal(listRes.statusCode, 200);
    const sessions = JSON.parse(listRes.payload).sessions;
    const runningSession = sessions.find(s => s.id === created.id);
    assert.ok(runningSession, 'Running session should be in history list');
    assert.equal(runningSession.status, 'ACTIVE', 'Genuinely running session must be ACTIVE in history list');
  });

  await t.test('3. Properly ended session -> COMPLETED', async () => {
    // Start a session
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 30 * 60 * 1000,
        selectedActivity: 'Coding',
        startedAt: new Date().toISOString(),
      },
    });
    const created = JSON.parse(createRes.payload).session;

    // Manually end / finalize session with status COMPLETED
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/sessions/${created.id}`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 20 * 60 * 1000,
        pausedDurationMs: 0,
        status: 'COMPLETED',
      },
    });
    assert.equal(updateRes.statusCode, 200);
    const updated = JSON.parse(updateRes.payload).session;
    assert.equal(updated.status, 'COMPLETED', 'Finalized session status must be COMPLETED');
    assert.ok(updated.endedAt, 'Finalized session must have endedAt timestamp set');

    // Query session history - status must be COMPLETED
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    const sessions = JSON.parse(listRes.payload).sessions;
    const found = sessions.find(s => s.id === created.id);
    assert.equal(found.status, 'COMPLETED', 'Ended session in history must be COMPLETED');
    assert.ok(found.endedAt, 'Ended session in history must have endedAt');
  });

  await t.test('4. Naturally completed timer -> COMPLETED', async () => {
    // Session reached its planned duration
    const plannedDur = 10 * 60 * 1000;
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: plannedDur,
        selectedActivity: 'Studying',
        startedAt: new Date().toISOString(),
      },
    });
    const created = JSON.parse(createRes.payload).session;

    // Finalize on timer zero
    const finalizeRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${created.id}/finalize`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: plannedDur,
        pausedDurationMs: 0,
        status: 'COMPLETED',
        endedAt: new Date().toISOString(),
      },
    });
    assert.equal(finalizeRes.statusCode, 200);
    const finalized = JSON.parse(finalizeRes.payload).session;
    assert.equal(finalized.status, 'COMPLETED');
    assert.equal(Number(finalized.actualDurationMs), plannedDur);
  });

  await t.test('5. Stale historical ACTIVE session -> cannot remain ACTIVE indefinitely', async () => {
    // Create an abandoned session started 2 hours ago with planned duration 25 mins, no heartbeat
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleSession = await dbStore.createSession({
      userId: userAId,
      selectedActivity: 'Studying',
      plannedDurationMs: 25 * 60 * 1000,
      actualDurationMs: 0,
      startedAt: twoHoursAgo,
      endedAt: null,
      status: 'ACTIVE',
    });

    assert.equal(staleSession.status, 'ACTIVE', 'Initial DB insert has ACTIVE status');

    // Manually set lastHeartbeatAt to 2 hours ago to simulate abandoned client
    await dbStore.updateSession(staleSession.id, userAId, {
      lastHeartbeatAt: twoHoursAgo,
    });

    // User opens Session History (GET /api/sessions)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    assert.equal(listRes.statusCode, 200);
    const sessions = JSON.parse(listRes.payload).sessions;
    const reconciledSession = sessions.find(s => s.id === staleSession.id);

    assert.ok(reconciledSession, 'Stale session must exist in history');
    assert.notEqual(reconciledSession.status, 'ACTIVE', 'Stale session must NOT remain ACTIVE');
    assert.equal(reconciledSession.status, 'COMPLETED', 'Stale session must be automatically reconciled to COMPLETED');
    assert.ok(reconciledSession.endedAt, 'Reconciled stale session must have calculated endedAt');
    assert.ok(Number(reconciledSession.actualDurationMs) > 0, 'Reconciled stale session must have duration assigned');

    // Verify GET /api/sessions/:id also returns reconciled COMPLETED status
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${staleSession.id}`,
      headers: { cookie: cookieA },
    });
    const fetched = JSON.parse(getRes.payload).session;
    assert.equal(fetched.status, 'COMPLETED', 'Direct session fetch must return COMPLETED for stale session');
  });

  await t.test('6. A stale session from another user cannot affect the current user session', async () => {
    // User B creates a stale session
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleB = await dbStore.createSession({
      userId: userBId,
      selectedActivity: 'Study',
      plannedDurationMs: 25 * 60 * 1000,
      actualDurationMs: 0,
      startedAt: twoHoursAgo,
      endedAt: null,
      status: 'ACTIVE',
    });
    await dbStore.updateSession(staleB.id, userBId, { lastHeartbeatAt: twoHoursAgo });

    // User A starts a brand new running session
    const resA = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 25 * 60 * 1000,
        selectedActivity: 'Coding',
        startedAt: new Date().toISOString(),
      },
    });
    const sessionA = JSON.parse(resA.payload).session;

    // User A fetches their history
    const listResA = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    const sessionsA = JSON.parse(listResA.payload).sessions;

    // User A session must remain ACTIVE and User B stale session must NOT be visible or interfere
    const foundA = sessionsA.find(s => s.id === sessionA.id);
    assert.ok(foundA);
    assert.equal(foundA.status, 'ACTIVE', "User A's running session must remain ACTIVE");
    assert.equal(sessionsA.some(s => s.id === staleB.id), false, "User B's session must not appear in User A's history");
  });

  await t.test("7. Current user's genuinely active session is NOT incorrectly marked completed", async () => {
    // User A has an active session created 30 seconds ago with fresh heartbeat
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 45 * 60 * 1000,
        selectedActivity: 'Studying',
        startedAt: new Date().toISOString(),
      },
    });
    const activeSession = JSON.parse(createRes.payload).session;

    // Send heartbeat
    await app.inject({
      method: 'POST',
      url: `/api/sessions/${activeSession.id}/heartbeat`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 30 * 1000,
      },
    });

    // Run reconciliation on User A
    await dbStore.reconcileActiveSessionsForUser(userAId);

    // Verify session remains ACTIVE
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${activeSession.id}`,
      headers: { cookie: cookieA },
    });
    const checked = JSON.parse(checkRes.payload).session;
    assert.equal(checked.status, 'ACTIVE', 'Genuinely active session must NOT be marked completed');
  });
});
