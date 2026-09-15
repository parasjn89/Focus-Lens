import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFocusReplayMetrics } from '../../src/utils/focusReplay.js';
import { dbStore } from '../db/store.js';
import { buildApp } from '../app.js';

test('Focus Replay Calculation & Security Test Suite', async (t) => {
  let app;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  t.after(async () => {
    await app.close();
  });

  await t.test('1. Empty Session / No Segments Handling', () => {
    const res = calculateFocusReplayMetrics([], { targetMinutes: 25 });
    assert.equal(res.sessionDurationMin, 25);
    assert.equal(res.focusedTimeMin, 0);
    assert.equal(res.focusPoints, 0);
    assert.equal(res.longestFocusBlockSec, 0);
    assert.equal(res.totalInterruptions, 0);
    assert.equal(res.hasData, false);
  });

  await t.test('2. Correct Segment Durations, Ordering, and Observational Reasons', () => {
    const baseTime = 1000000;
    const rawSegments = [
      { id: 's1', type: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 600000, durationMs: 600000, explanation: ['Face present', 'Document on screen'] }, // 10 min
      { id: 's2', type: 'PHONE_ACTIVITY', startTime: baseTime + 600000, endTime: baseTime + 780000, durationMs: 180000, explanation: ['Phone detected'] }, // 3 min interruption
      { id: 's3', type: 'CODING', startTime: baseTime + 780000, endTime: baseTime + 1980000, durationMs: 1200000, explanation: ['Coding editor on screen'] }, // 20 min
    ];

    const res = calculateFocusReplayMetrics(rawSegments, { actualSecondsSpent: 1980 });

    assert.equal(res.sessionDurationMin, 33);
    assert.equal(res.focusedTimeMin, 30); // 10m study + 20m coding = 30m
    assert.equal(res.focusPoints, 30);
    assert.equal(res.totalInterruptions, 1);
    assert.equal(res.interruptions[0].type, 'PHONE_ACTIVITY');
    assert.equal(res.interruptions[0].durationSec, 180);
    assert.equal(res.interruptions[0].observationalReason.includes('Phone-related'), true);
  });

  await t.test('3. Longest Focus Block & Contiguous Block Merging', () => {
    const baseTime = 1000000;
    const rawSegments = [
      { id: 's1', type: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 600000, durationMs: 600000 }, // 10 min focus block 1
      { id: 's2', type: 'AWAY_OR_NOT_VISIBLE', startTime: baseTime + 600000, endTime: baseTime + 720000, durationMs: 120000 }, // 2 min interruption
      { id: 's3', type: 'CODING', startTime: baseTime + 720000, endTime: baseTime + 1620000, durationMs: 900000 }, // 15 min
      { id: 's4', type: 'DOCUMENT_ACTIVITY', startTime: baseTime + 1620000, endTime: baseTime + 2520000, durationMs: 900000 }, // 15 min (contiguous focus -> total 30 min!)
    ];

    const res = calculateFocusReplayMetrics(rawSegments, { actualSecondsSpent: 2520 });

    // Block 1: 10m (600s)
    // Block 2: 15m + 15m = 30m (1800s)
    assert.equal(res.longestFocusBlockSec, 1800);
    assert.equal(res.longestFocusBlockText, '30m 0s');
    assert.equal(res.totalInterruptions, 1);
  });

  await t.test('4. Adjacent Overlapping Same-Type Segments Merging', () => {
    const baseTime = 1000000;
    const rawSegments = [
      { id: 's1', type: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 300000, durationMs: 300000 },
      { id: 's2', type: 'STUDY_LIKE', startTime: baseTime + 280000, endTime: baseTime + 600000, durationMs: 320000 }, // Overlaps s1
    ];

    const res = calculateFocusReplayMetrics(rawSegments, { actualSecondsSpent: 600 });
    assert.equal(res.mergedSegments.length, 1, 'Overlapping segments of identical type must be merged into 1 timeline block');
    assert.equal(res.focusedTimeMin, 10);
    assert.equal(res.focusPoints, 10);
  });

  await t.test('5. Long 120-Minute Focus Session Replay Scaling', () => {
    const baseTime = 1000000;
    const rawSegments = [
      { id: 's1', type: 'STUDY_LIKE', startTime: baseTime, endTime: baseTime + 7200000, durationMs: 7200000 }, // 120 min
    ];

    const res = calculateFocusReplayMetrics(rawSegments, { actualSecondsSpent: 7200, targetMinutes: 120 });
    assert.equal(res.sessionDurationMin, 120);
    assert.equal(res.focusedTimeMin, 120);
    assert.equal(res.focusPoints, 120);
    assert.equal(res.totalInterruptions, 0);
  });

  await t.test('6. Security & IDOR Authorization: User A cannot access User B Focus Replay', async () => {
    // 1. Register User A
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Replay User A', username: `replay_usera_${Date.now()}`, email: `replay_usera_${Date.now()}@example.com`, password: 'Password12345!' },
    });
    const cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;

    // 2. Register User B
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'Replay User B', username: `replay_userb_${Date.now()}`, email: `replay_userb_${Date.now()}@example.com`, password: 'Password12345!' },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;

    // 3. User B creates Session B
    const sessBRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieB },
      payload: { plannedDurationMs: 1500000, selectedActivity: 'Coding' },
    });
    const sessionBId = JSON.parse(sessBRes.payload).session.id;

    // 4. User A attempts GET /api/sessions/<sessionBId> -> MUST RETURN 404 NOT FOUND
    const idorRes = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionBId}`,
      headers: { cookie: cookieA },
    });

    assert.equal(idorRes.statusCode, 404, 'User A MUST NOT be able to access User B session replay data');
  });
});
