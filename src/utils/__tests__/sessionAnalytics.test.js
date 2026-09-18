import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mergeAdjacentSegments,
  calculateActivityDurations,
  calculateActivityPercentages,
  getLongestActivitySegment,
  countActivitySegments,
  calculateTransitionCount,
  normalizeActivitySegments,
  generateSessionInsights,
  exportSessionMetadata,
  generateMockSessionData,
} from '../sessionAnalytics.js';

describe('Session Analytics Unit Tests', () => {
  it('mergeAdjacentSegments merges contiguous segments of identical types', () => {
    const rawSegments = [
      { type: 'STUDY_LIKE', startTime: 1000, endTime: 5000, durationMs: 4000, contributingSignals: ['A'] },
      { type: 'STUDY_LIKE', startTime: 5000, endTime: 10000, durationMs: 5000, contributingSignals: ['B'] },
      { type: 'PHONE_ACTIVITY', startTime: 10000, endTime: 12000, durationMs: 2000, contributingSignals: ['C'] },
    ];

    const merged = mergeAdjacentSegments(rawSegments);

    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[0].type, 'STUDY_LIKE');
    assert.strictEqual(merged[0].startTime, 1000);
    assert.strictEqual(merged[0].endTime, 10000);
    assert.strictEqual(merged[0].durationMs, 9000);
    assert.deepStrictEqual(merged[0].contributingSignals.sort(), ['A', 'B']);

    assert.strictEqual(merged[1].type, 'PHONE_ACTIVITY');
    assert.strictEqual(merged[1].durationMs, 2000);
  });

  it('calculateActivityDurations correctly sums active duration in seconds per type', () => {
    const segments = [
      { type: 'CODING', startTime: 0, endTime: 60000, durationMs: 60000 }, // 60s
      { type: 'CODING', startTime: 60000, endTime: 120000, durationMs: 60000 }, // 60s
      { type: 'PHONE_ACTIVITY', startTime: 120000, endTime: 150000, durationMs: 30000 }, // 30s
    ];

    const durations = calculateActivityDurations(segments);

    assert.strictEqual(durations.CODING, 120);
    assert.strictEqual(durations.PHONE_ACTIVITY, 30);
    assert.strictEqual(durations.STUDY_LIKE, 0);
  });

  it('calculateActivityPercentages computes percentage distribution cleanly', () => {
    const durations = {
      CODING: 600,       // 50%
      STUDY_LIKE: 360,   // 30%
      PHONE_ACTIVITY: 240, // 20%
    };

    const percentages = calculateActivityPercentages(durations, 1200);

    assert.strictEqual(percentages.CODING, 50);
    assert.strictEqual(percentages.STUDY_LIKE, 30);
    assert.strictEqual(percentages.PHONE_ACTIVITY, 20);
  });

  it('getLongestActivitySegment identifies longest uninterrupted segment', () => {
    const segments = [
      { type: 'CODING', startTime: 0, endTime: 300000, durationMs: 300000 }, // 5 min
      { type: 'PHONE_ACTIVITY', startTime: 300000, endTime: 360000, durationMs: 60000 }, // 1 min
      { type: 'CODING', startTime: 360000, endTime: 1200000, durationMs: 840000 }, // 14 min
    ];

    const result = getLongestActivitySegment(segments, 'CODING');

    assert.strictEqual(result.durationSeconds, 840); // 14 min
    assert.strictEqual(result.segment.type, 'CODING');
  });

  it('calculateTransitionCount correctly counts transitions between different activities', () => {
    const segments = [
      { type: 'STUDY_LIKE', startTime: 0, endTime: 100 },
      { type: 'STUDY_LIKE', startTime: 100, endTime: 200 }, // merged with first
      { type: 'PHONE_ACTIVITY', startTime: 200, endTime: 300 }, // transition 1
      { type: 'STUDY_LIKE', startTime: 300, endTime: 400 }, // transition 2
    ];

    const transitions = calculateTransitionCount(segments);
    assert.strictEqual(transitions, 2);
  });

  it('normalizeActivitySegments inserts UNKNOWN for gaps larger than 2 seconds', () => {
    const segments = [
      { type: 'STUDY_LIKE', startTime: 0, endTime: 10000, durationMs: 10000 },
      // 10s gap here
      { type: 'CODING', startTime: 20000, endTime: 30000, durationMs: 10000 },
    ];

    const normalized = normalizeActivitySegments(segments, 0, 30000);

    assert.strictEqual(normalized.length, 3);
    assert.strictEqual(normalized[0].type, 'STUDY_LIKE');
    assert.strictEqual(normalized[1].type, 'UNKNOWN');
    assert.strictEqual(normalized[1].startTime, 10000);
    assert.strictEqual(normalized[1].endTime, 20000);
    assert.strictEqual(normalized[2].type, 'CODING');
  });

  it('exportSessionMetadata exports derived metadata ONLY and excludes raw binary/stream properties', () => {
    const sessionInfo = {
      activity: 'Deep Work',
      targetMinutes: 60,
      actualSecondsSpent: 3600,
    };
    const segments = [
      { type: 'CODING', startTime: 0, endTime: 3600000, durationMs: 3600000, evidenceScore: 0.9, explanation: ['Coding screen'] },
    ];

    const exportedJSON = exportSessionMetadata(sessionInfo, segments);

    assert.strictEqual(exportedJSON.app, 'FocusLens');
    assert.strictEqual(exportedJSON.session.activity, 'Deep Work');
    assert.strictEqual(exportedJSON.statistics.totalActiveSeconds, 3600);
    assert.strictEqual(exportedJSON.activitySegments.length, 1);

    // Verify privacy enforcement: NO raw video, canvas, or screenshot properties exist
    assert.strictEqual(exportedJSON.video, undefined);
    assert.strictEqual(exportedJSON.canvas, undefined);
    assert.strictEqual(exportedJSON.screenshot, undefined);
    assert.strictEqual(exportedJSON.imageData, undefined);
  });

  it('generateMockSessionData generates valid 120-minute mock session', () => {
    const mockData = generateMockSessionData();

    assert.strictEqual(mockData.targetMinutes, 120);
    assert.strictEqual(mockData.actualSecondsSpent, 7080);
    assert.strictEqual(mockData.activitySegments.length, 7);
    assert.strictEqual(mockData.isMockData, true);
  });
});
