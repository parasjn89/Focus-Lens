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
import crypto from 'crypto';

test('Focus Points & Level System Test Suite', async (t) => {
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
});
