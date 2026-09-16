import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateActivityDurations,
  calculateActivityPercentages,
  mergeAdjacentSegments,
} from '../../src/utils/sessionAnalytics.js';

test('Activity Duration Breakdown Percentages Test Suite', async (t) => {
  await t.test('1. Zero duration returns safe empty state without NaN or Infinity', () => {
    const durations = {
      CODING: 0,
      STUDY_LIKE: 0,
      PHONE_ACTIVITY: 0,
      MULTIPLE_PEOPLE: 0,
      AWAY_OR_NOT_VISIBLE: 0,
    };

    const pcts = calculateActivityPercentages(durations, 0);
    assert.equal(pcts.CODING, 0);
    assert.equal(pcts.STUDY_LIKE, 0);
    assert.equal(pcts.PHONE_ACTIVITY, 0);
    assert.equal(pcts.MULTIPLE_PEOPLE, 0);
    assert.equal(pcts.AWAY_OR_NOT_VISIBLE, 0);
    assert.ok(!Object.values(pcts).some(val => isNaN(val) || !isFinite(val)));
  });

  await t.test('2. Percentages sum to approximately 100% based on one consistent total', () => {
    const durations = {
      CODING: 180, // 3 mins
      STUDY_LIKE: 60, // 1 min
      PHONE_ACTIVITY: 30, // 30s
      MULTIPLE_PEOPLE: 90, // 1.5 mins
      AWAY_OR_NOT_VISIBLE: 0,
    };
    // Total displayed duration = 180 + 60 + 30 + 90 = 360s (6 mins)

    const pcts = calculateActivityPercentages(durations, 360);

    assert.equal(pcts.CODING, 50); // 180 / 360 = 50%
    assert.equal(pcts.STUDY_LIKE, 17); // 60 / 360 = 16.67% -> 17%
    assert.equal(pcts.PHONE_ACTIVITY, 8); // 30 / 360 = 8.33% -> 8%
    assert.equal(pcts.MULTIPLE_PEOPLE, 25); // 90 / 360 = 25%

    const sum = pcts.CODING + pcts.STUDY_LIKE + pcts.PHONE_ACTIVITY + pcts.MULTIPLE_PEOPLE + pcts.AWAY_OR_NOT_VISIBLE;
    assert.ok(sum >= 99 && sum <= 101, `Sum of percentages should be ~100%, got ${sum}%`);
  });

  await t.test('3. Prevents impossible percentages exceeding 100% total', () => {
    // Problem scenario from prompt: 3 mins (180s) Coding & 2 mins (120s) Multiple People in a 175s session
    const durations = {
      CODING: 180,
      MULTIPLE_PEOPLE: 120,
    };
    // Prior bug: 180 / 175 = 93% and 120 / 175 = 63% (sum = 156%)
    // Corrected behavior: Denominator is sum of category durations (300s)
    const pcts = calculateActivityPercentages(durations, 175);

    assert.equal(pcts.CODING, 60); // 180 / 300 = 60%
    assert.equal(pcts.MULTIPLE_PEOPLE, 40); // 120 / 300 = 40%

    const sum = pcts.CODING + pcts.MULTIPLE_PEOPLE;
    assert.equal(sum, 100, `Sum of percentages must equal 100%, got ${sum}%`);
  });

  await t.test('4. Non-overlapping activity segments produce consistent totals', () => {
    const baseTime = 1700000000000;
    const segments = [
      { type: 'CODING', startTime: baseTime, endTime: baseTime + 120000, durationMs: 120000 },
      { type: 'STUDY_LIKE', startTime: baseTime + 120000, endTime: baseTime + 180000, durationMs: 60000 },
      { type: 'PHONE_ACTIVITY', startTime: baseTime + 180000, endTime: baseTime + 240000, durationMs: 60000 },
    ];

    const durations = calculateActivityDurations(segments);
    assert.equal(durations.CODING, 120);
    assert.equal(durations.STUDY_LIKE, 60);
    assert.equal(durations.PHONE_ACTIVITY, 60);

    const pcts = calculateActivityPercentages(durations, 240);
    assert.equal(pcts.CODING, 50);
    assert.equal(pcts.STUDY_LIKE, 25);
    assert.equal(pcts.PHONE_ACTIVITY, 25);

    const activeSum = Object.values(pcts).reduce((acc, v) => acc + v, 0);
    assert.equal(activeSum, 100);
  });
});
