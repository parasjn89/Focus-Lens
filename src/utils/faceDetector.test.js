import { createFaceTracker, FACE_STATES } from '../services/faceTracker.js';

/**
 * Lightweight test suite for Face Detection State Machine & Temporal Debouncer.
 * Can be run via Node or Vitest test runners.
 */
export function runFaceDetectorTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // Test 1: Initial state should be FACE_ABSENT
  {
    const tracker = createFaceTracker();
    assert(tracker.getCurrentState() === FACE_STATES.FACE_ABSENT, 'Initial state is FACE_ABSENT');
  }

  // Test 2: Single positive detection should NOT immediately trigger FACE_PRESENT (Temporal Debouncing)
  {
    let stateChangeEvent = null;
    const tracker = createFaceTracker({
      presentThreshold: 2,
      onStateChange: (evt) => { stateChangeEvent = evt; }
    });

    const res = tracker.processDetection({ faceDetected: true, confidence: 0.95, timestamp: 1000 });
    assert(res.currentState === FACE_STATES.FACE_ABSENT, 'Single positive frame does not switch state (debounced)');
    assert(stateChangeEvent === null, 'No state change event emitted on 1st frame');
  }

  // Test 3: Reaching presentThreshold triggers transition to FACE_PRESENT
  {
    let stateChangeEvent = null;
    const tracker = createFaceTracker({
      presentThreshold: 2,
      onStateChange: (evt) => { stateChangeEvent = evt; }
    });

    tracker.processDetection({ faceDetected: true, confidence: 0.95, timestamp: 1000 });
    const res2 = tracker.processDetection({ faceDetected: true, confidence: 0.96, timestamp: 1500 });

    assert(res2.currentState === FACE_STATES.FACE_PRESENT, 'Reaching presentThreshold triggers FACE_PRESENT');
    assert(stateChangeEvent !== null && stateChangeEvent.type === FACE_STATES.FACE_PRESENT, 'Emits FACE_PRESENT event');
    assert(stateChangeEvent.confidence === 0.96, 'Event includes confidence score');
  }

  // Test 4: Single missed frame does NOT immediately trigger FACE_ABSENT (Noise rejection)
  {
    let stateChangeEvent = null;
    const tracker = createFaceTracker({
      presentThreshold: 2,
      absentThreshold: 3,
      onStateChange: (evt) => { stateChangeEvent = evt; }
    });

    // Establish FACE_PRESENT state
    tracker.processDetection({ faceDetected: true, confidence: 0.9, timestamp: 1000 });
    tracker.processDetection({ faceDetected: true, confidence: 0.9, timestamp: 1500 });
    assert(tracker.getCurrentState() === FACE_STATES.FACE_PRESENT, 'Established FACE_PRESENT');

    // Single missed frame (drop)
    stateChangeEvent = null;
    const res = tracker.processDetection({ faceDetected: false, confidence: null, timestamp: 2000 });
    assert(res.currentState === FACE_STATES.FACE_PRESENT, 'Single missed frame is ignored (debounced)');
    assert(stateChangeEvent === null, 'No absence event emitted on 1st missed frame');
  }

  // Test 5: Reaching absentThreshold triggers transition to FACE_ABSENT
  {
    let stateChangeEvent = null;
    const tracker = createFaceTracker({
      presentThreshold: 2,
      absentThreshold: 3,
      onStateChange: (evt) => { stateChangeEvent = evt; }
    });

    // Establish FACE_PRESENT state
    tracker.processDetection({ faceDetected: true, confidence: 0.9, timestamp: 1000 });
    tracker.processDetection({ faceDetected: true, confidence: 0.9, timestamp: 1500 });

    // 3 Consecutive missed frames
    tracker.processDetection({ faceDetected: false, confidence: null, timestamp: 2000 });
    tracker.processDetection({ faceDetected: false, confidence: null, timestamp: 2500 });
    const res3 = tracker.processDetection({ faceDetected: false, confidence: null, timestamp: 3000 });

    assert(res3.currentState === FACE_STATES.FACE_ABSENT, 'Reaching absentThreshold triggers FACE_ABSENT');
    assert(stateChangeEvent !== null && stateChangeEvent.type === FACE_STATES.FACE_ABSENT, 'Emits FACE_ABSENT event');
  }

  // Test 6: Reset clears counters and reverts to FACE_ABSENT
  {
    const tracker = createFaceTracker({ presentThreshold: 1 });
    tracker.processDetection({ faceDetected: true, confidence: 0.9, timestamp: 1000 });
    assert(tracker.getCurrentState() === FACE_STATES.FACE_PRESENT, 'State is FACE_PRESENT');

    tracker.reset();
    assert(tracker.getCurrentState() === FACE_STATES.FACE_ABSENT, 'Reset restores FACE_ABSENT state');
  }

  return results;
}

// Execute tests automatically if executed directly via node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('faceDetector.test.js')) {
  console.log('Running Face Detector & Tracker Unit Tests...');
  const testResults = runFaceDetectorTests();
  console.log('Test Results:', testResults);
}
