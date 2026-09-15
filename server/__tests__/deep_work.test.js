import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeepWorkBlocks, formatDurationText } from '../../src/utils/deepWork.js';
import { calculateFocusPointsFromDurations } from '../../src/utils/focusPoints.js';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';

test('FocusLens Deep Work Blocks & Personal Best Test Suite', async (t) => {
  const baseTime = 1700000000000;

  await t.test('1. Single STUDY_LIKE segment yields 1 Deep Work block', () => {
    const segments = [
      {
        id: 'seg_1',
        activityType: 'STUDY_LIKE',
        startTime: baseTime,
        endTime: baseTime + 600000, // 10 minutes
        durationMs: 600000,
      }
    ];

    const result = calculateDeepWorkBlocks(segments);

    assert.equal(result.deepWorkBlocksCount, 1);
    assert.equal(result.longestBlockSec, 600);
    assert.equal(result.longestBlockText, '10m 0s');
    assert.equal(result.totalDeepWorkSec, 600);
    assert.equal(result.totalDeepWorkText, '10m 0s');
  });

  await t.test('2. Multiple separated focused segments yield separate Deep Work blocks', () => {
    const segments = [
      {
        id: 'seg_1',
        activityType: 'STUDY_LIKE',
        startTime: baseTime,
        endTime: baseTime + 600000, // 0-10m (10m)
        durationMs: 600000,
      },
      {
        id: 'seg_2',
        activityType: 'PHONE_ACTIVITY',
        startTime: baseTime + 600000,
        endTime: baseTime + 780000, // 10-13m (3m phone)
        durationMs: 180000,
      },
      {
        id: 'seg_3',
        activityType: 'STUDY_LIKE',
        startTime: baseTime + 780000,
        endTime: baseTime + 1860000, // 13-31m (18m)
        durationMs: 1080000,
      },
      {
        id: 'seg_4',
        activityType: 'AWAY_OR_NOT_VISIBLE',
        startTime: baseTime + 1860000,
        endTime: baseTime + 1980000, // 31-33m (2m away)
        durationMs: 120000,
      },
      {
        id: 'seg_5',
        activityType: 'CODING',
        startTime: baseTime + 1980000,
        endTime: baseTime + 3300000, // 33-55m (22m)
        durationMs: 1320000,
      }
    ];

    const result = calculateDeepWorkBlocks(segments);

    assert.equal(result.deepWorkBlocksCount, 3);
    assert.equal(result.blocks[0].durationSec, 600); // 10m
    assert.equal(result.blocks[1].durationSec, 1080); // 18m
    assert.equal(result.blocks[2].durationSec, 1320); // 22m

    assert.equal(result.longestBlockSec, 1320);
    assert.equal(result.longestBlockText, '22m 0s');
    assert.equal(result.totalDeepWorkSec, 3000); // 50m
    assert.equal(result.totalDeepWorkText, '50m 0s');
  });

  await t.test('3. Adjacent focused segments merge into a single Deep Work Block', () => {
    const segments = [
      {
        id: 'seg_1',
        activityType: 'STUDY_LIKE',
        startTime: baseTime + 600000,
        endTime: baseTime + 900000, // 10:00 - 15:00 (5m)
        durationMs: 300000,
      },
      {
        id: 'seg_2',
        activityType: 'STUDY_LIKE',
        startTime: baseTime + 900000,
        endTime: baseTime + 1320000, // 15:00 - 22:00 (7m)
        durationMs: 420000,
      }
    ];

    const result = calculateDeepWorkBlocks(segments);

    assert.equal(result.deepWorkBlocksCount, 1);
    assert.equal(result.blocks[0].durationSec, 720); // 12m
    assert.equal(result.longestBlockText, '12m 0s');
  });

  await t.test('4. Correct block durations and format', () => {
    const segments = [
      {
        id: 'seg_1',
        activityType: 'CODING',
        startTime: baseTime,
        endTime: baseTime + 1902000, // 31m 42s
        durationMs: 1902000,
      }
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.equal(result.longestBlockSec, 1902);
    assert.equal(result.longestBlockText, '31m 42s');
  });

  await t.test('5. Correct start and end time range text', () => {
    const segments = [
      {
        id: 'seg_1',
        activityType: 'STUDY_LIKE',
        startTime: baseTime + 860000, // 14:20
        endTime: baseTime + 2762000, // 46:02
        durationMs: 1902000,
      }
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.ok(result.longestBlockRange.includes('–'));
    assert.equal(result.deepWorkBlocksCount, 1);
  });

  await t.test('6. Longest block selection amongst multiple blocks', () => {
    const segments = [
      { activityType: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 300000, durationMs: 300000 }, // 5m
      { activityType: 'PHONE_ACTIVITY', startTime: baseTime + 300000, endTime: baseTime + 360000, durationMs: 60000 }, // break
      { activityType: 'STUDY_LIKE', startTime: baseTime + 360000, endTime: baseTime + 2160000, durationMs: 1800000 }, // 30m
      { activityType: 'AWAY_OR_NOT_VISIBLE', startTime: baseTime + 2160000, endTime: baseTime + 2220000, durationMs: 60000 }, // break
      { activityType: 'STUDY_LIKE', startTime: baseTime + 2220000, endTime: baseTime + 3420000, durationMs: 1200000 }, // 20m
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.equal(result.deepWorkBlocksCount, 3);
    assert.equal(result.longestBlockSec, 1800); // 30m
    assert.equal(result.longestBlockText, '30m 0s');
  });

  await t.test('7. Zero qualifying activity yields 0 Deep Work', () => {
    const segments = [
      { activityType: 'PHONE_ACTIVITY', startTime: baseTime, endTime: baseTime + 300000, durationMs: 300000 },
      { activityType: 'AWAY_OR_NOT_VISIBLE', startTime: baseTime + 300000, endTime: baseTime + 600000, durationMs: 300000 },
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.equal(result.deepWorkBlocksCount, 0);
    assert.equal(result.longestBlockSec, 0);
    assert.equal(result.longestBlockText, '0m 0s');
    assert.equal(result.totalDeepWorkSec, 0);
  });

  await t.test('8 & 9. Overlapping and duplicated segments merge without double counting', () => {
    const segments = [
      { activityType: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 600000, durationMs: 600000 }, // 0-10m
      { activityType: 'STUDY_LIKE', startTime: baseTime + 300000, endTime: baseTime + 900000, durationMs: 600000 }, // 5-15m (overlap)
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.equal(result.deepWorkBlocksCount, 1);
    assert.equal(result.longestBlockSec, 900); // 15m total span
    assert.equal(result.longestBlockText, '15m 0s');
  });

  await t.test('10. Full-session focused block', () => {
    const segments = [
      { activityType: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 3300000, durationMs: 3300000 }, // 55m
    ];

    const result = calculateDeepWorkBlocks(segments);
    assert.equal(result.deepWorkBlocksCount, 1);
    assert.equal(result.longestBlockSec, 3300);
    assert.equal(result.longestBlockText, '55m 0s');
  });

  await t.test('11. Incomplete / empty session handling', () => {
    const result = calculateDeepWorkBlocks([]);
    assert.equal(result.deepWorkBlocksCount, 0);
    assert.equal(result.hasData, false);
    assert.equal(result.longestBlockText, '0m 0s');
  });

  await t.test('12. Malformed segment data fails safely without throwing', () => {
    const malformed = [
      null,
      undefined,
      {},
      { activityType: 'STUDY_LIKE', startTime: 'invalid', endTime: null },
      { activityType: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 600000 },
    ];

    assert.doesNotThrow(() => {
      const result = calculateDeepWorkBlocks(malformed);
      assert.ok(result);
    });
  });

  await t.test('13. Focus Points calculation remains unchanged', () => {
    const categoryDurations = {
      STUDY_LIKE: 3000, // 50 mins qualifying focus
      PHONE_ACTIVITY: 300,
    };

    const fpResult = calculateFocusPointsFromDurations(categoryDurations);
    assert.equal(fpResult.focusPoints, 50); // Exactly 1 point per minute of qualifying activity
    assert.equal(fpResult.qualifyingMinutes, 50);
  });

  await t.test('14 & 15. Server Authorization & IDOR Personal Best Isolation', async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    try {
      const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      // Register User A via API
      const regA = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'DW User A',
          username: `dw_usera_${suffix}`,
          email: `dw_usera_${suffix}@example.com`,
          password: 'Password12345!',
        },
      });
      const cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
      const userAId = JSON.parse(regA.payload).user.id;

      // Register User B via API
      const regB = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          name: 'DW User B',
          username: `dw_userb_${suffix}`,
          email: `dw_userb_${suffix}@example.com`,
          password: 'Password12345!',
        },
      });
      const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
      const userBId = JSON.parse(regB.payload).user.id;

      // Create 45-min session for User A
      const sessARes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { cookie: cookieA },
        payload: { plannedDurationMs: 2700000, selectedActivity: 'Deep Coding' },
      });
      const sessionAId = JSON.parse(sessARes.payload).session.id;

      await dbStore.saveSegments(sessionAId, userAId, [
        {
          activityType: 'CODING',
          startTimeMs: Date.now() - 2700000,
          endTimeMs: Date.now(),
          durationMs: 2700000,
          evidenceScore: 0.9,
          explanation: ['Coding detected'],
          contributingSignals: ['SCREEN_CODING'],
        }
      ]);

      // Create 15-min session for User B
      const sessBRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { cookie: cookieB },
        payload: { plannedDurationMs: 900000, selectedActivity: 'Quick Study' },
      });
      const sessionBId = JSON.parse(sessBRes.payload).session.id;

      await dbStore.saveSegments(sessionBId, userBId, [
        {
          activityType: 'STUDY_LIKE',
          startTimeMs: Date.now() - 900000,
          endTimeMs: Date.now(),
          durationMs: 900000,
          evidenceScore: 0.9,
          explanation: ['Study detected'],
          contributingSignals: ['SCREEN_DOCUMENT'],
        }
      ]);

      // User B tries to view User A's session endpoint -> Expect HTTP 404
      const idorRes = await app.inject({
        method: 'GET',
        url: `/api/sessions/${sessionAId}`,
        headers: { cookie: cookieB },
      });

      assert.equal(idorRes.statusCode, 404, 'User B must NOT access User A session (IDOR protection)');

      // User B fetches personal dashboard
      const dashRes = await app.inject({
        method: 'GET',
        url: '/api/analytics/dashboard',
        headers: { cookie: cookieB },
      });

      assert.equal(dashRes.statusCode, 200);
      const dashBody = JSON.parse(dashRes.payload);

      // Verify User B's Personal Best is 15 minutes (900s), NOT User A's 45 minutes (2700s)
      assert.equal(dashBody.dashboard.deepWork.personalBestSec, 900);
      assert.equal(dashBody.dashboard.deepWork.personalBestText, '15m 0s');

    } finally {
      await app.close();
    }
  });
});
