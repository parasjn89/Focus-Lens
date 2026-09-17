import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhoneTracker, PHONE_STATES, PHONE_CONFIDENCE_TIERS } from '../../src/services/phoneTracker.js';
import { filterObjectsAndClassifyScreenPeople } from '../../src/services/spatialFilter.js';

test('Phone Detection & Screen-Off Robustness Suite', async (t) => {

  await t.test('1. TEST A: Phone screen ON transitions to PHONE_PRESENT after debouncing', () => {
    const tracker = createPhoneTracker({ presentThreshold: 2 });
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_ABSENT);

    // Frame 1: High confidence (0.85) - debouncing to avoid single-frame noise
    const res1 = tracker.processObjects([{ label: 'cell phone', confidence: 0.85, boundingBox: { x: 100, y: 100, width: 80, height: 160 } }], 1000);
    assert.equal(res1.currentState, PHONE_STATES.PHONE_ABSENT, 'First frame is debounced to avoid false spike');

    // Frame 2: High confidence (0.88) - confirmed presence
    const res2 = tracker.processObjects([{ label: 'cell phone', confidence: 0.88, boundingBox: { x: 102, y: 101, width: 80, height: 160 } }], 1500);
    assert.equal(res2.currentState, PHONE_STATES.PHONE_PRESENT, 'Confirmed present on 2nd frame');
    assert.equal(res2.isPhonePresent, true);
    assert.equal(res2.confidence, 0.88);
    assert.ok(res2.event && res2.event.type === PHONE_STATES.PHONE_PRESENT);
  });

  await t.test('2. TEST B (Sustained Screen OFF): Phone with screen OFF transitions to PHONE_PRESENT across consecutive frames', () => {
    const tracker = createPhoneTracker({ presentThreshold: 2, mediumPresentThreshold: 3 });

    // Frame 1: Screen-off phone detected with medium confidence (0.26)
    const res1 = tracker.processObjects([{ label: 'cell phone', confidence: 0.26, boundingBox: { x: 150, y: 150, width: 75, height: 150 } }], 1000);
    assert.equal(res1.currentState, PHONE_STATES.PHONE_UNCERTAIN, 'Initial screen-off candidate starts as PHONE_UNCERTAIN, not false absent');
    assert.equal(res1.isUncertain, true);

    // Frame 2: Screen-off continues
    const res2 = tracker.processObjects([{ label: 'cell phone', confidence: 0.28, boundingBox: { x: 151, y: 150, width: 75, height: 150 } }], 1500);
    assert.equal(res2.currentState, PHONE_STATES.PHONE_UNCERTAIN);

    // Frame 3: Sustained evidence promotes to PHONE_PRESENT
    const res3 = tracker.processObjects([{ label: 'cell phone', confidence: 0.27, boundingBox: { x: 150, y: 152, width: 75, height: 150 } }], 2000);
    assert.equal(res3.currentState, PHONE_STATES.PHONE_PRESENT, 'Sustained screen-off detection confirms PHONE_PRESENT');
    assert.equal(res3.isPhonePresent, true);
  });

  await t.test('3. TEST B (Hysteresis): Turning screen OFF while phone is already detected retains PHONE_PRESENT', () => {
    const tracker = createPhoneTracker({ presentThreshold: 2, mediumPresentThreshold: 3 });

    // Step 1: Phone detected with screen ON (high confidence)
    tracker.processObjects([{ label: 'cell phone', confidence: 0.85 }], 1000);
    const confirmed = tracker.processObjects([{ label: 'cell phone', confidence: 0.90 }], 1500);
    assert.equal(confirmed.currentState, PHONE_STATES.PHONE_PRESENT);

    // Step 2: User turns screen OFF -> confidence drops into medium range (0.24)
    const screenOffRes = tracker.processObjects([{ label: 'cell phone', confidence: 0.24 }], 2000);
    assert.equal(screenOffRes.currentState, PHONE_STATES.PHONE_PRESENT, 'Temporal hysteresis holds PHONE_PRESENT when screen turns OFF');
    assert.equal(screenOffRes.isPhonePresent, true);
    assert.equal(screenOffRes.confidence, 0.24);

    // Continued screen-off detection maintains presence
    const screenOffRes2 = tracker.processObjects([{ label: 'cell phone', confidence: 0.25 }], 2500);
    assert.equal(screenOffRes2.currentState, PHONE_STATES.PHONE_PRESENT);
  });

  await t.test('4. TEST C: Partial occlusion / marginal confidence yields PHONE_UNCERTAIN', () => {
    const tracker = createPhoneTracker();

    // Partial occlusion results in marginal confidence (0.18)
    const res1 = tracker.processObjects([{ label: 'cell phone', confidence: 0.18 }], 1000);
    assert.equal(res1.currentState, PHONE_STATES.PHONE_UNCERTAIN, 'Partially occluded phone is flagged as UNCERTAIN');
    assert.equal(res1.isUncertain, true);
    assert.equal(res1.isPhonePresent, false);
    assert.notEqual(res1.currentState, PHONE_STATES.PHONE_ABSENT, 'Must NOT falsely claim PHONE_ABSENT when uncertain');
  });

  await t.test('5. TEST D: No phone transitions to PHONE_ABSENT after absent debouncing', () => {
    const tracker = createPhoneTracker({ absentThreshold: 3 });

    // Start with confirmed phone
    tracker.processObjects([{ label: 'cell phone', confidence: 0.85 }], 1000);
    tracker.processObjects([{ label: 'cell phone', confidence: 0.85 }], 1500);
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_PRESENT);

    // Missed frame 1: Debounced (temporary glitch protection)
    const m1 = tracker.processObjects([], 2000);
    assert.equal(m1.currentState, PHONE_STATES.PHONE_PRESENT);

    // Missed frame 2: Still debounced
    const m2 = tracker.processObjects([], 2500);
    assert.equal(m2.currentState, PHONE_STATES.PHONE_PRESENT);

    // Missed frame 3: Reaches absentThreshold -> PHONE_ABSENT
    const m3 = tracker.processObjects([], 3000);
    assert.equal(m3.currentState, PHONE_STATES.PHONE_ABSENT, 'Switches to PHONE_ABSENT after absentThreshold');
    assert.equal(m3.confidence, null);
  });

  await t.test('6. TEST E: Laptop, remote, book are NOT classified as cell phone', () => {
    const tracker = createPhoneTracker();

    // Frame with remote and book
    const nonPhoneObjects = [
      { label: 'remote', confidence: 0.92, boundingBox: { x: 50, y: 50, width: 40, height: 120 } },
      { label: 'book', confidence: 0.88, boundingBox: { x: 200, y: 100, width: 150, height: 200 } },
      { label: 'laptop', confidence: 0.95, boundingBox: { x: 400, y: 100, width: 300, height: 250 } },
    ];

    const res1 = tracker.processObjects(nonPhoneObjects, 1000);
    assert.equal(res1.currentState, PHONE_STATES.PHONE_ABSENT);

    const res2 = tracker.processObjects(nonPhoneObjects, 1500);
    assert.equal(res2.currentState, PHONE_STATES.PHONE_ABSENT);
    assert.equal(res2.isPhonePresent, false);
  });

  await t.test('7. Spatial Filter: Person on phone screen is correctly separated and does not inflate real person count', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.90, boundingBox: { x: 100, y: 100, width: 200, height: 300 } },
      { label: 'person', confidence: 0.88, boundingBox: { x: 110, y: 110, width: 150, height: 220 } }, // displayed person
    ];

    const result = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(result.rawPersonCount, 1);
    assert.equal(result.personOnPhoneCount, 1);
    assert.equal(result.realPersonCount, 0, 'Displayed person on phone must not be counted as real person');
    assert.equal(result.isPhonePresent, true);
    assert.equal(result.isPersonOnPhoneScreen, true);
  });

  await t.test('8. Spatial Filter: Two real people + phone -> realPersonCount = 2', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.85, boundingBox: { x: 50, y: 50, width: 80, height: 120 } },
      { label: 'person', confidence: 0.94, boundingBox: { x: 150, y: 50, width: 150, height: 300 } }, // Real person 1
      { label: 'person', confidence: 0.92, boundingBox: { x: 400, y: 50, width: 150, height: 300 } }, // Real person 2
    ];

    const result = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(result.rawPersonCount, 2);
    assert.equal(result.realPersonCount, 2);
    assert.equal(result.personOnPhoneCount, 0);
    assert.equal(result.isPhonePresent, true);
  });

  await t.test('9. Spatial Filter: One real person + phone with screen off -> realPersonCount = 1', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.28, boundingBox: { x: 80, y: 150, width: 70, height: 140 } },
      { label: 'person', confidence: 0.95, boundingBox: { x: 250, y: 50, width: 200, height: 400 } },
    ];

    const result = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(result.rawPersonCount, 1);
    assert.equal(result.realPersonCount, 1);
    assert.equal(result.personOnPhoneCount, 0);
    assert.equal(result.isPhonePresent, true);
  });

  await t.test('10. Phone Detection Stability: Resists transient frame flickers', () => {
    const tracker = createPhoneTracker({ presentThreshold: 2, absentThreshold: 3 });

    // Establish PHONE_PRESENT
    tracker.processObjects([{ label: 'cell phone', confidence: 0.85 }], 1000);
    tracker.processObjects([{ label: 'cell phone', confidence: 0.85 }], 1500);
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_PRESENT);

    // Frame drop 1 (camera blur/exposure flicker)
    tracker.processObjects([], 2000);
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_PRESENT, 'Single dropped frame does not flicker state');

    // Phone reappears with screen off (conf 0.25)
    tracker.processObjects([{ label: 'cell phone', confidence: 0.25 }], 2500);
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_PRESENT, 'Reappearing screen-off phone holds state continuously');

    // Reset clears state
    tracker.reset();
    assert.equal(tracker.getCurrentState(), PHONE_STATES.PHONE_ABSENT, 'Reset restores PHONE_ABSENT');
  });

});
