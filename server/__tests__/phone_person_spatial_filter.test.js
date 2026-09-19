import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterObjectsAndClassifyScreenPeople,
  calculateBoxIntersection,
  calculateBoxArea,
  calculateBoxIoU,
  calculateBoxContainment,
  deduplicatePersonDetections,
} from '../../src/services/spatialFilter.js';
import { createPersonTracker, PERSON_STATES } from '../../src/services/personTracker.js';
import { classifyMultimodalActivity, ACTIVITY_TYPES } from '../../src/services/activityAnalyzer.js';

test('Spatial Filter Geometry Helpers', async (t) => {
  await t.test('calculateBoxArea calculates area correctly', () => {
    assert.equal(calculateBoxArea({ x: 0, y: 0, width: 100, height: 200 }), 20000);
    assert.equal(calculateBoxArea(null), 0);
    assert.equal(calculateBoxArea({ width: -10, height: 50 }), 0);
  });

  await t.test('calculateBoxIntersection computes exact overlap rectangle area', () => {
    const boxA = { x: 0, y: 0, width: 100, height: 100 };
    const boxB = { x: 50, y: 50, width: 100, height: 100 };
    // Overlap rectangle is [50, 50] to [100, 100], area = 50 * 50 = 2500
    assert.equal(calculateBoxIntersection(boxA, boxB), 2500);

    const nonOverlapping = { x: 200, y: 200, width: 50, height: 50 };
    assert.equal(calculateBoxIntersection(boxA, nonOverlapping), 0);
  });

  await t.test('calculateBoxIoU computes standard Intersection-over-Union', () => {
    // Two boxes with 50x50 overlap: areaA = 10000, areaB = 10000, inter = 2500, union = 17500
    const boxA = { x: 0, y: 0, width: 100, height: 100 };
    const boxB = { x: 50, y: 50, width: 100, height: 100 };
    const expectedIoU = 2500 / 17500; // ~0.1428
    assert.ok(Math.abs(calculateBoxIoU(boxA, boxB) - expectedIoU) < 0.001);
    assert.equal(calculateBoxIoU(boxA, { x: 300, y: 300, width: 50, height: 50 }), 0);
  });

  await t.test('calculateBoxContainment computes fraction of smaller box inside larger box', () => {
    // Smaller box (50x50 = 2500) entirely inside larger box (100x100 = 10000)
    const largeBox = { x: 0, y: 0, width: 100, height: 100 };
    const smallBox = { x: 20, y: 20, width: 50, height: 50 };
    assert.equal(calculateBoxContainment(largeBox, smallBox), 1.0);

    // Partial containment: smaller box (50x50) has 50x25 = 1250 inside largeBox -> 0.5 (50%)
    const partialSmallBox = { x: 75, y: 20, width: 50, height: 50 };
    assert.equal(calculateBoxContainment(largeBox, partialSmallBox), 0.5);
  });
});

test('Phone Screen Person Detection & Spatial Filtering Matrix', async (t) => {
  await t.test('1. Person fully outside phone is classified as REAL_PERSON', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.9, boundingBox: { x: 50, y: 50, width: 100, height: 150 } },
      { label: 'person', confidence: 0.95, boundingBox: { x: 300, y: 100, width: 200, height: 400 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 1);
    assert.equal(res.realPersonCount, 1);
    assert.equal(res.personOnPhoneCount, 0);
    assert.equal(res.isPhonePresent, true);
    assert.equal(res.isPersonOnPhoneScreen, false);
  });

  await t.test('2. Person fully inside phone bounding box is classified as PERSON_ON_PHONE_SCREEN', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.92, boundingBox: { x: 100, y: 100, width: 200, height: 300 } },
      { label: 'person', confidence: 0.88, boundingBox: { x: 120, y: 120, width: 150, height: 200 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 1);
    assert.equal(res.realPersonCount, 0);
    assert.equal(res.personOnPhoneCount, 1);
    assert.equal(res.isPersonOnPhoneScreen, true);
    assert.equal(res.phoneScreenPersonDetections[0].isOnPhoneScreen, true);
  });

  await t.test('3. Person partially overlapping phone below threshold stays REAL_PERSON', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.85, boundingBox: { x: 100, y: 100, width: 100, height: 100 } },
      // Person box has 10% overlap with phone box
      { label: 'person', confidence: 0.90, boundingBox: { x: 190, y: 100, width: 200, height: 400 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 1);
    assert.equal(res.realPersonCount, 1);
    assert.equal(res.personOnPhoneCount, 0);
  });

  await t.test('4. Two real physical people outside phone -> count 2', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.9, boundingBox: { x: 50, y: 50, width: 80, height: 120 } },
      { label: 'person', confidence: 0.95, boundingBox: { x: 200, y: 50, width: 150, height: 300 } },
      { label: 'person', confidence: 0.92, boundingBox: { x: 400, y: 50, width: 150, height: 300 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 2);
    assert.equal(res.realPersonCount, 2);
    assert.equal(res.personOnPhoneCount, 0);
  });

  await t.test('5. Two real people + one displayed person on phone screen -> realCount = 2, not 3', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.91, boundingBox: { x: 300, y: 300, width: 150, height: 250 } },
      { label: 'person', confidence: 0.96, boundingBox: { x: 50, y: 50, width: 150, height: 300 } }, // Real person #1
      { label: 'person', confidence: 0.94, boundingBox: { x: 500, y: 50, width: 150, height: 300 } }, // Real person #2
      { label: 'person', confidence: 0.85, boundingBox: { x: 310, y: 310, width: 120, height: 180 } }, // Displayed person inside phone
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 3);
    assert.equal(res.realPersonCount, 2);
    assert.equal(res.personOnPhoneCount, 1);
  });

  await t.test('6. No real person + phone showing a displayed person -> realCount = 0', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.93, boundingBox: { x: 100, y: 100, width: 200, height: 300 } },
      { label: 'person', confidence: 0.87, boundingBox: { x: 110, y: 110, width: 160, height: 220 } }, // Displayed person inside phone
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 1);
    assert.equal(res.realPersonCount, 0);
    assert.equal(res.personOnPhoneCount, 1);
  });

  await t.test('7. No phone detected -> normal person count behavior', () => {
    const detections = [
      { label: 'person', confidence: 0.92, boundingBox: { x: 100, y: 100, width: 200, height: 400 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 1);
    assert.equal(res.realPersonCount, 1);
    assert.equal(res.personOnPhoneCount, 0);
    assert.equal(res.isPhonePresent, false);
  });

  await t.test('8. Missing / invalid bounding boxes -> safe fallback without throwing', () => {
    const detections = [
      { label: 'cell phone', confidence: 0.8, boundingBox: null },
      { label: 'person', confidence: 0.9, boundingBox: { x: 100, y: 100, width: 0, height: 0 } },
      { label: 'person', confidence: 0.95 },
    ];

    assert.doesNotThrow(() => {
      const res = filterObjectsAndClassifyScreenPeople(detections);
      assert.equal(typeof res.realPersonCount, 'number');
    });
  });

  await t.test('9. Ambiguous geometry does NOT falsely assert MULTIPLE_PEOPLE', () => {
    const tracker = createPersonTracker({ stabilityThreshold: 2 });
    
    // 1 Real person + 1 displayed person on phone screen
    const rawFrame = [
      { label: 'cell phone', confidence: 0.9, boundingBox: { x: 300, y: 300, width: 150, height: 250 } },
      { label: 'person', confidence: 0.95, boundingBox: { x: 50, y: 50, width: 150, height: 300 } }, // Real person
      { label: 'person', confidence: 0.86, boundingBox: { x: 310, y: 310, width: 120, height: 180 } }, // On phone screen
    ];

    tracker.processObjects(rawFrame, 1000);
    const res = tracker.processObjects(rawFrame, 1500);

    assert.equal(res.count, 1, 'Stable person count must be 1 (real physical person)');
    assert.equal(res.currentState, PERSON_STATES.ONE_PERSON, 'Person state must be ONE_PERSON');

    // Verify activity analyzer does NOT classify as MULTIPLE_PEOPLE
    const activity = classifyMultimodalActivity({
      isCameraActive: true,
      isFacePresent: true,
      isPhonePresent: true,
      personCount: res.count, // 1
      rawPersonCount: res.rawCount, // 2
      personOnPhoneCount: res.personOnPhoneCount, // 1
      headOrientation: 'FORWARD',
    });

    assert.notEqual(activity.type, ACTIVITY_TYPES.MULTIPLE_PEOPLE, 'Must NOT trigger MULTIPLE_PEOPLE activity');
    assert.equal(activity.type, ACTIVITY_TYPES.PHONE_ACTIVITY, 'Triggers PHONE_ACTIVITY correctly');
  });

  await t.test('10. Regression Fix: Single person with overlapping boxes (torso + upper body) deduplicates to realPersonCount = 1', () => {
    // MediaPipe outputs two boxes for the same user:
    // Box A: Torso & upper body [120, 80, 380, 400], score 0.91
    // Box B: Upper body / head [160, 90, 280, 260], score 0.52 (contained inside Box A)
    const detections = [
      { label: 'person', confidence: 0.91, boundingBox: { x: 120, y: 80, width: 380, height: 400 } },
      { label: 'person', confidence: 0.52, boundingBox: { x: 160, y: 90, width: 280, height: 260 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 2, 'Raw detection count is 2');
    assert.equal(res.realPersonCount, 1, 'Real person count must be exactly 1 after overlap deduplication');
    assert.equal(res.duplicatePersonCount, 1, 'Duplicate person count must be 1');
    assert.equal(res.realPersonDetections.length, 1);
    assert.equal(res.realPersonDetections[0].confidence, 0.91, 'Retains higher confidence');
  });

  await t.test('11. Regression Fix: Real person + low-confidence background false positive (e.g. chair/shadow) is filtered out', () => {
    // Model threshold is 0.15 for phones, so background object produces person detection with 0.20 score
    const detections = [
      { label: 'person', confidence: 0.93, boundingBox: { x: 150, y: 100, width: 300, height: 400 } }, // Real person
      { label: 'person', confidence: 0.20, boundingBox: { x: 500, y: 200, width: 80, height: 100 } }, // Background noise / chair
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 2, 'Raw detections count is 2');
    assert.equal(res.realPersonCount, 1, 'Real person count must be 1 (0.20 noise filtered out)');
    assert.equal(res.realPersonDetections[0].confidence, 0.93);
  });

  await t.test('12. Regression Verification: Two genuinely separate people (side by side) are both counted -> realPersonCount = 2', () => {
    const detections = [
      { label: 'person', confidence: 0.94, boundingBox: { x: 60, y: 80, width: 200, height: 350 } }, // Person 1 on left
      { label: 'person', confidence: 0.91, boundingBox: { x: 380, y: 80, width: 200, height: 350 } }, // Person 2 on right
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 2);
    assert.equal(res.realPersonCount, 2, 'Two separated people must be counted as 2');
    assert.equal(res.duplicatePersonCount, 0);
  });

  await t.test('13. Regression Verification: Two people with partial occlusion below overlap threshold -> realPersonCount = 2', () => {
    // Person 1 in front, Person 2 partially behind (small 15% IoU overlap, well below 35% IoU and 50% containment)
    const detections = [
      { label: 'person', confidence: 0.95, boundingBox: { x: 100, y: 100, width: 220, height: 350 } },
      { label: 'person', confidence: 0.88, boundingBox: { x: 260, y: 80, width: 200, height: 320 } },
    ];

    const res = filterObjectsAndClassifyScreenPeople(detections);
    assert.equal(res.rawPersonCount, 2);
    assert.equal(res.realPersonCount, 2, 'Two partially occluded people must still count as 2');
    assert.equal(res.duplicatePersonCount, 0);
  });

  await t.test('14. End-to-End Tracker: Single person with overlapping boxes updates PersonTracker to ONE_PERSON, never MULTIPLE_PEOPLE', () => {
    const tracker = createPersonTracker({ stabilityThreshold: 2 });
    
    // Frame with 1 physical person who generated 2 overlapping raw boxes from detector
    const rawFrame = [
      { label: 'person', confidence: 0.92, boundingBox: { x: 150, y: 80, width: 320, height: 420 } },
      { label: 'person', confidence: 0.60, boundingBox: { x: 180, y: 90, width: 240, height: 260 } },
    ];

    tracker.processObjects(rawFrame, 1000);
    const res = tracker.processObjects(rawFrame, 1500);

    assert.equal(res.rawCount, 2, 'Raw count is 2');
    assert.equal(res.duplicatePersonCount, 1, 'Duplicate count is 1');
    assert.equal(res.count, 1, 'Stable person count must be exactly 1');
    assert.equal(res.currentState, PERSON_STATES.ONE_PERSON, 'State must be ONE_PERSON, not MULTIPLE_PEOPLE');

    // Verify activity analyzer confirms ONE_PERSON / NOT MULTIPLE_PEOPLE
    const activity = classifyMultimodalActivity({
      isCameraActive: true,
      isFacePresent: true,
      isPhonePresent: false,
      personCount: res.count, // 1
      rawPersonCount: res.rawCount, // 2
      headOrientation: 'FORWARD',
    });

    assert.notEqual(activity.type, ACTIVITY_TYPES.MULTIPLE_PEOPLE, 'Must NEVER trigger MULTIPLE_PEOPLE for 1 person');
  });
});
