import { classifyScreenImageData, SCREEN_ACTIVITIES } from '../services/screenClassifier.js';
import { createScreenTracker, SCREEN_STATE_EVENTS } from '../services/screenTracker.js';

export function runScreenClassifierTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // Mock ImageData generator helper (width: 20, height: 20 = 400 pixels = 1600 RGBA numbers)
  const createMockImageData = (pixelGenerator) => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const { r, g, b, a = 255 } = pixelGenerator(i);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = a;
    }

    return { width, height, data };
  };

  // --- 1. CLASSIFICATION HEURISTIC TESTS ---
  {
    // Test 1: CODING Classification (Dark background + colorful syntax highlights)
    const codingImageData = createMockImageData((i) => {
      if (i % 3 === 0) return { r: 80, g: 180, b: 240 }; // Syntax highlight (blue/cyan)
      return { r: 20, g: 25, b: 35 }; // Dark VS Code background
    });

    const resCoding = classifyScreenImageData(codingImageData);
    assert(resCoding.activity === SCREEN_ACTIVITIES.CODING, 'Dark background + syntax hues classifies as CODING');
    assert(resCoding.confidence === 0.89, 'Returns 0.89 confidence for CODING');

    // Test 2: DOCUMENT Classification (Bright white background + sparse dark text)
    const docImageData = createMockImageData((i) => {
      if (i % 15 === 0) return { r: 30, g: 30, b: 30 }; // Sparse text pixel
      return { r: 245, g: 245, b: 245 }; // White page background
    });

    const resDoc = classifyScreenImageData(docImageData);
    assert(resDoc.activity === SCREEN_ACTIVITIES.DOCUMENT, 'Bright white background classifies as DOCUMENT');

    // Test 3: BROWSER Classification (Mixed bright/dark elements)
    const browserImageData = createMockImageData((i) => {
      if (i < 100) return { r: 220, g: 220, b: 220 }; // Browser header
      return { r: 120, g: 130, b: 140 }; // Mixed content
    });

    const resBrowser = classifyScreenImageData(browserImageData);
    assert(resBrowser.activity === SCREEN_ACTIVITIES.BROWSER, 'Mixed bright header classifies as BROWSER');

    // Test 4: UNKNOWN Classification (Empty or null data)
    const resNull = classifyScreenImageData(null);
    assert(resNull.activity === SCREEN_ACTIVITIES.UNKNOWN, 'Null data returns UNKNOWN activity');
  }

  // --- 2. TEMPORAL DEBOUNCING & TRACKER TESTS ---
  {
    let events = [];
    const tracker = createScreenTracker({
      stabilityThreshold: 2,
      onStateChange: (evt) => events.push(evt),
    });

    // Test 5: Initial state is UNKNOWN
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.UNKNOWN, 'Initial tracker state is UNKNOWN');

    // Test 6: Single CODING frame is debounced (1st frame)
    const codingRaw = { activity: SCREEN_ACTIVITIES.CODING, confidence: 0.89, timestamp: 1000 };
    tracker.processClassification(codingRaw);
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.UNKNOWN, 'Single CODING frame is debounced');

    // Test 7: 2nd CODING frame confirms transition to CODING
    tracker.processClassification(codingRaw);
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.CODING, '2nd consecutive CODING frame confirms SCREEN_CODING');
    assert(events.length === 1 && events[0].type === SCREEN_STATE_EVENTS.SCREEN_CODING, 'Emits SCREEN_CODING event');

    // Test 8: Single noisy BROWSER frame is ignored (no rapid flickering)
    const browserRaw = { activity: SCREEN_ACTIVITIES.BROWSER, confidence: 0.84, timestamp: 2000 };
    tracker.processClassification(browserRaw);
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.CODING, 'Single noisy BROWSER frame is ignored');

    // Test 9: 2nd BROWSER frame confirms transition to BROWSER
    tracker.processClassification(browserRaw);
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.BROWSER, '2nd consecutive BROWSER frame confirms SCREEN_BROWSER');
    assert(events.length === 2 && events[1].type === SCREEN_STATE_EVENTS.SCREEN_BROWSER, 'Emits SCREEN_BROWSER event');

    // Test 10: Reset clears state back to UNKNOWN
    tracker.reset();
    assert(tracker.getCurrentState() === SCREEN_ACTIVITIES.UNKNOWN, 'Reset restores UNKNOWN state');
  }

  return results;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('screenClassifier.test.js')) {
  console.log('Running Screen Classifier & Tracker Unit Tests...');
  const testResults = runScreenClassifierTests();
  console.log('Test Results:', testResults);
}
