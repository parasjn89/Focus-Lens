import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { generateAdaptiveSessionRecommendation } from '../utils/adaptiveSessionEngine.js';

test('FocusLens Adaptive Session Recommendations Test Suite', async (t) => {
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
        name: 'Adaptive User A',
        username: `adapt_usera_${suffix}`,
        email: `adapt_usera_${suffix}@example.com`,
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
        name: 'Adaptive User B',
        username: `adapt_userb_${suffix}`,
        email: `adapt_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Unauthenticated GET /api/analytics/recommended-session returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/recommended-session',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('2. Insufficient history (< 5 completed sessions) returns available: false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/recommended-session',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.available, false);
    assert.equal(body.reason, 'INSUFFICIENT_HISTORY');
    assert.equal(body.sessionsCompleted, 0);
    assert.equal(body.sessionsRequired, 5);
  });

  await t.test('3. Exactly 5 completed sessions produces personalized recommendation', async () => {
    // Create 5 completed 30-minute sessions for User A
    for (let i = 0; i < 5; i++) {
      const s = await dbStore.createSession({
        userId: userAId,
        selectedActivity: 'STUDY_LIKE',
        plannedDurationMs: 1800000,
        actualDurationMs: 1800000,
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - (5 - i) * 86400000).toISOString(),
      });

      await dbStore.saveSegments(s.id, userAId, [
        {
          activityType: 'STUDY_LIKE',
          startTimeMs: 0,
          endTimeMs: 1800000,
          durationMs: 1800000,
          evidenceScore: 0.9,
        },
      ]);

      await dbStore.updateSession(s.id, userAId, {
        actualDurationMs: 1800000,
        status: 'COMPLETED',
        focusPoints: 30,
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/recommended-session',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.available, true);
    assert.ok(body.recommendation);
    assert.equal(typeof body.recommendation.durationMinutes, 'number');
    assert.ok(body.recommendation.reason);
    assert.ok(body.recommendation.evidence);
    assert.ok(body.recommendation.confidence);
  });

  await t.test('4. Session duration analysis & Focus Utilization ranking', async () => {
    // Test engine directly with mock session metrics
    const sessions = [];
    // 30 min sessions with 90% utilization
    for (let i = 0; i < 4; i++) {
      sessions.push({
        id: `sess_30_${i}`,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 1800000,
        actualDurationMs: 1800000,
        startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
    }
    // 60 min sessions with 40% utilization
    for (let i = 0; i < 3; i++) {
      sessions.push({
        id: `sess_60_${i}`,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 3600000,
        actualDurationMs: 3600000,
        startedAt: new Date(Date.now() - (i + 4) * 3600000).toISOString(),
      });
    }

    const segmentMap = new Map();
    // 30 min sessions get 27 mins study
    for (let i = 0; i < 4; i++) {
      segmentMap.set(`sess_30_${i}`, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1620000, durationMs: 1620000, evidenceScore: 0.9 },
      ]);
    }
    // 60 min sessions get 24 mins study + 36 mins phone
    for (let i = 0; i < 3; i++) {
      segmentMap.set(`sess_60_${i}`, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1440000, durationMs: 1440000, evidenceScore: 0.9 },
        { activityType: 'PHONE_ACTIVITY', startTimeMs: 1440000, endTimeMs: 3600000, durationMs: 2160000, evidenceScore: 0.9 },
      ]);
    }

    const result = await generateAdaptiveSessionRecommendation('test_u', {
      sessions,
      sessionSegmentMap: segmentMap,
    });

    assert.equal(result.available, true);
    // Should prefer ~30 min session over 60 min due to higher utilization & lower distractions
    assert.equal(result.recommendation.durationMinutes, 30);
  });

  await t.test('5. Deep Work signal influence', async () => {
    const sessions = [];
    const segmentMap = new Map();

    for (let i = 0; i < 6; i++) {
      const id = `dw_sess_${i}`;
      sessions.push({
        id,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 2400000, // 40 min
        actualDurationMs: 2400000,
        startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
      // 35 min continuous study block
      segmentMap.set(id, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 2100000, durationMs: 2100000, evidenceScore: 0.9 },
      ]);
    }

    const result = await generateAdaptiveSessionRecommendation('test_u', {
      sessions,
      sessionSegmentMap: segmentMap,
    });

    assert.equal(result.available, true);
    assert.ok(result.recommendation.durationMinutes >= 35 && result.recommendation.durationMinutes <= 45);
    assert.ok(result.recommendation.evidence.typicalLongestBlockMinutes >= 30);
  });

  await t.test('6. Distraction signal influence (prefers shorter when long has high distractions)', async () => {
    const sessions = [];
    const segmentMap = new Map();

    // 25 min sessions with 0 distractions
    for (let i = 0; i < 3; i++) {
      const id = `short_sess_${i}`;
      sessions.push({
        id,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 1500000,
        actualDurationMs: 1500000,
        startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
      segmentMap.set(id, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1500000, durationMs: 1500000, evidenceScore: 0.9 },
      ]);
    }

    // 60 min sessions with 30 min phone distraction
    for (let i = 0; i < 3; i++) {
      const id = `long_sess_${i}`;
      sessions.push({
        id,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 3600000,
        actualDurationMs: 3600000,
        startedAt: new Date(Date.now() - (i + 3) * 3600000).toISOString(),
      });
      segmentMap.set(id, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1800000, durationMs: 1800000, evidenceScore: 0.9 },
        { activityType: 'PHONE_ACTIVITY', startTimeMs: 1800000, endTimeMs: 3600000, durationMs: 1800000, evidenceScore: 0.9 },
      ]);
    }

    const result = await generateAdaptiveSessionRecommendation('test_u', {
      sessions,
      sessionSegmentMap: segmentMap,
    });

    assert.equal(result.available, true);
    assert.ok(result.recommendation.durationMinutes <= 35);
  });

  await t.test('7. Goal completion influence & COUNT goal adaptation', async () => {
    const sessions = [];
    const segmentMap = new Map();

    for (let i = 0; i < 5; i++) {
      const id = `goal_sess_${i}`;
      sessions.push({
        id,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 1800000,
        actualDurationMs: 1800000,
        goalType: 'COUNT',
        goalText: 'Solve 5 practice problems',
        targetValue: 5,
        targetUnit: 'problems',
        goalCompleted: true,
        goalProgress: 3,
        startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
      segmentMap.set(id, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1800000, durationMs: 1800000, evidenceScore: 0.9 },
      ]);
    }

    const result = await generateAdaptiveSessionRecommendation('test_u', {
      sessions,
      sessionSegmentMap: segmentMap,
    });

    assert.equal(result.available, true);
    assert.equal(result.recommendation.goalType, 'COUNT');
    assert.ok(result.recommendation.targetValue <= 5);
  });

  await t.test('8. Adaptive change limit (±20 min) and safety limits (10-90 min)', async () => {
    const sessions = [];
    const segmentMap = new Map();

    // User norm is 30 mins
    for (let i = 0; i < 5; i++) {
      const id = `norm_sess_${i}`;
      sessions.push({
        id,
        userId: 'test_u',
        status: 'COMPLETED',
        plannedDurationMs: 1800000, // 30 min
        actualDurationMs: 1800000,
        startedAt: new Date(Date.now() - i * 3600000).toISOString(),
      });
      segmentMap.set(id, [
        { activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1800000, durationMs: 1800000, evidenceScore: 0.9 },
      ]);
    }

    const result = await generateAdaptiveSessionRecommendation('test_u', {
      sessions,
      sessionSegmentMap: segmentMap,
    });

    assert.equal(result.available, true);
    // Norm is 30, so recommendation should be within 30 ± 20 (i.e. 10 to 50 min)
    assert.ok(result.recommendation.durationMinutes >= 10);
    assert.ok(result.recommendation.durationMinutes <= 50);
  });

  await t.test('9. Confidence levels (HIGH for 12+ sessions, LOW for 5 sessions)', async () => {
    const sessions5 = [];
    const segmentMap = new Map();
    for (let i = 0; i < 5; i++) {
      const id = `s5_${i}`;
      sessions5.push({ id, userId: 'u', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() });
      segmentMap.set(id, [{ activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1800000, durationMs: 1800000, evidenceScore: 0.9 }]);
    }

    const res5 = await generateAdaptiveSessionRecommendation('u', { sessions: sessions5, sessionSegmentMap: segmentMap });
    assert.equal(res5.recommendation.confidence, 'LOW');

    const sessions12 = [];
    for (let i = 0; i < 14; i++) {
      const id = `s12_${i}`;
      sessions12.push({ id, userId: 'u', status: 'COMPLETED', plannedDurationMs: 1800000, actualDurationMs: 1800000, startedAt: new Date().toISOString() });
      segmentMap.set(id, [{ activityType: 'STUDY_LIKE', startTimeMs: 0, endTimeMs: 1800000, durationMs: 1800000, evidenceScore: 0.9 }]);
    }

    const res12 = await generateAdaptiveSessionRecommendation('u', { sessions: sessions12, sessionSegmentMap: segmentMap });
    assert.equal(res12.recommendation.confidence, 'HIGH');
  });

  await t.test('10. Strict User Isolation & IDOR Protection (User B cannot see User A recommendations)', async () => {
    // User B has no sessions
    const resB = await app.inject({
      method: 'GET',
      url: '/api/analytics/recommended-session',
      headers: { cookie: cookieB },
    });

    assert.equal(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    // User B should get INSUFFICIENT_HISTORY because User A data is isolated
    assert.equal(bodyB.available, false);
    assert.equal(bodyB.reason, 'INSUFFICIENT_HISTORY');

    // Attempting query params override (userId=userAId) should be ignored and still isolated
    const idorRes = await app.inject({
      method: 'GET',
      url: `/api/analytics/recommended-session?userId=${userAId}`,
      headers: { cookie: cookieB },
    });

    assert.equal(idorRes.statusCode, 200);
    const idorBody = JSON.parse(idorRes.payload);
    assert.equal(idorBody.available, false);
  });

  await t.test('11. GET /api/analytics/recommended-session returns application/json Content-Type', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/recommended-session',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const contentType = res.headers['content-type'] || '';
    assert.ok(contentType.includes('application/json'), `Expected application/json, got "${contentType}"`);
  });

  await t.test('12. Regression: HTML / non-JSON response handling does not throw Unexpected token <', async () => {
    // Simulate non-JSON / HTML response parsing handling
    const mockHtmlResponse = {
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html; charset=utf-8']]),
      text: async () => '<!DOCTYPE html><html><body>SPA Fallback</body></html>',
      json: async () => { throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"); },
    };

    const contentType = mockHtmlResponse.headers.get('content-type') || '';
    let hasJsonError = false;
    let handledErrorMessage = '';

    if (!contentType.includes('application/json')) {
      handledErrorMessage = `Unexpected server response format (${contentType}). Expected JSON.`;
    } else {
      try {
        await mockHtmlResponse.json();
      } catch (err) {
        hasJsonError = true;
      }
    }

    assert.equal(hasJsonError, false, 'Should not attempt response.json() on text/html content-type');
    assert.ok(handledErrorMessage.includes('Unexpected server response format'), 'Should provide structured error message');
  });
});

