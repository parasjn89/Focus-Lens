import { createPhoneTracker, PHONE_STATES } from '../services/phoneTracker.js';
import { createPersonTracker, PERSON_STATES } from '../services/personTracker.js';
import { createEventEngine } from '../services/eventEngine.js';

export function runObjectDetectorTests() {
  const results = [];

  const assert = (condition, testName) => {
    if (condition) {
      results.push({ name: testName, status: 'PASSED' });
    } else {
      results.push({ name: testName, status: 'FAILED' });
      throw new Error(`Test Failed: ${testName}`);
    }
  };

  // --- PHONE DETECTOR TESTS ---
  {
    // Test 1: Initial state is PHONE_ABSENT
    const tracker = createPhoneTracker();
    assert(tracker.getCurrentState() === PHONE_STATES.PHONE_ABSENT, 'Phone Tracker initial state is PHONE_ABSENT');

    // Test 2: Single noisy frame does NOT trigger PHONE_PRESENT (Debounced)
    const objects1 = [{ label: 'cell phone', confidence: 0.9, timestamp: 1000 }];
    const res1 = tracker.processObjects(objects1, 1000);
    assert(res1.currentState === PHONE_STATES.PHONE_ABSENT, 'Single phone detection frame is debounced');

    // Test 3: Reaching presentThreshold (2 frames) triggers PHONE_PRESENT
    const res2 = tracker.processObjects(objects1, 1500);
    assert(res2.currentState === PHONE_STATES.PHONE_PRESENT, 'Reaching presentThreshold switches to PHONE_PRESENT');
    assert(res2.event !== null && res2.event.type === PHONE_STATES.PHONE_PRESENT, 'Emits PHONE_PRESENT event');

    // Test 4: Single missed frame does NOT immediately switch back to PHONE_ABSENT
    const res3 = tracker.processObjects([], 2000);
    assert(res3.currentState === PHONE_STATES.PHONE_PRESENT, 'Single missing phone frame is ignored');

    // Test 5: Reaching absentThreshold (3 missing frames) switches back to PHONE_ABSENT
    tracker.processObjects([], 2500);
    const res4 = tracker.processObjects([], 3000);
    assert(res4.currentState === PHONE_STATES.PHONE_ABSENT, 'Reaching absentThreshold switches to PHONE_ABSENT');
  }

  // --- PERSON DETECTOR TESTS ---
  {
    // Test 6: Initial person state is NO_PERSON
    const pTracker = createPersonTracker();
    assert(pTracker.getCurrentState() === PERSON_STATES.NO_PERSON, 'Person Tracker initial state is NO_PERSON');

    // Test 7: Detect 1 person over stabilityThreshold (2 frames) -> ONE_PERSON
    const onePersonObj = [{ label: 'person', confidence: 0.9, timestamp: 1000, boundingBox: { x: 50, y: 50, width: 100, height: 200 } }];
    pTracker.processObjects(onePersonObj, 1000);
    const pRes1 = pTracker.processObjects(onePersonObj, 1500);
    assert(pRes1.currentState === PERSON_STATES.ONE_PERSON, '2 frames of 1 person switches to ONE_PERSON');
    assert(pRes1.count === 1, 'Stable count is 1');

    // Test 8: Detect 2 people over stabilityThreshold -> MULTIPLE_PEOPLE
    const twoPeopleObjs = [
      { label: 'person', confidence: 0.95, timestamp: 2000, boundingBox: { x: 50, y: 50, width: 100, height: 200 } },
      { label: 'person', confidence: 0.88, timestamp: 2000, boundingBox: { x: 300, y: 50, width: 100, height: 200 } }
    ];
    pTracker.processObjects(twoPeopleObjs, 2000);
    const pRes2 = pTracker.processObjects(twoPeopleObjs, 2500);
    assert(pRes2.currentState === PERSON_STATES.MULTIPLE_PEOPLE, '2 frames of 2 people switches to MULTIPLE_PEOPLE');
    assert(pRes2.count === 2, 'Stable count is 2');

    // Test 9: Return to 0 people over 2 frames -> NO_PERSON
    pTracker.processObjects([], 3000);
    const pRes3 = pTracker.processObjects([], 3500);
    assert(pRes3.currentState === PERSON_STATES.NO_PERSON, 'Reverts to NO_PERSON');
    assert(pRes3.count === 0, 'Stable count is 0');
  }

  // --- EVENT ENGINE TESTS ---
  {
    // Test 10: Event Engine span duration calculation for PHONE_PRESENT
    const completedSpans = [];
    const engine = createEventEngine({
      onSpanCompleted: (span) => completedSpans.push(span),
    });

    const tStart = 10000;
    const tEnd = 25000; // 15 seconds later

    engine.processObservation({ type: 'PHONE_PRESENT', timestamp: tStart, confidence: 0.92 });
    assert(engine.getActiveSpans().length === 1, 'Event Engine opens active span for PHONE_PRESENT');

    engine.processObservation({ type: 'PHONE_ABSENT', timestamp: tEnd });
    assert(engine.getActiveSpans().length === 0, 'Event Engine closes active span');
    assert(completedSpans.length === 1, 'Emits completed span record');
    assert(completedSpans[0].durationSeconds === 15, 'Calculates exact duration in seconds (15s)');

    // Test 11: Event Engine MULTIPLE_PEOPLE span calculation
    engine.processObservation({ type: 'MULTIPLE_PEOPLE', state: 'MULTIPLE_PEOPLE', count: 2, timestamp: 30000 });
    assert(engine.getActiveSpans().length === 1, 'Opens MULTIPLE_PEOPLE active span');

    engine.processObservation({ type: 'ONE_PERSON', state: 'ONE_PERSON', count: 1, timestamp: 42000 });
    assert(completedSpans.length === 2, 'Completes MULTIPLE_PEOPLE span');
    assert(completedSpans[1].durationSeconds === 12, 'Calculates 12s duration for MULTIPLE_PEOPLE');

    // Test 12: Event Engine Reset clears all spans
    engine.processObservation({ type: 'PHONE_PRESENT', timestamp: 50000 });
    engine.reset();
    assert(engine.getActiveSpans().length === 0, 'Reset clears open active spans');
    assert(engine.getCompletedSpans().length === 0, 'Reset clears completed spans');
  }

  return results;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('objectDetector.test.js')) {
  console.log('Running Object Detector & Event Engine Unit Tests...');
  const testResults = runObjectDetectorTests();
  console.log('Test Results:', testResults);
}
