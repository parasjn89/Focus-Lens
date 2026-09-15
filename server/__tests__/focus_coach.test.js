import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { generateFocusCoachAnalysis } from '../utils/focusCoachEngine.js';

test('FocusLens Focus Coach Test Suite', async (t) => {
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
        name: 'Coach User A',
        username: `coach_usera_${suffix}`,
        email: `coach_usera_${suffix}@example.com`,
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
        name: 'Coach User B',
        username: `coach_userb_${suffix}`,
        email: `coach_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Fewer than 3 completed sessions yields insufficientData state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-coach',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.insufficientData, true);
    assert.ok(body.message.includes('Complete a few more sessions'));
  });

  await t.test('2. Enough session history (>= 3 completed sessions) generates recommendations', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const sId = crypto.randomUUID();
      await dbStore.createSession({
        id: sId,
        userId: userAId,
        plannedDurationMs: 1500000,
        actualDurationMs: 1500000,
        selectedActivity: 'Coding',
        status: 'COMPLETED',
        startedAt: new Date(now - i * 86400000).toISOString(),
      });
      await dbStore.saveSegments(sId, userAId, [
        {
          activityType: 'CODING',
          startTimeMs: now - i * 86400000,
          endTimeMs: now - i * 86400000 + 1500000,
          durationMs: 1500000,
          evidenceScore: 0.9,
        }
      ]);
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-coach',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.insufficientData, false);
    assert.ok(body.recommendation);
    assert.ok(body.reason);
    assert.ok(body.suggestedSession);
  });

  await t.test('3. Phone distraction rule triggers when phone activity is frequent', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 300000 }]);
    segmentMap.set('s2', [{ activityType: 'PHONE_ACTIVITY', durationMs: 300000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.insufficientData, false);
    assert.equal(result.primary.category, 'PHONE_DISTRACTION');
    assert.ok(result.primary.recommendation.includes('phone out of reach'));
  });

  await t.test('4. Looking-away rule triggers when away events are frequent', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'AWAY_OR_NOT_VISIBLE', durationMs: 300000 }]);
    segmentMap.set('s2', [{ activityType: 'AWAY_OR_NOT_VISIBLE', durationMs: 300000 }]);
    segmentMap.set('s3', [{ activityType: 'AWAY_OR_NOT_VISIBLE', durationMs: 300000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'LOOKING_AWAY');
    assert.ok(result.primary.recommendation.includes('simpler workspace'));
  });

  await t.test('5. Non-study screen rule triggers when unclassified screen activity is high', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'UNKNOWN', durationMs: 600000 }]);
    segmentMap.set('s2', [{ activityType: 'UNKNOWN', durationMs: 600000 }]);
    segmentMap.set('s3', [{ activityType: 'UNKNOWN', durationMs: 600000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'NON_STUDY_SCREEN');
    assert.ok(result.primary.recommendation.includes('Define the exact screen task'));
  });

  await t.test('6. Speech-like rule triggers when speech activity is detected', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'SPEECH_LIKE', durationMs: 300000 }]);
    segmentMap.set('s2', [{ activityType: 'SPEECH_LIKE', durationMs: 300000 }]);
    segmentMap.set('s3', [{ activityType: 'SPEECH_LIKE', durationMs: 300000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'SPEECH_LIKE');
    assert.ok(result.primary.recommendation.includes('quieter environment'));
  });

  await t.test('7. Multiple-people rule triggers when multiple people signals are present', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1800000, contributingSignals: ['MULTIPLE_PEOPLE_PRESENT'] }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1800000, contributingSignals: ['MULTIPLE_PEOPLE_PRESENT'] }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'MULTIPLE_PEOPLE');
    assert.ok(result.primary.recommendation.includes('quieter or more private workspace'));
  });

  await t.test('8. Goal completion rule triggers when completion rate is low despite high focus', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, goalType: 'COUNT', goalCompleted: false, goalText: 'Study DSA', startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, goalType: 'COUNT', goalCompleted: false, goalText: 'Study Math', startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, goalType: 'COUNT', goalCompleted: true, goalText: 'Study Physics', startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'GOAL_COMPLETION');
    assert.ok(result.primary.recommendation.includes('smaller and more specific'));
  });

  await t.test('9. Deep work rule recommends matching target based on median peak block', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]); // 25m
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]); // 25m
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]); // 25m

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.ok(result.primary);
    assert.equal(result.suggestedSession.durationMinutes, 25);
  });

  await t.test('10. Session length rule recommends shorter session when planned duration >> focused time', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 3600000, actualDurationMs: 3600000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 3600000, actualDurationMs: 3600000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 3600000, actualDurationMs: 3600000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1200000 }]); // 20m focus out of 60m planned
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1200000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1200000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.ok(result.primary);
    assert.equal(result.primary.category, 'SESSION_LENGTH');
    assert.ok(result.suggestedSession.durationMinutes <= 30);
  });

  await t.test('11. Consistency rule evaluates session cadence', () => {
    const now = Date.now();
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1500000, actualDurationMs: 1500000, startedAt: new Date(now).toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1500000, actualDurationMs: 1500000, startedAt: new Date(now - 86400000).toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1500000, actualDurationMs: 1500000, startedAt: new Date(now - 172800000).toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.ok(result.primary);
  });

  await t.test('12. Distraction trend rule compares recent vs older session halves', () => {
    const now = Date.now();
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date(now).toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date(now - 3600000).toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date(now - 86400000 * 5).toISOString() },
      { id: 's4', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date(now - 86400000 * 6).toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 900000 }]);
    segmentMap.set('s2', [{ activityType: 'PHONE_ACTIVITY', durationMs: 900000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s4', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.ok(result.primary);
  });

  await t.test('13. Rule priority selects highest priority recommendation (Phone > Deep Work)', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 600000 }]);
    segmentMap.set('s2', [{ activityType: 'PHONE_ACTIVITY', durationMs: 600000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.equal(result.primary.category, 'PHONE_DISTRACTION');
  });

  await t.test('14. Weak-signal suppression ignores single isolated distraction event', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 10000 }]); // Only 10 seconds in 1 session
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    // Should NOT trigger PHONE_DISTRACTION recommendation due to weak signal
    assert.notEqual(result.primary.category, 'PHONE_DISTRACTION');
  });

  await t.test('15 & 16. User Isolation & IDOR Protection', async () => {
    // Unauthenticated GET /api/analytics/focus-coach -> Expect 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-coach',
    });
    assert.equal(unauthRes.statusCode, 401);

    // User B fetches coach analytics -> User B gets isolated response (empty data for User B)
    const userBRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-coach',
      headers: { cookie: cookieB },
    });
    assert.equal(userBRes.statusCode, 200);
    const bodyB = JSON.parse(userBRes.payload);
    assert.equal(bodyB.insufficientData, true);
    assert.equal(bodyB.generatedFromSessions, 0);
  });

  await t.test('17. Recommended session payload generation', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const result = generateFocusCoachAnalysis(mockSessions, segmentMap);
    assert.ok(result.suggestedSession);
    assert.ok(result.suggestedSession.durationMinutes > 0);
  });

  await t.test('18. Deterministic output verification (same data yields identical result)', () => {
    const mockSessions = [
      { id: 's1', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's2', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
      { id: 's3', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 600000 }]);
    segmentMap.set('s2', [{ activityType: 'PHONE_ACTIVITY', durationMs: 600000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1800000 }]);

    const run1 = generateFocusCoachAnalysis(mockSessions, segmentMap);
    const run2 = generateFocusCoachAnalysis(mockSessions, segmentMap);

    assert.deepEqual(run1, run2);
  });
});
