import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';

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
  });

  await t.test('1. Genuinely running session can be ACTIVE', async () => {
    // Start a 25-minute focus session right now
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

    // Fetch session list - genuinely running session should still be ACTIVE
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

    // Fetch individual session by ID
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${created.id}`,
      headers: { cookie: cookieA },
    });
    assert.equal(getRes.statusCode, 200);
    const fetched = JSON.parse(getRes.payload).session;
    assert.equal(fetched.status, 'ACTIVE', 'Genuinely running session must be ACTIVE on GET /api/sessions/:id');
  });

  await t.test('2. Ended / completed session is COMPLETED', async () => {
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

  await t.test('3. Stale / non-running session cannot incorrectly appear ACTIVE', async () => {
    // Create an abandoned session started 3 hours ago with planned duration 25 mins, without explicit completion
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const staleSession = await dbStore.createSession({
      userId: userAId,
      selectedActivity: 'Studying',
      plannedDurationMs: 25 * 60 * 1000,
      actualDurationMs: 0,
      startedAt: threeHoursAgo,
      endedAt: null,
      status: 'ACTIVE',
    });

    assert.equal(staleSession.status, 'ACTIVE', 'Initial DB insert has ACTIVE status');

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

  await t.test('4. Starting a new session automatically supersedes and completes any previous abandoned active session', async () => {
    // Start Session 1 (User A)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 25 * 60 * 1000,
        selectedActivity: 'Studying',
        startedAt: new Date().toISOString(),
      },
    });
    const session1 = JSON.parse(res1.payload).session;
    assert.equal(session1.status, 'ACTIVE');

    // Without finishing Session 1, user starts Session 2 (e.g. refreshed page or started new task)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 45 * 60 * 1000,
        selectedActivity: 'Coding',
        startedAt: new Date().toISOString(),
      },
    });
    const session2 = JSON.parse(res2.payload).session;
    assert.equal(session2.status, 'ACTIVE');

    // Fetch history: Session 1 must be COMPLETED, only Session 2 is ACTIVE
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    const sessions = JSON.parse(listRes.payload).sessions;
    const found1 = sessions.find(s => s.id === session1.id);
    const found2 = sessions.find(s => s.id === session2.id);

    assert.equal(found1.status, 'COMPLETED', 'Superseded previous active session must be marked COMPLETED');
    assert.equal(found2.status, 'ACTIVE', 'Current active session must remain ACTIVE');
  });

  await t.test('5. Strict User Isolation: User B cannot see or reconcile User A sessions', async () => {
    // User B fetches their sessions
    const listResB = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieB },
    });
    const sessionsB = JSON.parse(listResB.payload).sessions;
    assert.equal(sessionsB.length, 0, 'User B should have 0 sessions');

    // User B attempts to fetch User A session
    const listResA = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });
    const userASessionId = JSON.parse(listResA.payload).sessions[0].id;

    const crossRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${userASessionId}`,
      headers: { cookie: cookieB },
    });
    assert.equal(crossRes.statusCode, 404, 'User B must not access User A session (IDOR protection)');
  });
});
