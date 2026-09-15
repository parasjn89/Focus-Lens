import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { calculateConsistencyMetrics, getLocalDateString } from '../utils/consistencyEngine.js';

test('FocusLens Consistency & Streaks Test Suite', async (t) => {
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
        name: 'Streak User A',
        username: `streak_usera_${suffix}`,
        email: `streak_usera_${suffix}@example.com`,
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
        name: 'Streak User B',
        username: `streak_userb_${suffix}`,
        email: `streak_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Empty history returns 0 streaks and initial state', () => {
    const metrics = calculateConsistencyMetrics([], new Map(), 0);
    assert.equal(metrics.currentStreak, 0);
    assert.equal(metrics.bestStreak, 0);
    assert.equal(metrics.todayFocused, false);
    assert.equal(metrics.thisWeek.focusDays, 0);
    assert.equal(metrics.thisMonth.focusDays, 0);
    assert.equal(metrics.calendar.length, 30);
  });

  await t.test('2. First qualifying session creates first streak day', () => {
    const todayStr = getLocalDateString(new Date(), 0);
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 1);
    assert.equal(metrics.bestStreak, 1);
    assert.equal(metrics.todayFocused, true);
    assert.equal(metrics.thisWeek.focusDays, 1);
  });

  await t.test('3. Two consecutive days yield current streak of 2', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: now.toISOString() },
      { id: 's2', status: 'COMPLETED', startedAt: yesterday.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1200000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 2);
    assert.equal(metrics.bestStreak, 2);
  });

  await t.test('4. Broken streak resets current streak but preserves best streak', () => {
    const now = new Date();
    const day1 = new Date(now.getTime() - 86400000 * 4);
    const day2 = new Date(now.getTime() - 86400000 * 3);
    const day3 = new Date(now.getTime() - 86400000 * 2);
    // Gap on yesterday
    const today = now;

    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: day1.toISOString() },
      { id: 's2', status: 'COMPLETED', startedAt: day2.toISOString() },
      { id: 's3', status: 'COMPLETED', startedAt: day3.toISOString() },
      { id: 's4', status: 'COMPLETED', startedAt: today.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s4', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 1);
    assert.equal(metrics.bestStreak, 3);
  });

  await t.test('5. Multiple sessions on the same calendar day count as 1 focus day', () => {
    const now = new Date();
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: new Date(now.getTime() - 3600000 * 5).toISOString() },
      { id: 's2', status: 'COMPLETED', startedAt: new Date(now.getTime() - 3600000 * 3).toISOString() },
      { id: 's3', status: 'COMPLETED', startedAt: now.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1000000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1000000 }]);
    segmentMap.set('s3', [{ activityType: 'STUDY_LIKE', durationMs: 1000000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 1);
    assert.equal(metrics.thisWeek.focusDays, 1);

    const todayStr = getLocalDateString(now, 0);
    const todayCal = metrics.calendar.find(c => c.date === todayStr);
    assert.ok(todayCal);
    assert.equal(todayCal.sessionCount, 3);
    assert.equal(todayCal.focused, true);
  });

  await t.test('6. Zero-focus session (0 qualifying focus time) does not qualify', () => {
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    // Only phone activity or away activity, 0 STUDY_LIKE or CODING
    segmentMap.set('s1', [{ activityType: 'PHONE_ACTIVITY', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 0);
    assert.equal(metrics.todayFocused, false);
  });

  await t.test('7. Incomplete session (status !== COMPLETED) does not qualify', () => {
    const sessions = [
      { id: 's1', status: 'ACTIVE', startedAt: new Date().toISOString() },
      { id: 's2', status: 'PAUSED', startedAt: new Date().toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    segmentMap.set('s2', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 0);
    assert.equal(metrics.todayFocused, false);
  });

  await t.test('8. Duplicate finalization is idempotent (dynamic calculation)', () => {
    const now = new Date();
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: now.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const run1 = calculateConsistencyMetrics(sessions, segmentMap, 0);
    const run2 = calculateConsistencyMetrics(sessions, segmentMap, 0);

    assert.equal(run1.currentStreak, 1);
    assert.equal(run2.currentStreak, 1);
    assert.deepEqual(run1, run2);
  });

  await t.test('9. Weekly consistency calculation (Mon -> Sun)', () => {
    const now = new Date();
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: now.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.thisWeek.focusDays, 1);
    assert.ok(metrics.thisWeek.eligibleDays >= 1 && metrics.thisWeek.eligibleDays <= 7);
  });

  await t.test('10. Monthly consistency uses elapsed eligible days so far', () => {
    const now = new Date();
    const sessions = [
      { id: 's1', status: 'COMPLETED', startedAt: now.toISOString() },
    ];
    const segmentMap = new Map();
    segmentMap.set('s1', [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.thisMonth.focusDays, 1);
    assert.equal(metrics.thisMonth.eligibleDays, now.getDate());
  });

  await t.test('11. Milestone detection (3, 7, 14, 30, 60, 100 days)', () => {
    const now = new Date();
    const sessions = [];
    const segmentMap = new Map();

    for (let i = 0; i < 7; i++) {
      const sId = `s_m_${i}`;
      const d = new Date(now.getTime() - i * 86400000);
      sessions.push({ id: sId, status: 'COMPLETED', startedAt: d.toISOString() });
      segmentMap.set(sId, [{ activityType: 'STUDY_LIKE', durationMs: 1500000 }]);
    }

    const metrics = calculateConsistencyMetrics(sessions, segmentMap, 0);
    assert.equal(metrics.currentStreak, 7);
    assert.ok(metrics.recentMilestone);
    assert.equal(metrics.recentMilestone.days, 7);
    assert.ok(metrics.recentMilestone.message.includes('7-day streak reached'));
  });

  await t.test('12. Timezone boundary test with X-Timezone-Offset', () => {
    // Session created near UTC midnight (e.g. 23:30 UTC)
    const d = new Date('2026-09-15T23:30:00.000Z');
    
    // In UTC (offset 0), local date is 2026-09-15
    const dateUtc = getLocalDateString(d, 0);
    assert.equal(dateUtc, '2026-09-15');

    // In India UTC+5:30 (offset -330 minutes), local date is 2026-09-16 (05:00 AM next day)
    const dateIst = getLocalDateString(d, -330);
    assert.equal(dateIst, '2026-09-16');
  });

  await t.test('13. Endpoint GET /api/analytics/consistency requires auth (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/consistency',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('14. User A consistency API returns accurate data', async () => {
    const sId = crypto.randomUUID();
    await dbStore.createSession({
      id: sId,
      userId: userAId,
      plannedDurationMs: 1500000,
      actualDurationMs: 1500000,
      selectedActivity: 'Coding',
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    });
    await dbStore.saveSegments(sId, userAId, [
      {
        activityType: 'CODING',
        startTimeMs: Date.now() - 1500000,
        endTimeMs: Date.now(),
        durationMs: 1500000,
        evidenceScore: 0.9,
      }
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/consistency',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.currentStreak, 1);
    assert.equal(body.bestStreak, 1);
    assert.equal(body.todayFocused, true);
    assert.ok(Array.isArray(body.calendar));
  });

  await t.test('15. Strict User Isolation: User B cannot see User A data', async () => {
    const resB = await app.inject({
      method: 'GET',
      url: '/api/analytics/consistency',
      headers: { cookie: cookieB },
    });

    assert.equal(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    assert.equal(bodyB.currentStreak, 0);
    assert.equal(bodyB.todayFocused, false);
    assert.equal(bodyB.thisWeek.focusDays, 0);
  });

  await t.test('16. Calendar data structure contains date, focused, sessionCount, qualifyingFocusSeconds', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/consistency',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.calendar.length > 0);
    
    const day = body.calendar[0];
    assert.ok(typeof day.date === 'string');
    assert.ok(typeof day.focused === 'boolean');
    assert.ok(typeof day.sessionCount === 'number');
    assert.ok(typeof day.qualifyingFocusSeconds === 'number');
  });
});
