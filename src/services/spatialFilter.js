/**
 * Spatial filtering utility for FocusLens object detection pipeline.
 * Calculates spatial containment and overlap between detected objects
 * to distinguish physical people in camera view from on-screen displayed people (e.g. photos/videos on phones).
 */

/**
 * Calculates intersection area between two 2D bounding boxes.
 * Bounding box format: { x: number, y: number, width: number, height: number }
 */
export function calculateBoxIntersection(boxA, boxB) {
  if (!boxA || !boxB) return 0;
  
  const x1 = Math.max(Number(boxA.x) || 0, Number(boxB.x) || 0);
  const y1 = Math.max(Number(boxA.y) || 0, Number(boxB.y) || 0);
  const x2 = Math.min((Number(boxA.x) || 0) + (Number(boxA.width) || 0), (Number(boxB.x) || 0) + (Number(boxB.width) || 0));
  const y2 = Math.min((Number(boxA.y) || 0) + (Number(boxA.height) || 0), (Number(boxB.y) || 0) + (Number(boxB.height) || 0));

  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);

  return width * height;
}

/**
 * Calculates bounding box area.
 */
export function calculateBoxArea(box) {
  if (!box) return 0;
  const w = Math.max(0, Number(box.width) || 0);
  const h = Math.max(0, Number(box.height) || 0);
  return w * h;
}

/**
 * Processes an array of raw object detections and separates physical people
 * from on-screen person detections displayed on phone screens.
 * 
 * @param {Array<Object>} detectedObjects Array of raw detection objects
 * @param {Object} options Configuration thresholds for spatial containment
 * @param {number} [options.minOverlapRatio=0.45] Fraction of person box inside phone box to mark as on-screen
 * @returns {Object} Spatial filter results
 */
export function filterObjectsAndClassifyScreenPeople(detectedObjects = [], options = {}) {
  const { minOverlapRatio = 0.45 } = options;

  if (!Array.isArray(detectedObjects) || detectedObjects.length === 0) {
    return {
      processedObjects: [],
      phoneDetections: [],
      allPersonDetections: [],
      realPersonDetections: [],
      phoneScreenPersonDetections: [],
      rawPersonCount: 0,
      realPersonCount: 0,
      personOnPhoneCount: 0,
      isPhonePresent: false,
      isPersonOnPhoneScreen: false,
    };
  }

  const phoneDetections = [];
  const personDetections = [];
  const otherDetections = [];

  detectedObjects.forEach((obj) => {
    if (!obj) return;
    const label = (obj.label || '').toLowerCase();
    if (label === 'cell phone' || label === 'phone' || label === 'mobile') {
      phoneDetections.push(obj);
    } else if (label === 'person') {
      personDetections.push(obj);
    } else {
      otherDetections.push(obj);
    }
  });

  const realPersonDetections = [];
  const phoneScreenPersonDetections = [];

  personDetections.forEach((personObj) => {
    const pBox = personObj.boundingBox;
    const pArea = calculateBoxArea(pBox);

    let isOnPhoneScreen = false;
    let matchedPhoneBox = null;
    let maxOverlapRatio = 0;

    if (pArea > 0 && phoneDetections.length > 0 && pBox) {
      for (const phoneObj of phoneDetections) {
        const phBox = phoneObj.boundingBox;
        const phArea = calculateBoxArea(phBox);
        if (phArea <= 0 || !phBox) continue;

        const interArea = calculateBoxIntersection(pBox, phBox);
        const overlapRatio = interArea / pArea;
        const phoneCoverageRatio = interArea / phArea;

        // Condition A: Substantial portion (>= minOverlapRatio) of the person box lies inside phone box
        // Condition B: Person box is comparable in size to phone box and heavily overlaps phone box
        const isContained = overlapRatio >= minOverlapRatio;
        const isPhoneSizedOverlap = (pArea <= 1.6 * phArea) && (overlapRatio >= 0.35) && (phoneCoverageRatio >= 0.35);

        if (isContained || isPhoneSizedOverlap) {
          if (overlapRatio > maxOverlapRatio) {
            maxOverlapRatio = overlapRatio;
            isOnPhoneScreen = true;
            matchedPhoneBox = phBox;
          }
        }
      }
    }

    if (isOnPhoneScreen) {
      const annotatedPerson = {
        ...personObj,
        label: 'person_on_phone_screen',
        originalLabel: 'person',
        isOnPhoneScreen: true,
        overlapRatio: Math.round(maxOverlapRatio * 100) / 100,
        matchedPhoneBox,
      };
      phoneScreenPersonDetections.push(annotatedPerson);
    } else {
      const annotatedPerson = {
        ...personObj,
        isOnPhoneScreen: false,
      };
      realPersonDetections.push(annotatedPerson);
    }
  });

  const processedObjects = [
    ...phoneDetections,
    ...realPersonDetections,
    ...phoneScreenPersonDetections,
    ...otherDetections,
  ];

  return {
    processedObjects,
    phoneDetections,
    allPersonDetections: personDetections,
    realPersonDetections,
    phoneScreenPersonDetections,
    rawPersonCount: personDetections.length,
    realPersonCount: realPersonDetections.length,
    personOnPhoneCount: phoneScreenPersonDetections.length,
    isPhonePresent: phoneDetections.length > 0,
    isPersonOnPhoneScreen: phoneScreenPersonDetections.length > 0,
  };
}
