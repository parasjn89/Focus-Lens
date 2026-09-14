import {
  classifyMultimodalActivity,
  mergeActivitySegments,
  calculateActivityDurations,
  createActivityTracker,
  ACTIVITY_TYPES
} from '../services/activityAnalyzer.js';

export function runActivityAnalyzerTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // --- 1. MULTIMODAL INFERENCE RULES ---
  {
    // Test 1: SCREEN_CODING + Face present + 1 person + No phone + Forward head -> CODING
    const res1 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: true, isPhonePresent: false, personCount: 1, headOrientation: 'FORWARD' },
      { isScreenActive: true, screenActivity: 'CODING', confidence: 0.89, sourceType: 'window' }
    );
    assert(res1.type === ACTIVITY_TYPES.CODING, 'Screen Coding + Camera Forward -> CODING');
    assert(res1.evidenceScore === 0.90, 'Returns 0.90 evidence score');
    assert(res1.explanation.length > 0, 'Generates plain-English explanation list');

    // Test 2: Phone present + SCREEN_CODING -> PHONE_ACTIVITY (Phone takes priority)
    const res2 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: true, isPhonePresent: true, personCount: 1, headOrientation: 'DOWN' },
      { isScreenActive: true, screenActivity: 'CODING', confidence: 0.89 }
    );
    assert(res2.type === ACTIVITY_TYPES.PHONE_ACTIVITY, 'Phone present takes priority over Screen Coding -> PHONE_ACTIVITY');
    assert(res2.evidenceScore === 0.95, 'Phone + Head Down gives 0.95 evidence score');

    // Test 3: Multiple people -> MULTIPLE_PEOPLE
    const res3 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: true, isPhonePresent: false, personCount: 2, headOrientation: 'FORWARD' },
      { isScreenActive: true, screenActivity: 'CODING' }
    );
    assert(res3.type === ACTIVITY_TYPES.MULTIPLE_PEOPLE, '2 people detected -> MULTIPLE_PEOPLE');

    // Test 4: Face absent -> AWAY_OR_NOT_VISIBLE
    const res4 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: false, isPhonePresent: false, personCount: 0, headOrientation: 'UNKNOWN' },
      { isScreenActive: false, screenActivity: 'UNKNOWN' }
    );
    assert(res4.type === ACTIVITY_TYPES.AWAY_OR_NOT_VISIBLE, 'Face absent -> AWAY_OR_NOT_VISIBLE');

    // Test 5: SCREEN_DOCUMENT + Face present + 1 person -> STUDY_LIKE
    const res5 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: true, isPhonePresent: false, personCount: 1, headOrientation: 'FORWARD' },
      { isScreenActive: true, screenActivity: 'DOCUMENT' }
    );
    assert(res5.type === ACTIVITY_TYPES.STUDY_LIKE, 'Screen Document + Camera Forward -> STUDY_LIKE');

    // Test 6: SCREEN_VIDEO -> VIDEO_ACTIVITY
    const res6 = classifyMultimodalActivity(
      { isCameraActive: true, isFacePresent: true, isPhonePresent: false, personCount: 1, headOrientation: 'FORWARD' },
      { isScreenActive: true, screenActivity: 'VIDEO' }
    );
    assert(res6.type === ACTIVITY_TYPES.VIDEO_ACTIVITY, 'Screen Video -> VIDEO_ACTIVITY');

    // Test 7: SCREEN_BROWSER -> BROWSER_ACTIVITY
    const res7 = classifyMultimodalActivity(
      { isCameraActive: false },
      { isScreenActive: true, screenActivity: 'BROWSER' }
    );
    assert(res7.type === ACTIVITY_TYPES.BROWSER_ACTIVITY, 'Screen Browser -> BROWSER_ACTIVITY');
  }

  // --- 2. DEBOUNCING & TRACKER TESTS ---
  {
    const tracker = createActivityTracker({ minimumActivityDurationMs: 1000 });
    const t0 = 10000;

    const camObj = { isCameraActive: true, isFacePresent: true, personCount: 1, isPhonePresent: false, headOrientation: 'FORWARD' };
    const screenCoding = { isScreenActive: true, screenActivity: 'CODING' };
    const screenPhone = { isScreenActive: true, screenActivity: 'CODING' };

    // Initial state CODING
    tracker.updateMultimodalSignals(camObj, screenCoding, t0);
    assert(tracker.getActiveSegment().type === ACTIVITY_TYPES.CODING, 'Initial activity is CODING');

    // Single noisy phone frame at t0 + 200ms
    const camPhone = { ...camObj, isPhonePresent: true };
    tracker.updateMultimodalSignals(camPhone, screenPhone, t0 + 200);
    assert(tracker.getActiveSegment().type === ACTIVITY_TYPES.CODING, 'Noisy phone frame ignored (debounced)');

    // Persistent phone detection after 1200ms
    tracker.updateMultimodalSignals(camPhone, screenPhone, t0 + 1300);
    assert(tracker.getActiveSegment().type === ACTIVITY_TYPES.PHONE_ACTIVITY, 'Confirmed phone detection transitions to PHONE_ACTIVITY');
  }

  // --- 3. SEGMENT MERGING & DURATION CALCULATIONS ---
  {
    const rawSegments = [
      { id: '1', type: 'CODING', startTime: 0, endTime: 10000, durationMs: 10000, contributingSignals: ['A'] },
      { id: '2', type: 'CODING', startTime: 10000, endTime: 25000, durationMs: 15000, contributingSignals: ['B'] },
      { id: '3', type: 'PHONE_ACTIVITY', startTime: 25000, endTime: 35000, durationMs: 10000, contributingSignals: ['C'] },
    ];

    const merged = mergeActivitySegments(rawSegments);
    assert(merged.length === 2, 'Merges adjacent CODING segments into 1');
    assert(merged[0].durationMs === 25000, 'Merged segment has correct combined duration (25s)');

    const totals = calculateActivityDurations(rawSegments);
    assert(totals.CODING === 25, 'Calculates 25s total for CODING');
    assert(totals.PHONE_ACTIVITY === 10, 'Calculates 10s total for PHONE_ACTIVITY');
  }

  return results;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('activityAnalyzer.test.js')) {
  console.log('Running Multimodal Activity Analyzer Unit Tests...');
  const testResults = runActivityAnalyzerTests();
  console.log('Test Results:', testResults);
}
