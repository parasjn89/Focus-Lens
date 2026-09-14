import { estimateHeadPose, HEAD_ORIENTATIONS } from '../services/headPoseEstimator.js';
import { createHeadTracker, HEAD_STATE_EVENTS } from '../services/headTracker.js';

export function runHeadDetectorTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // Mock landmarks generator helper
  const createMockLandmarks = ({ noseX = 0.5, noseY = 0.35, leftEyeX = 0.4, rightEyeX = 0.6, chinY = 0.6, foreheadY = 0.1 } = {}) => {
    const landmarks = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[1] = { x: noseX, y: noseY, z: 0 };
    landmarks[152] = { x: 0.5, y: chinY, z: 0 };
    landmarks[33] = { x: leftEyeX, y: 0.25, z: 0 };
    landmarks[263] = { x: rightEyeX, y: 0.25, z: 0 };
    landmarks[10] = { x: 0.5, y: foreheadY, z: 0 };
    return landmarks;
  };

  // --- 1. ORIENTATION ESTIMATION TESTS ---
  {
    // Test 1: Forward Orientation
    const forwardLandmarks = createMockLandmarks({ noseX: 0.5, noseY: 0.35 });
    const resForward = estimateHeadPose(forwardLandmarks);
    assert(resForward.orientation === HEAD_ORIENTATIONS.FORWARD, 'Centered nose estimates FORWARD orientation');

    // Test 2: Left Orientation (Nose shifted left)
    const leftLandmarks = createMockLandmarks({ noseX: 0.35 });
    const resLeft = estimateHeadPose(leftLandmarks);
    assert(resLeft.orientation === HEAD_ORIENTATIONS.LEFT, 'Nose shifted left estimates LEFT orientation');

    // Test 3: Right Orientation (Nose shifted right)
    const rightLandmarks = createMockLandmarks({ noseX: 0.65 });
    const resRight = estimateHeadPose(rightLandmarks);
    assert(resRight.orientation === HEAD_ORIENTATIONS.RIGHT, 'Nose shifted right estimates RIGHT orientation');

    // Test 4: Down Orientation (Nose dropped down)
    const downLandmarks = createMockLandmarks({ noseY: 0.55 });
    const resDown = estimateHeadPose(downLandmarks);
    assert(resDown.orientation === HEAD_ORIENTATIONS.DOWN, 'Nose dropped down estimates DOWN orientation');

    // Test 5: Unknown Orientation (Null/Missing landmarks)
    const resUnknown = estimateHeadPose(null);
    assert(resUnknown.orientation === HEAD_ORIENTATIONS.UNKNOWN, 'Null landmarks returns UNKNOWN orientation');
  }

  // --- 2. TEMPORAL DEBOUNCING TESTS ---
  {
    let stateEvents = [];
    const tracker = createHeadTracker({
      stabilityThreshold: 2,
      onStateChange: (evt) => stateEvents.push(evt),
    });

    // Test 6: Initial state is UNKNOWN
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.UNKNOWN, 'Initial tracker state is UNKNOWN');

    // Test 7: Single FORWARD frame is debounced (1st frame)
    const forwardEst = { orientation: HEAD_ORIENTATIONS.FORWARD, confidence: 0.9, timestamp: 1000, metrics: { yaw: 0, pitch: 0 } };
    tracker.processPose(forwardEst);
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.UNKNOWN, 'Single frame is debounced before state transition');

    // Test 8: 2nd FORWARD frame confirms transition to FORWARD
    tracker.processPose(forwardEst);
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.FORWARD, '2nd consecutive frame confirms HEAD_FORWARD state');
    assert(stateEvents.length === 1 && stateEvents[0].type === HEAD_STATE_EVENTS.HEAD_FORWARD, 'Emits HEAD_FORWARD event');

    // Test 9: Single noisy LEFT frame ignored (no rapid flickering)
    const leftEst = { orientation: HEAD_ORIENTATIONS.LEFT, confidence: 0.9, timestamp: 2000, metrics: { yaw: -0.2, pitch: 0 } };
    tracker.processPose(leftEst);
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.FORWARD, 'Single noisy LEFT frame does not break FORWARD state');

    // Test 10: 2nd LEFT frame confirms transition to LEFT
    tracker.processPose(leftEst);
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.LEFT, '2nd consecutive LEFT frame confirms HEAD_LEFT state');
    assert(stateEvents.length === 2 && stateEvents[1].type === HEAD_STATE_EVENTS.HEAD_LEFT, 'Emits HEAD_LEFT event');

    // Test 11: Reset clears state back to UNKNOWN
    tracker.reset();
    assert(tracker.getCurrentState() === HEAD_ORIENTATIONS.UNKNOWN, 'Reset restores UNKNOWN state');
  }

  // --- 3. THRESHOLD CONFIGURATION TESTS ---
  {
    const strictLandmarks = createMockLandmarks({ noseX: 0.51 }); // Small offset (yaw = 0.05)
    const resDefault = estimateHeadPose(strictLandmarks, { yawThreshold: 0.14 });
    assert(resDefault.orientation === HEAD_ORIENTATIONS.FORWARD, 'Small offset stays FORWARD under default threshold (0.14)');

    const resStrict = estimateHeadPose(strictLandmarks, { yawThreshold: 0.04 });
    assert(resStrict.orientation === HEAD_ORIENTATIONS.RIGHT, 'Small offset triggers RIGHT under strict threshold (0.04)');
  }

  return results;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('headDetector.test.js')) {
  console.log('Running Head Pose & Orientation Tracker Unit Tests...');
  const testResults = runHeadDetectorTests();
  console.log('Test Results:', testResults);
}
