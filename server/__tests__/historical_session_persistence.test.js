import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { calculateFocusReplayMetrics } from '../../src/utils/focusReplay.js';
import { calculateDeepWorkBlocks } from '../../src/utils/deepWork.js';
import {
  mergeAdjacentSegments,
  calculateActivityDurations,
  calculateActivityPercentages,
} from '../../src/utils/sessionAnalytics.js';

test('Historical Session Data Persistence & Retrieval Test Suite', async (t) => {
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
        name: 'Persistence User A',
        username: `pers_usera_${suffix}`,
        email: `pers_usera_${suffix}@example.com`,
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
        name: 'Persistence User B',
        username: `pers_userb_${suffix}`,
        email: `pers_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  let createdSessionId = null;
  const baseTime = Date.now() - 3000 * 1000; // 50 mins ago

  const testSegments = [
    {
      activityType: 'CODING',
      startTimeMs: baseTime,
      endTimeMs: baseTime + 1200 * 1000, // 20 min coding
      durationMs: 1200 * 1000,
      evidenceScore: 0.92,
      confidenceType: 'heuristic',
      contributingSignals: ['SCREEN_CODING', 'FACE_PRESENT'],
      explanation: { details: 'VS Code editor detected' },
    },
    {
      activityType: 'PHONE_ACTIVITY',
      startTimeMs: baseTime + 1200 * 1000,
      endTimeMs: baseTime + 1380 * 1000, // 3 min phone
      durationMs: 180 * 1000,
      evidenceScore: 0.88,
      confidenceType: 'heuristic',
      contributingSignals: ['PHONE_PRESENT'],
      explanation: { details: 'Phone interaction observed' },
    },
    {
      activityType: 'STUDY_LIKE',
      startTimeMs: baseTime + 1380 * 1000,
      endTimeMs: baseTime + 2880 * 1000, // 25 min study
      durationMs: 1500 * 1000,
      evidenceScore: 0.95,
      confidenceType: 'heuristic',
      contributingSignals: ['SCREEN_DOCUMENT', 'FACE_PRESENT', 'HEAD_FORWARD'],
      explanation: { details: 'Reading documentation' },
    },
    {
      activityType: 'AWAY_OR_NOT_VISIBLE',
      startTimeMs: baseTime + 2880 * 1000,
      endTimeMs: baseTime + 3000 * 1000, // 2 min away
      durationMs: 120 * 1000,
      evidenceScore: 0.99,
      confidenceType: 'heuristic',
      contributingSignals: ['NO_PERSON'],
      explanation: { details: 'Stepped away from desk' },
    },
  ];

  await t.test('1. Session creation and persistence in database', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 3000000, // 50 min
        selectedActivity: 'Full-Stack Development',
        goalText: 'Build historical persistence layer',
        goalType: 'TIME',
        targetValue: 45,
        targetUnit: 'minutes',
        startedAt: new Date(baseTime).toISOString(),
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.session);
    assert.ok(body.session.id);
    createdSessionId = body.session.id;

    // Verify session exists in DB
    const dbSession = await dbStore.getSessionByIdAndUser(createdSessionId, userAId);
    assert.ok(dbSession);
    assert.equal(dbSession.status, 'ACTIVE');
    assert.equal(dbSession.plannedDurationMs, 3000000);
  });

  await t.test('2. Activity segments persistence in PostgreSQL', async () => {
    assert.ok(createdSessionId, 'Session must be created');

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${createdSessionId}/segments`,
      headers: { cookie: cookieA },
      payload: {
        segments: testSegments,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.savedCount, 4);

    // Verify segments exist in DB store
    const dbSegments = await dbStore.getSegmentsBySessionId(createdSessionId);
    assert.equal(dbSegments.length, 4);
    assert.equal(dbSegments[0].activityType, 'CODING');
    assert.equal(dbSegments[1].activityType, 'PHONE_ACTIVITY');
    assert.equal(dbSegments[2].activityType, 'STUDY_LIKE');
    assert.equal(dbSegments[3].activityType, 'AWAY_OR_NOT_VISIBLE');
  });

  await t.test('3. Session completion finalization', async () => {
    assert.ok(createdSessionId);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/sessions/${createdSessionId}`,
      headers: { cookie: cookieA },
      payload: {
        actualDurationMs: 3000000,
        pausedDurationMs: 60000,
        status: 'COMPLETED',
        endedAt: new Date(baseTime + 3000 * 1000).toISOString(),
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.session.status, 'COMPLETED');
    assert.equal(body.session.actualDurationMs, 3000000);
    // 20 min coding + 25 min study = 45 min qualifying -> 45 points earned
    assert.ok(body.session.focusPoints >= 45);
  });

  await t.test('4. GET /api/sessions/:id returns full session with normalized activitySegments', async () => {
    assert.ok(createdSessionId);

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${createdSessionId}`,
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.session);
    assert.equal(body.session.id, createdSessionId);
    assert.equal(body.session.selectedActivity, 'Full-Stack Development');
    assert.equal(body.session.goalText, 'Build historical persistence layer');
    assert.equal(body.session.status, 'COMPLETED');

    // Verify activitySegments are returned
    assert.ok(Array.isArray(body.activitySegments));
    assert.equal(body.activitySegments.length, 4);

    // Verify each segment has both canonical keys (type, startTime, endTime, durationMs) AND DB keys
    body.activitySegments.forEach((seg) => {
      assert.ok(seg.id, 'Segment must have an ID');
      assert.ok(seg.type, 'Segment must have type');
      assert.ok(seg.activityType, 'Segment must have activityType');
      assert.equal(seg.type, seg.activityType);
      assert.ok(typeof seg.startTime === 'number', 'startTime must be a number');
      assert.ok(typeof seg.startTimeMs === 'number', 'startTimeMs must be a number');
      assert.equal(seg.startTime, seg.startTimeMs);
      assert.ok(typeof seg.endTime === 'number', 'endTime must be a number');
      assert.ok(typeof seg.endTimeMs === 'number', 'endTimeMs must be a number');
      assert.equal(seg.endTime, seg.endTimeMs);
      assert.ok(typeof seg.durationMs === 'number', 'durationMs must be a number');
      assert.ok(seg.durationMs > 0, 'durationMs must be positive');
      assert.ok(Array.isArray(seg.contributingSignals));
    });
  });

  await t.test('5. Reconstructing Focus Replay and Activity Breakdown from persisted segments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${createdSessionId}`,
      headers: { cookie: cookieA },
    });

    const { session, activitySegments } = JSON.parse(res.payload);

    // 1. Reconstruct Focus Replay
    const replay = calculateFocusReplayMetrics(activitySegments, {
      actualSecondsSpent: Math.round((session.actualDurationMs || 0) / 1000),
      targetMinutes: Math.round((session.plannedDurationMs || 0) / 60000),
    });

    assert.equal(replay.hasData, true, 'Focus Replay must have data from persisted segments');
    assert.equal(replay.sessionDurationMin, 50);
    // 20 min coding + 25 min study = 45 min focused
    assert.equal(replay.focusedTimeMin, 45);
    assert.equal(replay.focusPoints, 45);
    // 2 interruptions: PHONE_ACTIVITY and AWAY_OR_NOT_VISIBLE
    assert.equal(replay.totalInterruptions, 2);

    // 2. Reconstruct Deep Work Blocks
    const deepWork = calculateDeepWorkBlocks(activitySegments, session);
    assert.equal(deepWork.hasData, true, 'Deep Work must have data');
    assert.equal(deepWork.deepWorkBlocksCount, 2, '2 distinct qualifying focus blocks');
    assert.equal(deepWork.longestBlockSec, 1500, 'Longest block is 25m study = 1500s');

    // 3. Reconstruct Activity Duration Breakdown & Percentages
    const merged = mergeAdjacentSegments(activitySegments);
    assert.equal(merged.length, 4);
    const durations = calculateActivityDurations(merged);
    assert.equal(durations.CODING, 1200);
    assert.equal(durations.PHONE_ACTIVITY, 180);
    assert.equal(durations.STUDY_LIKE, 1500);
    assert.equal(durations.AWAY_OR_NOT_VISIBLE, 120);

    const percentages = calculateActivityPercentages(durations, 3000);
    assert.equal(percentages.CODING, 40); // 1200/3000 = 40%
    assert.equal(percentages.STUDY_LIKE, 50); // 1500/3000 = 50%
    assert.equal(percentages.PHONE_ACTIVITY, 6); // 180/3000 = 6%
    assert.equal(percentages.AWAY_OR_NOT_VISIBLE, 4); // 120/3000 = 4%
    // 40 + 50 + 6 + 4 = 100%
    assert.equal(percentages.CODING + percentages.STUDY_LIKE + percentages.PHONE_ACTIVITY + percentages.AWAY_OR_NOT_VISIBLE, 100);
  });

  await t.test('6. Simulated Next-Day / Page Refresh retrieval from History list', async () => {
    // 1. Fetch History list (like SessionHistoryPage)
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie: cookieA },
    });

    assert.equal(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    assert.ok(listBody.sessions.length >= 1);
    const foundSessionSummary = listBody.sessions.find(s => s.id === createdSessionId);
    assert.ok(foundSessionSummary, 'Created session must appear in History list');

    // 2. Fetch full session details by ID (like handleSelectHistoricalSession)
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${foundSessionSummary.id}`,
      headers: { cookie: cookieA },
    });

    assert.equal(detailRes.statusCode, 200);
    const detailBody = JSON.parse(detailRes.payload);

    // 3. Confirm all segments survived and are not empty
    assert.ok(detailBody.activitySegments.length === 4, 'All 4 segments must survive');
    assert.equal(detailBody.session.status, 'COMPLETED');
    assert.equal(detailBody.session.goalText, 'Build historical persistence layer');

    // 4. Confirm Focus Replay still computes identically
    const replay = calculateFocusReplayMetrics(detailBody.activitySegments, {
      actualSecondsSpent: Math.round((detailBody.session.actualDurationMs || 0) / 1000),
    });
    assert.equal(replay.focusedTimeMin, 45);
    assert.equal(replay.totalInterruptions, 2);
  });

  await t.test('7. Strict User Isolation / IDOR Security Protection', async () => {
    // User B attempts to access User A's session details and activity segments
    const idorGet = await app.inject({
      method: 'GET',
      url: `/api/sessions/${createdSessionId}`,
      headers: { cookie: cookieB },
    });
    assert.equal(idorGet.statusCode, 404, 'User B must NOT be able to view User A session details');

    // User B attempts to append segments to User A's session
    const idorPost = await app.inject({
      method: 'POST',
      url: `/api/sessions/${createdSessionId}/segments`,
      headers: { cookie: cookieB },
      payload: {
        segments: [{
          activityType: 'CODING',
          startTimeMs: Date.now(),
          endTimeMs: Date.now() + 60000,
          durationMs: 60000,
          evidenceScore: 0.9,
        }],
      },
    });
    assert.equal(idorPost.statusCode, 404, 'User B must NOT be able to add segments to User A session');

    // User B attempts to mutate User A's session status
    const idorPut = await app.inject({
      method: 'PUT',
      url: `/api/sessions/${createdSessionId}`,
      headers: { cookie: cookieB },
      payload: { status: 'CANCELLED' },
    });
    assert.equal(idorPut.statusCode, 404, 'User B must NOT be able to update User A session');
  });

  await t.test('8. Empty / Zero-segment historical session loads safely', async () => {
    // Create an empty session with no segments
    const emptyRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1500000,
        selectedActivity: 'Quick Checkin',
      },
    });
    const emptySessionId = JSON.parse(emptyRes.payload).session.id;

    const getEmptyRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${emptySessionId}`,
      headers: { cookie: cookieA },
    });

    assert.equal(getEmptyRes.statusCode, 200);
    const emptyBody = JSON.parse(getEmptyRes.payload);
    assert.equal(emptyBody.activitySegments.length, 0);

    // Verify Focus Replay does not crash on empty segments
    const replay = calculateFocusReplayMetrics(emptyBody.activitySegments, {
      actualSecondsSpent: 0,
      targetMinutes: 25,
    });
    assert.equal(replay.hasData, false);
    assert.equal(replay.focusedTimeMin, 0);

    // Verify Breakdown does not produce NaN/Infinity
    const durations = calculateActivityDurations(emptyBody.activitySegments);
    const percentages = calculateActivityPercentages(durations, 0);
    Object.values(percentages).forEach(p => {
      assert.equal(p, 0);
      assert.ok(Number.isFinite(p));
    });
  });
});
