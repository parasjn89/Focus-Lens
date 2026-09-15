export const ACTIVITY_TYPES = {
  CODING: 'CODING',
  STUDY_LIKE: 'STUDY_LIKE',
  PHONE_ACTIVITY: 'PHONE_ACTIVITY',
  MULTIPLE_PEOPLE: 'MULTIPLE_PEOPLE',
  AWAY_OR_NOT_VISIBLE: 'AWAY_OR_NOT_VISIBLE',
  VIDEO_ACTIVITY: 'VIDEO_ACTIVITY',
  BROWSER_ACTIVITY: 'BROWSER_ACTIVITY',
  DOCUMENT_ACTIVITY: 'DOCUMENT_ACTIVITY',
  SPEECH_LIKE: 'SPEECH_LIKE',
  UNKNOWN: 'UNKNOWN',
};

export const ACTIVITY_LABELS = {
  CODING: 'Coding',
  STUDY_LIKE: 'Study-like',
  PHONE_ACTIVITY: 'Phone activity',
  MULTIPLE_PEOPLE: 'Multiple people',
  AWAY_OR_NOT_VISIBLE: 'Away / not visible',
  VIDEO_ACTIVITY: 'Video activity',
  BROWSER_ACTIVITY: 'Browser activity',
  DOCUMENT_ACTIVITY: 'Document activity',
  SPEECH_LIKE: 'Speech-like audio activity',
  UNKNOWN: 'Unknown',
};

/**
 * Evaluates camera, screen, and audio observational signals using a transparent evidence scoring system.
 * 
 * Priority Precedence:
 * 1. PHONE_ACTIVITY (Phone detected)
 * 2. MULTIPLE_PEOPLE (Person count >= 2)
 * 3. AWAY_OR_NOT_VISIBLE (Camera active + Face absent / person count = 0)
 * 4. CODING (Screen = CODING + Face present + 1 person + Phone absent + Head forward/down)
 * 5. STUDY_LIKE (Screen = DOCUMENT + Face present + 1 person + Phone absent + Head forward/down)
 * 6. VIDEO_ACTIVITY (Screen = VIDEO)
 * 7. DOCUMENT_ACTIVITY (Screen = DOCUMENT + Face present)
 * 8. BROWSER_ACTIVITY (Screen = BROWSER)
 * 9. SPEECH_LIKE (Microphone active + sustained speech-like audio energy)
 * 10. UNKNOWN (Camera off / conflicting signals)
 * 
 * @param {Object} cameraSignals
 * @param {Object} screenSignals
 * @param {Object} audioSignals
 * @returns {{ type: string, label: string, evidenceScore: number | null, confidenceType: string, contributingSignals: string[], explanation: string[] }}
 */
export function classifyMultimodalActivity(cameraSignals = {}, screenSignals = {}, audioSignals = {}) {
  const {
    isCameraActive = false,
    isFacePresent = false,
    isPhonePresent = false,
    personCount = 0, // Real physical person count
    rawPersonCount = 0,
    personOnPhoneCount = 0,
    headOrientation = 'UNKNOWN',
  } = cameraSignals;

  const {
    isScreenActive = false,
    screenActivity = 'UNKNOWN',
    screenConfidence = null,
    sourceType = 'unknown',
  } = screenSignals;

  const {
    isMicrophoneActive = false,
    speechState = 'SILENCE',
    isSpeechDetected = false,
    audioLevel = 0,
  } = audioSignals;

  // Priority 1: Phone Activity
  if (isCameraActive && isPhonePresent) {
    const explanation = ['Phone detected in camera view'];
    const contributingSignals = ['PHONE_PRESENT', `HEAD_${headOrientation}`];

    if (personOnPhoneCount > 0) {
      contributingSignals.push('PERSON_ON_PHONE_SCREEN');
      explanation.push('On-screen person detection filtered from physical person count');
    }

    if (headOrientation === 'DOWN') {
      explanation.push('Head oriented downward toward phone');
    }
    return {
      type: ACTIVITY_TYPES.PHONE_ACTIVITY,
      label: ACTIVITY_LABELS.PHONE_ACTIVITY,
      evidenceScore: headOrientation === 'DOWN' ? 0.95 : 0.90,
      confidenceType: 'heuristic',
      contributingSignals,
      explanation,
    };
  }

  // Priority 2: Multiple People (strictly requires >= 2 real physical people)
  if (isCameraActive && personCount >= 2) {
    return {
      type: ACTIVITY_TYPES.MULTIPLE_PEOPLE,
      label: ACTIVITY_LABELS.MULTIPLE_PEOPLE,
      evidenceScore: 0.92,
      confidenceType: 'heuristic',
      contributingSignals: ['MULTIPLE_PEOPLE', `COUNT_${personCount}`],
      explanation: ['More than one physical person detected in camera view'],
    };
  }

  // Priority 3: Away or Not Visible
  if (isCameraActive && (!isFacePresent || personCount === 0)) {
    return {
      type: ACTIVITY_TYPES.AWAY_OR_NOT_VISIBLE,
      label: ACTIVITY_LABELS.AWAY_OR_NOT_VISIBLE,
      evidenceScore: 0.92,
      confidenceType: 'heuristic',
      contributingSignals: ['FACE_ABSENT', 'NO_PERSON'],
      explanation: ['No face detected in camera view', 'No person present in camera feed'],
    };
  }

  // Priority 4: Coding (Screen = CODING + Face present + 1 person + Phone absent + Head forward/down)
  const isHeadOrientedForwardOrDown = headOrientation === 'FORWARD' || headOrientation === 'DOWN' || headOrientation === 'UNKNOWN';
  if (isScreenActive && screenActivity === 'CODING') {
    const contributingSignals = ['SCREEN_CODING'];
    const explanation = ['Coding environment detected on shared screen'];

    if (isCameraActive && isFacePresent) {
      contributingSignals.push('FACE_PRESENT', 'ONE_PERSON', 'PHONE_ABSENT');
      explanation.push('Face present in camera view', 'One person detected', 'No phone detected');
      if (isHeadOrientedForwardOrDown) {
        contributingSignals.push(`HEAD_${headOrientation}`);
        explanation.push('Head oriented forward/down toward screen');
      }
    }

    return {
      type: ACTIVITY_TYPES.CODING,
      label: ACTIVITY_LABELS.CODING,
      evidenceScore: (isCameraActive && isFacePresent) ? 0.90 : 0.82,
      confidenceType: 'heuristic',
      contributingSignals,
      explanation,
    };
  }

  // Priority 5: Study-like (Screen = DOCUMENT + Face present + 1 person + Phone absent + Head forward/down)
  if (isScreenActive && screenActivity === 'DOCUMENT' && isCameraActive && isFacePresent && personCount === 1 && !isPhonePresent && isHeadOrientedForwardOrDown) {
    return {
      type: ACTIVITY_TYPES.STUDY_LIKE,
      label: ACTIVITY_LABELS.STUDY_LIKE,
      evidenceScore: 0.88,
      confidenceType: 'heuristic',
      contributingSignals: ['SCREEN_DOCUMENT', 'FACE_PRESENT', 'ONE_PERSON', 'PHONE_ABSENT', `HEAD_${headOrientation}`],
      explanation: [
        'Document/PDF page detected on shared screen',
        'Face present in camera view',
        'One person detected',
        'No phone detected',
        'Head oriented forward/down toward screen',
      ],
    };
  }

  // Priority 6: Video Activity
  if (isScreenActive && screenActivity === 'VIDEO') {
    const contributingSignals = ['SCREEN_VIDEO'];
    const explanation = ['Video playback detected on shared screen'];

    if (isCameraActive && isFacePresent) {
      contributingSignals.push('FACE_PRESENT');
      explanation.push('Face present in camera view');
    }

    return {
      type: ACTIVITY_TYPES.VIDEO_ACTIVITY,
      label: ACTIVITY_LABELS.VIDEO_ACTIVITY,
      evidenceScore: (isCameraActive && isFacePresent) ? 0.85 : 0.72,
      confidenceType: 'heuristic',
      contributingSignals,
      explanation,
    };
  }

  // Priority 7: Document Activity (Screen = DOCUMENT without full study-like camera verification)
  if (isScreenActive && screenActivity === 'DOCUMENT') {
    return {
      type: ACTIVITY_TYPES.DOCUMENT_ACTIVITY,
      label: ACTIVITY_LABELS.DOCUMENT_ACTIVITY,
      evidenceScore: 0.80,
      confidenceType: 'heuristic',
      contributingSignals: ['SCREEN_DOCUMENT'],
      explanation: ['Document/PDF page detected on shared screen'],
    };
  }

  // Priority 8: Browser Activity
  if (isScreenActive && screenActivity === 'BROWSER') {
    return {
      type: ACTIVITY_TYPES.BROWSER_ACTIVITY,
      label: ACTIVITY_LABELS.BROWSER_ACTIVITY,
      evidenceScore: 0.80,
      confidenceType: 'heuristic',
      contributingSignals: ['SCREEN_BROWSER'],
      explanation: ['Web browser activity detected on shared screen'],
    };
  }

  // Baseline Camera-only Study-like (No screen share, but face present + 1 person + no phone + head forward/down)
  if (isCameraActive && isFacePresent && personCount === 1 && !isPhonePresent && isHeadOrientedForwardOrDown) {
    return {
      type: ACTIVITY_TYPES.STUDY_LIKE,
      label: ACTIVITY_LABELS.STUDY_LIKE,
      evidenceScore: 0.82,
      confidenceType: 'heuristic',
      contributingSignals: ['FACE_PRESENT', 'ONE_PERSON', 'PHONE_ABSENT', `HEAD_${headOrientation}`],
      explanation: [
        'Face present in camera view',
        'One person detected',
        'No phone detected',
        'Head oriented forward/down',
      ],
    };
  }

  // Priority 9: Speech-like Audio Activity (Microphone active + sustained speech-like audio energy)
  if (isMicrophoneActive && (isSpeechDetected || speechState === 'SPEECH_LIKE')) {
    return {
      type: ACTIVITY_TYPES.SPEECH_LIKE,
      label: ACTIVITY_LABELS.SPEECH_LIKE,
      evidenceScore: 0.85,
      confidenceType: 'heuristic',
      contributingSignals: ['SPEECH_LIKE_AUDIO'],
      explanation: ['Sustained speech-like audio activity detected locally on microphone input'],
    };
  }

  // Priority 10: Unknown / Unclassified
  return {
    type: ACTIVITY_TYPES.UNKNOWN,
    label: ACTIVITY_LABELS.UNKNOWN,
    evidenceScore: null,
    confidenceType: 'heuristic',
    contributingSignals: ['UNCLASSIFIED_SIGNALS'],
    explanation: ['Insufficient or unclassified observational signals'],
  };
}

/**
 * Backward compatibility wrapper for camera-only signals.
 */
export function classifyActivityState(signals = {}) {
  return classifyMultimodalActivity(signals, {});
}

/**
 * Merges adjacent activity segments of identical types.
 * @param {Array<Object>} segments 
 * @returns {Array<Object>}
 */
export function mergeActivitySegments(segments = []) {
  if (!segments || segments.length === 0) return [];

  const merged = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];

    if (next.type === current.type) {
      current.endTime = next.endTime;
      current.durationMs = current.endTime - current.startTime;
      if (next.contributingSignals) {
        current.contributingSignals = Array.from(
          new Set([...(current.contributingSignals || []), ...(next.contributingSignals || [])])
        );
      }
      if (next.explanation) {
        current.explanation = Array.from(
          new Set([...(current.explanation || []), ...(next.explanation || [])])
        );
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Calculates total aggregated durations for every activity category.
 * @param {Array<Object>} segments 
 * @returns {Object} Total duration in seconds per activity type
 */
export function calculateActivityDurations(segments = []) {
  const totals = {
    CODING: 0,
    STUDY_LIKE: 0,
    PHONE_ACTIVITY: 0,
    MULTIPLE_PEOPLE: 0,
    AWAY_OR_NOT_VISIBLE: 0,
    VIDEO_ACTIVITY: 0,
    BROWSER_ACTIVITY: 0,
    DOCUMENT_ACTIVITY: 0,
    UNKNOWN: 0,
  };

  const merged = mergeActivitySegments(segments);

  merged.forEach((seg) => {
    const durationSec = Math.max(0, Math.round((seg.durationMs || (seg.endTime - seg.startTime)) / 1000));
    if (totals[seg.type] !== undefined) {
      totals[seg.type] += durationSec;
    } else {
      totals.UNKNOWN += durationSec;
    }
  });

  return totals;
}

/**
 * Creates a multimodal activity tracker state machine that manages live segment creation and debouncing.
 * 
 * @param {Object} options
 * @param {number} [options.minimumActivityDurationMs=1500] - Debounce window for activity changes
 * @param {Function} [options.onSegmentCompleted]
 */
export function createActivityTracker({
  minimumActivityDurationMs = 1500,
  onSegmentCompleted = null,
} = {}) {
  let activeSegment = null;
  let completedSegments = [];
  let currentCandidate = null;
  let candidateStartTime = null;

  return {
    getActiveSegment: () => activeSegment,
    getCompletedSegments: () => [...completedSegments],

    reset: () => {
      activeSegment = null;
      completedSegments = [];
      currentCandidate = null;
      candidateStartTime = null;
    },

    /**
     * Updates activity state based on current camera, screen, and audio signals.
     * @param {Object} cameraSignals 
     * @param {Object} screenSignals 
     * @param {Object} audioSignals
     * @param {number} [timestamp=Date.now()]
     */
    updateMultimodalSignals: (cameraSignals, screenSignals = {}, audioSignals = {}, timestamp = Date.now()) => {
      const classification = classifyMultimodalActivity(cameraSignals, screenSignals, audioSignals);
      const newType = classification.type;

      if (!activeSegment) {
        activeSegment = {
          id: `seg_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
          type: newType,
          label: classification.label,
          startTime: timestamp,
          endTime: timestamp,
          durationMs: 0,
          evidenceScore: classification.evidenceScore,
          confidenceType: classification.confidenceType,
          contributingSignals: classification.contributingSignals,
          explanation: classification.explanation,
          userFeedback: null,
        };
        currentCandidate = newType;
        candidateStartTime = timestamp;
        return { currentActivity: newType, classification, activeSegment, completedSegments };
      }

      activeSegment.endTime = timestamp;
      activeSegment.durationMs = activeSegment.endTime - activeSegment.startTime;

      if (newType !== activeSegment.type) {
        if (newType !== currentCandidate) {
          currentCandidate = newType;
          candidateStartTime = timestamp;
        } else if (timestamp - candidateStartTime >= minimumActivityDurationMs) {
          const finalizedSegment = { ...activeSegment, endTime: candidateStartTime, durationMs: candidateStartTime - activeSegment.startTime };
          if (finalizedSegment.durationMs >= 500) {
            completedSegments.push(finalizedSegment);
            if (onSegmentCompleted) onSegmentCompleted(finalizedSegment);
          }

          activeSegment = {
            id: `seg_${candidateStartTime}_${Math.random().toString(36).substr(2, 5)}`,
            type: newType,
            label: classification.label,
            startTime: candidateStartTime,
            endTime: timestamp,
            durationMs: timestamp - candidateStartTime,
            evidenceScore: classification.evidenceScore,
            confidenceType: classification.confidenceType,
            contributingSignals: classification.contributingSignals,
            explanation: classification.explanation,
            userFeedback: null,
          };
        }
      } else {
        currentCandidate = newType;
        candidateStartTime = timestamp;
      }

      return {
        currentActivity: activeSegment.type,
        classification,
        activeSegment,
        completedSegments,
      };
    },

    updateSignals: function (cameraSignals, timestamp = Date.now()) {
      return this.updateMultimodalSignals(cameraSignals, {}, timestamp);
    }
  };
}
