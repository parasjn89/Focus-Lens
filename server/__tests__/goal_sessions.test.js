import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { calculateDeepWorkBlocks } from '../../src/utils/deepWork.js';

test('FocusLens Goal-Based Sessions Test Suite', async (t) => {
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
        name: 'Goal User A',
        username: `goal_usera_${suffix}`,
        email: `goal_usera_${suffix}@example.com`,
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
        name: 'Goal User B',
        username: `goal_userb_${suffix}`,
        email: `goal_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Create session with no goal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1500000,
        selectedActivity: 'General Study',
        goalType: 'NONE',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.session);
    assert.equal(body.session.goalType, 'NONE');
    assert.equal(body.session.goalText, null);
    assert.equal(body.session.goalProgress, 0);
  });

  await t.test('2. Create TIME goal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 2700000,
        selectedActivity: 'JavaScript DOM',
        goalText: 'Study JavaScript DOM for 45 minutes',
        goalType: 'TIME',
        targetValue: 45,
        targetUnit: 'minutes',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.session.goalType, 'TIME');
    assert.equal(body.session.goalText, 'Study JavaScript DOM for 45 minutes');
    assert.equal(body.session.targetValue, 45);
    assert.equal(body.session.targetUnit, 'minutes');
  });

  await t.test('3. Create COUNT goal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 3600000,
        selectedActivity: 'DSA Practice',
        goalText: 'Solve 5 DSA binary search questions',
        goalType: 'COUNT',
        targetValue: 5,
        targetUnit: 'questions',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.equal(body.session.goalType, 'COUNT');
    assert.equal(body.session.goalText, 'Solve 5 DSA binary search questions');
    assert.equal(body.session.targetValue, 5);
    assert.equal(body.session.targetUnit, 'questions');
    assert.equal(body.session.goalProgress, 0);
  });

  await t.test('4. Invalid empty goal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Study Math',
        goalText: '   ',
        goalType: 'TIME',
        targetValue: 30,
      },
    });

    assert.equal(res.statusCode, 400);
  });

  await t.test('5. Invalid target (negative / zero)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Study Math',
        goalText: 'Study Math',
        goalType: 'TIME',
        targetValue: -10,
      },
    });

    assert.equal(res.statusCode, 400);
  });

  await t.test('6. Invalid goal type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Study Math',
        goalText: 'Study Math',
        goalType: 'INVALID_GOAL_TYPE',
        targetValue: 30,
      },
    });

    assert.equal(res.statusCode, 400);
  });

  await t.test('7. TIME goal without target', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Study Physics',
        goalText: 'Study Physics',
        goalType: 'TIME',
        targetValue: null,
      },
    });

    assert.equal(res.statusCode, 400);
  });

  await t.test('8. COUNT goal with decimal target', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Solve Problems',
        goalText: 'Solve Problems',
        goalType: 'COUNT',
        targetValue: 3.5,
        targetUnit: 'problems',
      },
    });

    assert.equal(res.statusCode, 400);
  });

  await t.test('9. Progress update for COUNT goal', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 3600000,
        selectedActivity: 'Solve Problems',
        goalText: 'Solve 5 problems',
        goalType: 'COUNT',
        targetValue: 5,
        targetUnit: 'problems',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    const progRes = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/progress`,
      headers: { cookie: cookieA },
      payload: { goalProgress: 3 },
    });

    assert.equal(progRes.statusCode, 200);
    const body = JSON.parse(progRes.payload);
    assert.equal(body.session.goalProgress, 3);
    assert.equal(body.session.goalCompleted, false);
  });

  await t.test('10. Progress cannot exceed target', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 3600000,
        selectedActivity: 'Solve Problems',
        goalText: 'Solve 5 problems',
        goalType: 'COUNT',
        targetValue: 5,
        targetUnit: 'problems',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    // Try setting progress to 8 (exceeds 5)
    const progRes = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/progress`,
      headers: { cookie: cookieA },
      payload: { goalProgress: 8 },
    });

    assert.equal(progRes.statusCode, 200);
    const body = JSON.parse(progRes.payload);
    // Should be clamped to target (5)
    assert.equal(body.session.goalProgress, 5);
    assert.equal(body.session.goalCompleted, true);
  });

  await t.test('11. Cross-user goal session access (IDOR protection)', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'User A Session',
        goalText: 'User A Secret Goal',
        goalType: 'TIME',
        targetValue: 30,
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    // User B attempts to access User A's goal session
    const idorGet = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { cookie: cookieB },
    });
    assert.equal(idorGet.statusCode, 404);

    // User B attempts to update User A's session progress
    const idorPatch = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionId}/progress`,
      headers: { cookie: cookieB },
      payload: { goalProgress: 1 },
    });
    assert.equal(idorPatch.statusCode, 404);
  });

  await t.test('12. Old session without goal still loads', async () => {
    const oldSessionId = crypto.randomUUID();
    await dbStore.createSession({
      id: oldSessionId,
      userId: userAId,
      plannedDurationMs: 1500000,
      startedAt: new Date().toISOString(),
      status: 'COMPLETED',
      selectedActivity: 'Legacy Study',
      goalType: 'NONE',
      goalText: null,
      targetValue: null,
      targetUnit: null,
      goalCompleted: false,
      goalProgress: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${oldSessionId}`,
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.session.id, oldSessionId);
    assert.equal(body.session.goalType, 'NONE');
  });

  await t.test('13. Duplicate session finalization does not duplicate progress or focus points', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 1800000,
        selectedActivity: 'Solve Problems',
        goalText: 'Solve 2 problems',
        goalType: 'COUNT',
        targetValue: 2,
        targetUnit: 'problems',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    await dbStore.saveSegments(sessionId, userAId, [
      {
        activityType: 'STUDY_LIKE',
        startTimeMs: Date.now() - 1200000,
        endTimeMs: Date.now(),
        durationMs: 1200000,
        evidenceScore: 0.9,
      }
    ]);

    // First finalization
    const fin1 = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/finalize`,
      headers: { cookie: cookieA },
      payload: { goalProgress: 2 },
    });
    assert.equal(fin1.statusCode, 200);
    const body1 = JSON.parse(fin1.payload);

    // Second finalization
    const fin2 = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/finalize`,
      headers: { cookie: cookieA },
      payload: { goalProgress: 2 },
    });
    assert.equal(fin2.statusCode, 200);
    const body2 = JSON.parse(fin2.payload);

    assert.equal(body1.session.focusPoints, body2.session.focusPoints);
    assert.equal(body1.session.goalProgress, body2.session.goalProgress);
    assert.equal(body1.session.goalCompleted, body2.session.goalCompleted);
  });

  await t.test('14. TIME goal progress uses qualifying focus time', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 2700000,
        selectedActivity: 'Study Math',
        goalText: 'Study 45 minutes',
        goalType: 'TIME',
        targetValue: 45,
        targetUnit: 'minutes',
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    // Save 30 mins of STUDY_LIKE qualifying activity segments
    await dbStore.saveSegments(sessionId, userAId, [
      {
        activityType: 'STUDY_LIKE',
        startTimeMs: Date.now() - 1800000,
        endTimeMs: Date.now(),
        durationMs: 1800000, // 30 mins
        evidenceScore: 0.9,
      }
    ]);

    const finRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/finalize`,
      headers: { cookie: cookieA },
      payload: {},
    });

    assert.equal(finRes.statusCode, 200);
    const body = JSON.parse(finRes.payload);
    // 30 mins / 45 mins target = 67% progress
    assert.equal(body.session.goalProgress, 67);
    assert.equal(body.session.goalCompleted, false);
  });

  await t.test('15. Focus Points remain correct', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        plannedDurationMs: 2700000,
        selectedActivity: 'Study Physics',
        goalText: 'Study 45 minutes',
        goalType: 'TIME',
        targetValue: 45,
      },
    });
    assert.equal(createRes.statusCode, 201);
    const sessionId = JSON.parse(createRes.payload).session.id;

    // Save 30 mins of STUDY_LIKE qualifying activity segments
    await dbStore.saveSegments(sessionId, userAId, [
      {
        activityType: 'STUDY_LIKE',
        startTimeMs: Date.now() - 1800000,
        endTimeMs: Date.now(),
        durationMs: 1800000, // 30 mins
        evidenceScore: 0.9,
      }
    ]);

    const finRes = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/finalize`,
      headers: { cookie: cookieA },
      payload: {},
    });

    assert.equal(finRes.statusCode, 200);
    const body = JSON.parse(finRes.payload);
    assert.equal(body.session.focusPoints, 30);
  });

  await t.test('16. Deep Work calculation remains unchanged', () => {
    const baseTime = Date.now();
    const segments = [
      { activityType: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 1200000, durationMs: 1200000 },
      { activityType: 'PHONE_ACTIVITY', startTime: baseTime + 1200000, endTime: baseTime + 1380000, durationMs: 180000 },
      { activityType: 'CODING', startTime: baseTime + 1380000, endTime: baseTime + 3000000, durationMs: 1620000 },
    ];

    const dwResult = calculateDeepWorkBlocks(segments);
    assert.equal(dwResult.deepWorkBlocksCount, 2);
    assert.equal(dwResult.longestBlockSec, 1620); // 27m coding block
    assert.equal(dwResult.totalDeepWorkSec, 2820); // 47m total
  });
});
