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
 * Calculates Intersection-over-Union (IoU) between two bounding boxes.
 */
export function calculateBoxIoU(boxA, boxB) {
  if (!boxA || !boxB) return 0;
  const interArea = calculateBoxIntersection(boxA, boxB);
  if (interArea <= 0) return 0;
  const areaA = calculateBoxArea(boxA);
  const areaB = calculateBoxArea(boxB);
  const unionArea = areaA + areaB - interArea;
  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

/**
 * Calculates containment ratio (Intersection-over-Smaller box, IoS).
 * Returns fraction (0 to 1) of the smaller box that lies inside the larger box.
 */
export function calculateBoxContainment(boxA, boxB) {
  if (!boxA || !boxB) return 0;
  const interArea = calculateBoxIntersection(boxA, boxB);
  if (interArea <= 0) return 0;
  const areaA = calculateBoxArea(boxA);
  const areaB = calculateBoxArea(boxB);
  const minArea = Math.min(areaA, areaB);
  if (minArea <= 0) return 0;
  return interArea / minArea;
}

/**
 * Calculates 1D linear intersection length between two segments [startA, endA] and [startB, endB].
 */
export function calculate1DOverlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

/**
 * Checks whether a 2D point (px, py) lies within a bounding box.
 */
export function isPointInsideBox(px, py, box) {
  if (!box) return false;
  const bx = Number(box.x) || 0;
  const by = Number(box.y) || 0;
  const bw = Number(box.width) || 0;
  const bh = Number(box.height) || 0;
  return px >= bx && px <= bx + bw && py >= by && py <= by + bh;
}

/**
 * Deduplicates overlapping person detections for the same physical person
 * and filters out low-confidence background false positives.
 * 
 * Handles:
 * 1. Standard 2D Intersection-over-Union (IoU) overlap
 * 2. Containment (smaller box inside larger box, e.g. head/chest inside body)
 * 3. Centroid containment (center point of candidate inside accepted box or vice-versa)
 * 4. Anatomical vertical column alignment (overlapping horizontal column with vertical overlap or contiguous gap)
 * 5. Two-tier confidence threshold (allows solitary person at 0.35, but rejects secondary ghost detections < 0.45)
 * 
 * @param {Array<Object>} personCandidates Raw candidate person detections
 * @param {Object} options Threshold options
 * @param {number} [options.minConfidence=0.45] Minimum confidence required for secondary/additional physical person
 * @param {number} [options.minPrimaryConfidence=0.35] Minimum confidence for primary/solitary person
 * @param {number} [options.maxOverlapIoU=0.25] IoU threshold above which boxes belong to same person
 * @param {number} [options.maxContainment=0.35] Containment threshold above which smaller box is part of same person
 * @param {number} [options.maxHorizontalOverlap=0.45] Horizontal overlap ratio threshold for column alignment
 * @returns {{ uniqueDetections: Array<Object>, duplicateDetections: Array<Object> }}
 */
export function deduplicatePersonDetections(personCandidates = [], options = {}) {
  const {
    minConfidence = 0.45,
    minPrimaryConfidence = 0.35,
    maxOverlapIoU = 0.25,
    maxContainment = 0.35,
    maxHorizontalOverlap = 0.45,
  } = options;

  if (!Array.isArray(personCandidates) || personCandidates.length === 0) {
    return { uniqueDetections: [], duplicateDetections: [] };
  }

  // Filter out extreme low-confidence noise when score is explicitly provided
  const validCandidates = personCandidates.filter((cand) => {
    if (!cand) return false;
    if (typeof cand.confidence === 'number' && cand.confidence < minPrimaryConfidence) {
      return false;
    }
    return true;
  });

  if (validCandidates.length === 0) {
    return { uniqueDetections: [], duplicateDetections: [] };
  }

  // Sort by confidence descending so strongest anchor represents the person
  const sorted = [...validCandidates].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

  const uniqueDetections = [];
  const duplicateDetections = [];

  for (const candidate of sorted) {
    const candBox = candidate.boundingBox;
    const candArea = calculateBoxArea(candBox);

    if (!candBox || candArea <= 0) {
      if (uniqueDetections.length === 0) {
        uniqueDetections.push(candidate);
      } else {
        duplicateDetections.push(candidate);
      }
      continue;
    }

    let isDuplicate = false;
    let matchedAcceptedIndex = -1;

    for (let i = 0; i < uniqueDetections.length; i++) {
      const accepted = uniqueDetections[i];
      const accBox = accepted.boundingBox;
      const accArea = calculateBoxArea(accBox);
      if (!accBox || accArea <= 0) continue;

      // Condition 1: 2D IoU overlap
      const iou = calculateBoxIoU(candBox, accBox);
      if (iou >= maxOverlapIoU) {
        isDuplicate = true;
        matchedAcceptedIndex = i;
        break;
      }

      // Condition 2: 2D Containment ratio (IoS)
      const containment = calculateBoxContainment(candBox, accBox);
      if (containment >= maxContainment) {
        isDuplicate = true;
        matchedAcceptedIndex = i;
        break;
      }

      // Condition 3: Centroid containment (center of candidate box is inside accepted box or vice-versa)
      const candCenterX = candBox.x + candBox.width / 2;
      const candCenterY = candBox.y + candBox.height / 2;
      const accCenterX = accBox.x + accBox.width / 2;
      const accCenterY = accBox.y + accBox.height / 2;

      if (isPointInsideBox(candCenterX, candCenterY, accBox) || isPointInsideBox(accCenterX, accCenterY, candBox)) {
        isDuplicate = true;
        matchedAcceptedIndex = i;
        break;
      }

      // Condition 4: Anatomical vertical column alignment (head/torso/chest stacking)
      const interX = calculate1DOverlap(
        candBox.x,
        candBox.x + candBox.width,
        accBox.x,
        accBox.x + accBox.width
      );
      const minW = Math.min(candBox.width, accBox.width);
      const horizontalOverlap = minW > 0 ? interX / minW : 0;

      if (horizontalOverlap >= maxHorizontalOverlap) {
        const interY = calculate1DOverlap(
          candBox.y,
          candBox.y + candBox.height,
          accBox.y,
          accBox.y + accBox.height
        );
        const minH = Math.min(candBox.height, accBox.height);

        // Subcase 4a: Overlapping vertical span along same horizontal column
        if (interY > 0) {
          isDuplicate = true;
          matchedAcceptedIndex = i;
          break;
        }

        // Subcase 4b: Vertically contiguous/adjacent with small gap (<= 20% min height)
        const gapY = Math.max(candBox.y, accBox.y) - Math.min(candBox.y + candBox.height, accBox.y + accBox.height);
        if (gapY <= 0.20 * minH) {
          isDuplicate = true;
          matchedAcceptedIndex = i;
          break;
        }
      }
    }

    if (isDuplicate) {
      // Merge bounding box to cover the union of both detections and retain highest confidence
      const accepted = uniqueDetections[matchedAcceptedIndex];
      const accBox = accepted.boundingBox;
      const x1 = Math.min(accBox.x, candBox.x);
      const y1 = Math.min(accBox.y, candBox.y);
      const x2 = Math.max(accBox.x + accBox.width, candBox.x + candBox.width);
      const y2 = Math.max(accBox.y + accBox.height, candBox.y + candBox.height);

      accepted.boundingBox = {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      };
      accepted.confidence = Math.max(accepted.confidence || 0, candidate.confidence || 0);

      duplicateDetections.push({
        ...candidate,
        isDuplicatePerson: true,
        duplicateOf: accepted,
      });
    } else {
      // Not a duplicate of existing accepted person
      if (uniqueDetections.length === 0) {
        // Solitary/primary candidate accepted (meets minPrimaryConfidence)
        uniqueDetections.push({ ...candidate });
      } else if ((candidate.confidence || 0) >= minConfidence) {
        // Secondary distinct physical person candidate requires higher confidence (>= minConfidence)
        uniqueDetections.push({ ...candidate });
      } else {
        // Discard low-confidence background clutter/false positive
        duplicateDetections.push({
          ...candidate,
          isLowConfidenceNoise: true,
        });
      }
    }
  }

  return { uniqueDetections, duplicateDetections };
}

/**
 * Processes an array of raw object detections and separates physical people
 * from on-screen person detections displayed on phone screens.
 * 
 * @param {Array<Object>} detectedObjects Array of raw detection objects
 * @param {Object} options Configuration thresholds for spatial containment
 * @param {number} [options.minOverlapRatio=0.45] Fraction of person box inside phone box to mark as on-screen
 * @param {number} [options.minPersonConfidence=0.35] Minimum confidence for physical person
 * @param {number} [options.maxOverlapIoU=0.35] IoU threshold above which boxes belong to same person
 * @param {number} [options.maxContainment=0.50] Containment threshold above which smaller box is part of same person
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
      duplicatePersonDetections: [],
      rawPersonCount: 0,
      realPersonCount: 0,
      duplicatePersonCount: 0,
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

  const rawRealCandidates = [];
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
      rawRealCandidates.push(annotatedPerson);
    }
  });

  // Apply overlap deduplication and confidence threshold on physical person candidates
  const { uniqueDetections: realPersonDetections, duplicateDetections: duplicatePersonDetections } = deduplicatePersonDetections(
    rawRealCandidates,
    {
      minConfidence: options.minPersonConfidence ?? 0.45,
      minPrimaryConfidence: options.minPrimaryConfidence ?? 0.35,
      maxOverlapIoU: options.maxOverlapIoU ?? 0.25,
      maxContainment: options.maxContainment ?? 0.35,
      maxHorizontalOverlap: options.maxHorizontalOverlap ?? 0.45,
    }
  );

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
    duplicatePersonDetections,
    rawPersonCount: personDetections.length,
    realPersonCount: realPersonDetections.length,
    duplicatePersonCount: duplicatePersonDetections.length,
    personOnPhoneCount: phoneScreenPersonDetections.length,
    isPhonePresent: phoneDetections.length > 0,
    isPersonOnPhoneScreen: phoneScreenPersonDetections.length > 0,
  };
}
