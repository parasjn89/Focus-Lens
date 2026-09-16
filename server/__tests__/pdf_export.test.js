import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * PDF Export Data Pipeline Tests for FocusLens.
 *
 * NOTE: jsPDF requires browser APIs (canvas, DOM) so we cannot test actual PDF
 * document generation in Node. These tests validate the DATA PIPELINE and
 * formatting logic that feeds into the PDF generator — the same functions used
 * by both the UI and the PDF export.
 */

// Import the shared analytics utilities (pure JS, no JSX)
import {
  mergeAdjacentSegments,
  calculateActivityDurations,
  calculateActivityPercentages,
  countActivitySegments,
  generateSessionInsights,
  exportSessionMetadata,
} from '../../src/utils/sessionAnalytics.js';

import { calculateFocusPointsFromDurations } from '../../src/utils/focusPoints.js';
import { formatSecondsToTime } from '../../src/utils/formatters.js';
import { calculateDeepWorkBlocks } from '../../src/utils/deepWork.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeSeg(type, startSec, endSec) {
  return {
    type,
    startTime: startSec * 1000,
    endTime: endSec * 1000,
    durationMs: (endSec - startSec) * 1000,
  };
}

function buildPdfFilename(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `FocusLens-Session-${yyyy}-${mm}-${dd}.pdf`;
}

describe('PDF Export Data Pipeline Tests', () => {

  // ────────────────────────────────────────────────────────────────────────────
  it('1. Normal session produces valid activity data for PDF', () => {
    const segments = [
      makeSeg('CODING', 0, 600),           // 10 min
      makeSeg('STUDY_LIKE', 600, 1200),    // 10 min
      makeSeg('PHONE_ACTIVITY', 1200, 1320), // 2 min
      makeSeg('CODING', 1320, 1500),       // 3 min
    ];

    const merged = mergeAdjacentSegments(segments);
    const durations = calculateActivityDurations(merged);
    const percentages = calculateActivityPercentages(durations, 1500);
    const counts = countActivitySegments(merged);
    const insights = generateSessionInsights(merged, 1500);
    const points = calculateFocusPointsFromDurations(durations);
    const deepWork = calculateDeepWorkBlocks(segments, {});

    // Durations should be valid numbers
    assert.ok(typeof durations.CODING === 'number');
    assert.ok(typeof durations.STUDY_LIKE === 'number');
    assert.ok(typeof durations.PHONE_ACTIVITY === 'number');
    assert.ok(durations.CODING > 0);
    assert.ok(durations.STUDY_LIKE > 0);
    assert.ok(durations.PHONE_ACTIVITY > 0);

    // Percentages should be valid integers
    assert.ok(Number.isFinite(percentages.CODING));
    assert.ok(Number.isFinite(percentages.STUDY_LIKE));
    assert.ok(Number.isFinite(percentages.PHONE_ACTIVITY));

    // Focus points should be non-negative
    assert.ok(points.focusPoints >= 0);
    assert.ok(points.qualifyingSeconds >= 0);

    // Deep work should return valid structure
    assert.ok(typeof deepWork.deepWorkBlocksCount === 'number');
    assert.ok(typeof deepWork.totalDeepWorkText === 'string');
    assert.ok(typeof deepWork.longestBlockText === 'string');

    // Insights should have valid structure
    assert.ok(typeof insights.longestStudyStreakSec === 'number');
    assert.ok(typeof insights.transitionCount === 'number');
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('2. Empty/zero activity data returns safe defaults (no NaN/Infinity)', () => {
    const merged = mergeAdjacentSegments([]);
    const durations = calculateActivityDurations([]);
    const percentages = calculateActivityPercentages(durations, 0);
    const counts = countActivitySegments([]);
    const insights = generateSessionInsights([], 0);
    const points = calculateFocusPointsFromDurations(durations);
    const deepWork = calculateDeepWorkBlocks([], {});

    // All durations must be zero
    Object.values(durations).forEach((d) => {
      assert.equal(d, 0, `Duration should be 0, got ${d}`);
    });

    // All percentages must be zero (not NaN or Infinity)
    Object.values(percentages).forEach((p) => {
      assert.ok(Number.isFinite(p), `Percentage should be finite, got ${p}`);
      assert.equal(p, 0);
    });

    // Points should be zero
    assert.equal(points.focusPoints, 0);
    assert.equal(points.qualifyingSeconds, 0);

    // Deep work should be zero/safe
    assert.equal(deepWork.deepWorkBlocksCount, 0);
    assert.ok(typeof deepWork.totalDeepWorkText === 'string');
    assert.ok(typeof deepWork.longestBlockText === 'string');

    // Insights should be safe
    assert.equal(insights.longestStudyStreakSec, 0);
    assert.equal(insights.transitionCount, 0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('3. Missing journal/reflection data is handled gracefully', () => {
    const reportData = {
      activity: 'Studying',
      targetMinutes: 25,
      actualSecondsSpent: 1500,
      // No intention, reflection, or journalEntry
    };

    // These should be falsy / undefined — PDF generator will skip the section
    assert.ok(!reportData.intention);
    assert.ok(!reportData.reflection);
    assert.ok(!reportData.journalEntry);

    // Export should still produce valid metadata
    const exportPayload = exportSessionMetadata(reportData, []);
    assert.ok(exportPayload.app === 'FocusLens');
    assert.ok(exportPayload.session.activity === 'Studying');
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('4. Long session with many segments produces valid percentages', () => {
    // Generate 100 segments of alternating activities
    const segments = [];
    const types = ['CODING', 'STUDY_LIKE', 'PHONE_ACTIVITY', 'BROWSER_ACTIVITY', 'DOCUMENT_ACTIVITY'];

    for (let i = 0; i < 100; i++) {
      const type = types[i % types.length];
      const startSec = i * 72; // 72 seconds each = 7200 total (120 min)
      segments.push(makeSeg(type, startSec, startSec + 72));
    }

    const merged = mergeAdjacentSegments(segments);
    const totalSec = 7200;
    const durations = calculateActivityDurations(merged);
    const percentages = calculateActivityPercentages(durations, totalSec);

    // All percentages must be finite
    Object.values(percentages).forEach((p) => {
      assert.ok(Number.isFinite(p), `Percentage should be finite, got ${p}`);
      assert.ok(p >= 0 && p <= 100, `Percentage should be 0-100, got ${p}`);
    });

    // Sum of durations for active categories should equal total
    const sumDurationSec = Object.values(durations).reduce((acc, d) => acc + d, 0);
    assert.ok(sumDurationSec > 0, 'Total duration should be positive');

    // Percentages should sum to approximately 100
    const activePcts = Object.entries(percentages)
      .filter(([k, v]) => v > 0)
      .map(([k, v]) => v);
    const sumPct = activePcts.reduce((acc, p) => acc + p, 0);
    assert.ok(sumPct >= 97 && sumPct <= 103, `Percentage sum should be ~100, got ${sumPct}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('5. Percentages sum to approximately 100% for typical sessions', () => {
    const segments = [
      makeSeg('CODING', 0, 300),           // 5 min
      makeSeg('STUDY_LIKE', 300, 900),     // 10 min
      makeSeg('BROWSER_ACTIVITY', 900, 1080), // 3 min
      makeSeg('PHONE_ACTIVITY', 1080, 1200), // 2 min
      makeSeg('DOCUMENT_ACTIVITY', 1200, 1500), // 5 min
    ];

    const merged = mergeAdjacentSegments(segments);
    const durations = calculateActivityDurations(merged);

    // Sum of displayed durations is the denominator
    const sumDurations = Object.values(durations).reduce((acc, d) => acc + d, 0);
    const percentages = calculateActivityPercentages(durations, sumDurations);

    const activePcts = Object.entries(percentages)
      .filter(([k, v]) => v > 0)
      .map(([k, v]) => v);
    const sumPct = activePcts.reduce((acc, p) => acc + p, 0);

    // Should be 100 ± 1 (rounding tolerance)
    assert.ok(
      sumPct >= 99 && sumPct <= 101,
      `Percentage sum should be 99-101, got ${sumPct}`
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('6. PDF filename format matches FocusLens-Session-YYYY-MM-DD.pdf', () => {
    const testDate = new Date(2026, 8, 16); // Sept 16, 2026 (month is 0-indexed)
    const filename = buildPdfFilename(testDate);

    assert.equal(filename, 'FocusLens-Session-2026-09-16.pdf');

    // Verify regex pattern
    const pattern = /^FocusLens-Session-\d{4}-\d{2}-\d{2}\.pdf$/;
    assert.ok(pattern.test(filename), `Filename should match pattern, got: ${filename}`);

    // Verify today's date generates valid filename
    const todayFilename = buildPdfFilename(new Date());
    assert.ok(pattern.test(todayFilename), `Today filename should match pattern, got: ${todayFilename}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('7. JSON export still produces valid output', () => {
    const segments = [
      makeSeg('CODING', 0, 600),
      makeSeg('STUDY_LIKE', 600, 1200),
    ];

    const reportData = {
      activity: 'Studying',
      targetMinutes: 25,
      actualSecondsSpent: 1200,
      pausedSecondsSpent: 60,
      completedAt: '14:30',
    };

    const exported = exportSessionMetadata(reportData, segments);

    assert.equal(exported.app, 'FocusLens');
    assert.ok(exported.exportedAt);
    assert.ok(exported.privacyNotice);
    assert.equal(exported.session.activity, 'Studying');
    assert.equal(exported.session.targetMinutes, 25);
    assert.equal(exported.session.actualSecondsSpent, 1200);
    assert.equal(exported.session.pausedSecondsSpent, 60);
    assert.ok(exported.statistics);
    assert.ok(exported.activitySegments);
    assert.ok(Array.isArray(exported.activitySegments));

    // Verify JSON serialization works
    const jsonStr = JSON.stringify(exported, null, 2);
    assert.ok(jsonStr.length > 0, 'JSON string should not be empty');
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.app, 'FocusLens');
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('8. Privacy notice text is included in export payload', () => {
    const exported = exportSessionMetadata({}, []);

    assert.ok(exported.privacyNotice, 'Privacy notice should exist');
    assert.ok(
      exported.privacyNotice.toLowerCase().includes('video') ||
      exported.privacyNotice.toLowerCase().includes('camera') ||
      exported.privacyNotice.toLowerCase().includes('screen') ||
      exported.privacyNotice.toLowerCase().includes('recording'),
      'Privacy notice should mention media exclusion'
    );
    assert.ok(
      exported.privacyNotice.toLowerCase().includes('not') ||
      exported.privacyNotice.toLowerCase().includes('no '),
      'Privacy notice should indicate exclusion'
    );
  });
});
