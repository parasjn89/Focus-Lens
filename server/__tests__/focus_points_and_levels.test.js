import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFocusPointsFromDurations,
  getFocusLevel,
  isQualifyingActivity,
  FOCUS_LEVELS,
} from '../../src/utils/focusPoints.js';
import { dbStore } from '../db/store.js';
import { getPersonalDashboardData } from '../utils/dashboardAnalytics.js';
import { buildApp } from '../app.js';
import { pool } from '../db/client.js';
import crypto from 'crypto';

test('Focus Points & Level System Test Suite', async (t) => {
  let app;

  await t.test('1. Qualifying Activity Classification', () => {
    assert.equal(isQualifyingActivity('STUDY_LIKE'), true);
    assert.equal(isQualifyingActivity('CODING'), true);
    assert.equal(isQualifyingActivity('DOCUMENT_ACTIVITY'), true);
    assert.equal(isQualifyingActivity('PHONE_ACTIVITY'), false);
    assert.equal(isQualifyingActivity('MULTIPLE_PEOPLE'), false);
    assert.equal(isQualifyingActivity('AWAY_OR_NOT_VISIBLE'), false);
    assert.equal(isQualifyingActivity('VIDEO_ACTIVITY'), false);
    assert.equal(isQualifyingActivity('BROWSER_ACTIVITY'), false);
    assert.equal(isQualifyingActivity('SPEECH_LIKE'), false);
    assert.equal(isQualifyingActivity('UNKNOWN'), false);
  });

  await t.test('2. Partial Minute Point Calculation Rules', () => {
    // 0 qualifying seconds -> 0 points
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 0 }).focusPoints, 0);

    // 59 qualifying seconds -> 0 points
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 59 }).focusPoints, 0);

    // 60 qualifying seconds -> 1 point
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 60 }).focusPoints, 1);

    // 119 qualifying seconds -> 1 point
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 119 }).focusPoints, 1);

    // 120 qualifying seconds -> 2 points
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 120 }).focusPoints, 2);

    // 2520 seconds (42 minutes) -> 42 points
    assert.equal(calculateFocusPointsFromDurations({ STUDY_LIKE: 2520 }).focusPoints, 42);
  });

  await t.test('3. Multiple & Fragmented Qualifying Segments Summation', () => {
    const segments = [
      { activityType: 'STUDY_LIKE', durationMs: 40 * 1000 },
      { activityType: 'CODING', durationMs: 50 * 1000 },
      { activityType: 'PHONE_ACTIVITY', durationMs: 300 * 1000 }, // non-qualifying
      { activityType: 'DOCUMENT_ACTIVITY', durationMs: 30 * 1000 },
    ];
    // Total qualifying seconds = 40 + 50 + 30 = 120s -> 2 points
    const res = calculateFocusPointsFromDurations(segments);
    assert.equal(res.qualifyingSeconds, 120);
    assert.equal(res.focusPoints, 2);
  });

  await t.test('4. Non-Qualifying Activity produces 0 points', () => {
    const nonQualifying = {
      PHONE_ACTIVITY: 600,
      MULTIPLE_PEOPLE: 600,
      AWAY_OR_NOT_VISIBLE: 600,
      UNKNOWN: 600,
    };
    const res = calculateFocusPointsFromDurations(nonQualifying);
    assert.equal(res.focusPoints, 0);
  });

  await t.test('5. Exact Level Threshold Boundaries', () => {
    // 0 -> Beginner
    const l0 = getFocusLevel(0);
    assert.equal(l0.level, 'Beginner');

    // 299 -> Beginner
    const l299 = getFocusLevel(299);
    assert.equal(l299.level, 'Beginner');
    assert.equal(l299.nextLevel, 'Focused');
    assert.equal(l299.pointsToNextLevel, 1);

    // 300 -> Focused
    const l300 = getFocusLevel(300);
    assert.equal(l300.level, 'Focused');
    assert.equal(l300.pointsInLevel, 0);
    assert.equal(l300.pointsToNextLevel, 250);

    // 428 -> Focused (128 in level, 122 to Consistent)
    const l428 = getFocusLevel(428);
    assert.equal(l428.level, 'Focused');
    assert.equal(l428.pointsInLevel, 128);
    assert.equal(l428.pointsToNextLevel, 122);
    assert.equal(l428.nextLevel, 'Consistent');

    // 549 -> Focused
    const l549 = getFocusLevel(549);
    assert.equal(l549.level, 'Focused');

    // 550 -> Consistent
    const l550 = getFocusLevel(550);
    assert.equal(l550.level, 'Consistent');

    // 949 -> Consistent
    const l949 = getFocusLevel(949);
    assert.equal(l949.level, 'Consistent');

    // 950 -> Deep Worker
    const l950 = getFocusLevel(950);
    assert.equal(l950.level, 'Deep Worker');

    // 1499 -> Deep Worker
    const l1499 = getFocusLevel(1499);
    assert.equal(l1499.level, 'Deep Worker');

    // 1500 -> Focus Master (Max Level)
    const l1500 = getFocusLevel(1500);
    assert.equal(l1500.level, 'Focus Master');
    assert.equal(l1500.isMaxLevel, true);
    assert.equal(l1500.nextLevel, null);

    // 2000 -> Focus Master
    const l2000 = getFocusLevel(2000);
    assert.equal(l2000.level, 'Focus Master');
    assert.equal(l2000.isMaxLevel, true);
  });

  await t.test('6. Session Finalization & Idempotent Point Awarding', async () => {
    const userA = await dbStore.createUser({
      username: `fp_usera_${Date.now()}`,
      email: `fp_usera_${Date.now()}@example.com`,
      passwordHash: 'hashed_password_123',
    });

    const sessionA = await dbStore.createSession({
      userId: userA.id,
      selectedActivity: 'Coding',
      plannedDurationMs: 25 * 60 * 1000,
    });

    // Save qualifying segments totaling 180 seconds (3 minutes = 3 Focus Points)
    const segs = [
      { activityType: 'CODING', startTimeMs: 1000, endTimeMs: 181000, durationMs: 180000, evidenceScore: 0.9 },
    ];

    await dbStore.saveSegments(sessionA.id, userA.id, segs);

    // Initial Dashboard Check
    const dash1 = await getPersonalDashboardData(userA.id);
    assert.equal(dash1.focusPoints.total, 3, 'User A earns exactly 3 Focus Points');
    assert.equal(dash1.focusPoints.levelInfo.level, 'Beginner');

    // Repeat segment save or dashboard reload (idempotency check)
    const dash2 = await getPersonalDashboardData(userA.id);
    assert.equal(dash2.focusPoints.total, 3, 'Focus Points remain unchanged on dashboard reload');
  });

  await t.test('7. Strict User Data Isolation for Focus Points', async () => {
    const userX = await dbStore.createUser({
      username: `iso_userx_${Date.now()}`,
      email: `iso_userx_${Date.now()}@example.com`,
      passwordHash: 'hashed_pass_123',
    });

    const userY = await dbStore.createUser({
      username: `iso_usery_${Date.now()}`,
      email: `iso_usery_${Date.now()}@example.com`,
      passwordHash: 'hashed_pass_123',
    });

    // User X completes a 6000-second session (100 minutes -> 100 Focus Points)
    const sessX = await dbStore.createSession({ userId: userX.id, selectedActivity: 'Studying', plannedDurationMs: 6000000 });
    await dbStore.saveSegments(sessX.id, userX.id, [
      { activityType: 'STUDY_LIKE', startTimeMs: 1000, endTimeMs: 6001000, durationMs: 6000000, evidenceScore: 0.95 }
    ]);

    // User Y completes a 0-point session
    const sessY = await dbStore.createSession({ userId: userY.id, selectedActivity: 'Studying', plannedDurationMs: 300000 });
    await dbStore.saveSegments(sessY.id, userY.id, [
      { activityType: 'PHONE_ACTIVITY', startTimeMs: 1000, endTimeMs: 301000, durationMs: 300000, evidenceScore: 0.95 }
    ]);

    const dashX = await getPersonalDashboardData(userX.id);
    const dashY = await getPersonalDashboardData(userY.id);

    assert.equal(dashX.focusPoints.total, 100, "User X has 100 Focus Points");
    assert.equal(dashY.focusPoints.total, 0, "User Y has 0 Focus Points");
    assert.notEqual(dashX.focusPoints.total, dashY.focusPoints.total, "User A and User B points are strictly isolated");
  });

  await t.test('8. Three Time Scopes Aggregation (Today, This Week, Lifetime) & Stage Progress', async () => {
    const userC = await dbStore.createUser({
      username: `scopes_user_${Date.now()}`,
      email: `scopes_user_${Date.now()}@example.com`,
      passwordHash: 'hashed_pass_123',
    });

    const now = new Date();
    // 1. Session today: 10 minutes = 10 points
    const sessToday = await dbStore.createSession({
      userId: userC.id,
      selectedActivity: 'Coding',
      plannedDurationMs: 600000,
      startedAt: new Date(now.getTime() - 3600000).toISOString(),
    });
    await dbStore.saveSegments(sessToday.id, userC.id, [
      { activityType: 'CODING', startTimeMs: 1000, endTimeMs: 601000, durationMs: 600000, evidenceScore: 0.9 }
    ]);

    // 2. Session earlier this week (e.g. 1 day ago or at Monday of this week): 20 minutes = 20 points
    // Let's compute a timestamp that is guaranteed to be in the current week (e.g., now - 1 day, or at least >= Monday)
    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    // If today is Monday (daysSinceMonday === 0), earlier session can be 2 hours earlier today, else 1 day earlier
    const earlierMs = daysSinceMonday > 0 ? (now.getTime() - 86400000) : (now.getTime() - 7200000);
    const sessWeek = await dbStore.createSession({
      userId: userC.id,
      selectedActivity: 'Studying',
      plannedDurationMs: 1200000,
      startedAt: new Date(earlierMs).toISOString(),
    });
    await dbStore.saveSegments(sessWeek.id, userC.id, [
      { activityType: 'STUDY_LIKE', startTimeMs: 1000, endTimeMs: 1201000, durationMs: 1200000, evidenceScore: 0.9 }
    ]);

    // 3. Historical session from 30 days ago (Lifetime only): 50 minutes = 50 points
    const sessPast = await dbStore.createSession({
      userId: userC.id,
      selectedActivity: 'Studying',
      plannedDurationMs: 3000000,
      startedAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    });
    await dbStore.saveSegments(sessPast.id, userC.id, [
      { activityType: 'STUDY_LIKE', startTimeMs: 1000, endTimeMs: 3001000, durationMs: 3000000, evidenceScore: 0.9 }
    ]);

    const dash = await getPersonalDashboardData(userC.id);
    const fp = dash.focusPoints;

    assert.equal(fp.todayPoints, 10, 'Today points must equal 10');
    assert.equal(fp.today, 10, 'fp.today legacy field matches todayPoints');
    assert.equal(fp.lifetimePoints, 80, 'Lifetime points must equal 10 + 20 + 50 = 80');
    assert.equal(fp.total, 80, 'fp.total legacy field matches lifetimePoints');
    assert.ok(fp.weekPoints >= 10, 'Weekly points includes today');

    // Stage progression checks
    assert.equal(fp.currentStage, 'Beginner');
    assert.equal(fp.currentStagePoints, 80);
    assert.equal(fp.nextStage, 'Focused');
    assert.equal(fp.nextStagePoints, 300);
    assert.equal(fp.pointsToNextStage, 220); // 300 - 80 = 220
    assert.equal(fp.progressPercent, Math.round((80 / 300) * 100)); // 27%
    assert.equal(fp.isMaxStage, false);
  });

  await t.test('9. Stage Progression Across Thresholds & Max Stage Behavior', () => {
    // Stage 1: Beginner (0 - 299)
    const b = getFocusLevel(150);
    assert.equal(b.level, 'Beginner');
    assert.equal(b.nextLevel, 'Focused');
    assert.equal(b.pointsToNextLevel, 150);
    assert.equal(b.isMaxLevel, false);

    // Stage 2: Focused (300 - 549)
    const f = getFocusLevel(400);
    assert.equal(f.level, 'Focused');
    assert.equal(f.pointsInLevel, 100);
    assert.equal(f.nextLevel, 'Consistent');
    assert.equal(f.nextLevelMinPoints, 550);
    assert.equal(f.pointsToNextLevel, 150);
    assert.equal(f.progressPercent, 40); // 100 / 250 = 40%
    assert.equal(f.isMaxLevel, false);

    // Stage 3: Consistent (550 - 949)
    const c = getFocusLevel(650);
    assert.equal(c.level, 'Consistent');
    assert.equal(c.pointsInLevel, 100);
    assert.equal(c.nextLevel, 'Deep Worker');
    assert.equal(c.nextLevelMinPoints, 950);
    assert.equal(c.pointsToNextLevel, 300);
    assert.equal(c.progressPercent, 25); // 100 / 400 = 25%
    assert.equal(c.isMaxLevel, false);

    // Stage 4: Deep Worker (950 - 1499)
    const dw = getFocusLevel(1200);
    assert.equal(dw.level, 'Deep Worker');
    assert.equal(dw.pointsInLevel, 250);
    assert.equal(dw.nextLevel, 'Focus Master');
    assert.equal(dw.nextLevelMinPoints, 1500);
    assert.equal(dw.pointsToNextLevel, 300);
    assert.equal(dw.isMaxLevel, false);

    // Stage 5: Focus Master (1500+ -> Max Stage)
    const fm = getFocusLevel(1800);
    assert.equal(fm.level, 'Focus Master');
    assert.equal(fm.pointsToNextLevel, 0);
    assert.equal(fm.nextLevel, null);
    assert.equal(fm.nextLevelMinPoints, null);
    assert.equal(fm.progressPercent, 100);
    assert.equal(fm.isMaxLevel, true);
  });

  await t.test('10. Timezone Date Boundary Behavior for Today and Weekly Points', async () => {
    const userTz = await dbStore.createUser({
      username: `tz_points_${Date.now()}`,
      email: `tz_points_${Date.now()}@example.com`,
      passwordHash: 'hashed_pass_123',
    });

    // Session started at 2026-09-18T23:30:00Z
    // In UTC, this is 2026-09-18.
    // In UTC+5:30 (offset -330), this is 2026-09-19T05:00:00 (Next day!).
    const sessTz = await dbStore.createSession({
      userId: userTz.id,
      selectedActivity: 'Coding',
      plannedDurationMs: 1800000,
      startedAt: '2026-09-18T23:30:00.000Z',
    });
    await dbStore.saveSegments(sessTz.id, userTz.id, [
      { activityType: 'CODING', startTimeMs: 1000, endTimeMs: 1801000, durationMs: 1800000, evidenceScore: 0.9 }
    ]);

    // Query with target date set to 2026-09-19 and offset -330 (IST)
    const dashTz = await getPersonalDashboardData(userTz.id, {
      timezoneOffsetMinutes: -330,
      now: new Date('2026-09-19T10:00:00.000Z'),
    });

    // The session should be counted as TODAY in IST!
    assert.equal(dashTz.focusPoints.todayPoints, 30, 'Session counts as today in local IST timezone');
    assert.equal(dashTz.focusPoints.lifetimePoints, 30);
  });

  await t.test('11. API Endpoint GET /api/analytics/focus-points authentication & schema', async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // 1. Unauthenticated request -> 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-points',
    });
    assert.equal(unauthRes.statusCode, 401);

    // 2. Authenticated user request -> 200 with complete gamification schema
    const suffix = Date.now().toString(36);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'FP API User',
        username: `fp_api_${suffix}`,
        email: `fp_api_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    assert.equal(regRes.statusCode, 201);
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
    const user = JSON.parse(regRes.payload).user;

    // Create a 15-minute completed session for this user (15 points)
    const sess = await dbStore.createSession({
      userId: user.id,
      selectedActivity: 'Studying',
      plannedDurationMs: 900000,
    });
    await dbStore.saveSegments(sess.id, user.id, [
      { activityType: 'STUDY_LIKE', startTimeMs: 1000, endTimeMs: 901000, durationMs: 900000, evidenceScore: 0.9 }
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-points',
      headers: { cookie },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);

    assert.equal(typeof data.todayPoints, 'number');
    assert.equal(typeof data.weekPoints, 'number');
    assert.equal(typeof data.lifetimePoints, 'number');
    assert.equal(data.lifetimePoints, 15);
    assert.equal(data.currentStage, 'Beginner');
    assert.equal(data.currentStagePoints, 15);
    assert.equal(data.nextStagePoints, 300);
    assert.equal(data.pointsToNextStage, 285);
    assert.equal(typeof data.progressPercent, 'number');
    assert.equal(typeof data.isMaxStage, 'boolean');

    // Also check that GET /api/analytics/dashboard contains the matching focusPoints payload
    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard',
      headers: { cookie },
    });
    assert.equal(dashRes.statusCode, 200);
    const dashData = JSON.parse(dashRes.payload).dashboard;
    assert.ok(dashData.focusPoints);
    assert.equal(dashData.focusPoints.todayPoints, data.todayPoints);
    assert.equal(dashData.focusPoints.lifetimePoints, 15);
  });

  await t.test('12. User isolation on GET /api/analytics/focus-points', async () => {
    // Register another user
    const suffix = (Date.now() + 1).toString(36);
    const regRes2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'FP User Isolation',
        username: `fp_iso_${suffix}`,
        email: `fp_iso_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    assert.equal(regRes2.statusCode, 201);
    const cookie2 = `${regRes2.cookies[0].name}=${regRes2.cookies[0].value}`;

    // New user with no sessions should have 0 points, completely unaffected by previous user
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/analytics/focus-points',
      headers: { cookie: cookie2 },
    });
    assert.equal(res2.statusCode, 200);
    const data2 = JSON.parse(res2.payload);
    assert.equal(data2.lifetimePoints, 0);
    assert.equal(data2.todayPoints, 0);
    assert.equal(data2.weekPoints, 0);
    assert.equal(data2.currentStage, 'Beginner');
  });

  t.after(async () => {
    if (app) await app.close();
    await pool.end();
  });
});

