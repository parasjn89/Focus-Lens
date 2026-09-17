export const PHONE_STATES = {
  PHONE_PRESENT: 'PHONE_PRESENT',
  PHONE_ABSENT: 'PHONE_ABSENT',
  PHONE_UNCERTAIN: 'PHONE_UNCERTAIN',
};

export const PHONE_CONFIDENCE_TIERS = {
  HIGH: 0.35,
  MEDIUM: 0.22,
  LOW: 0.15,
};

/**
 * Creates a phone tracker with multi-tier confidence evaluation,
 * screen-off temporal hysteresis, and debouncing.
 * 
 * @param {Object} options
 * @param {number} [options.presentThreshold=2] - Consecutive high-confidence frames required to declare PHONE_PRESENT
 * @param {number} [options.mediumPresentThreshold=3] - Consecutive medium-confidence frames required to declare PHONE_PRESENT
 * @param {number} [options.absentThreshold=3] - Consecutive missing frames required to declare PHONE_ABSENT
 * @param {Function} [options.onStateChange] - Callback invoked when state transitions
 */
export function createPhoneTracker({
  presentThreshold = 2,
  mediumPresentThreshold = 3,
  absentThreshold = 3,
  onStateChange = null,
} = {}) {
  let currentState = PHONE_STATES.PHONE_ABSENT;
  let consecutivePresentCount = 0;
  let consecutiveAbsentCount = 0;
  let lastConfirmedTimestamp = 0;

  return {
    getCurrentState: () => currentState,

    reset: () => {
      currentState = PHONE_STATES.PHONE_ABSENT;
      consecutivePresentCount = 0;
      consecutiveAbsentCount = 0;
      lastConfirmedTimestamp = 0;
    },

    /**
     * Processes array of raw detected objects from objectDetector.
     * @param {Array<Object>} detectedObjects 
     * @param {number} [timestamp=Date.now()]
     */
    processObjects: (detectedObjects = [], timestamp = Date.now()) => {
      // Find all valid phone detections in frame
      const phoneDetections = (detectedObjects || []).filter(
        (obj) => obj && obj.label === 'cell phone' && typeof obj.confidence === 'number' && obj.confidence >= PHONE_CONFIDENCE_TIERS.LOW
      );

      const hasPhone = phoneDetections.length > 0;
      const maxConfidence = hasPhone
        ? Math.max(...phoneDetections.map((d) => d.confidence))
        : null;

      let event = null;
      let nextState = currentState;

      if (hasPhone) {
        consecutivePresentCount++;
        consecutiveAbsentCount = 0;

        if (maxConfidence >= PHONE_CONFIDENCE_TIERS.HIGH) {
          // --- HIGH CONFIDENCE (>= 0.35, typical for screen ON) ---
          if (currentState === PHONE_STATES.PHONE_PRESENT) {
            nextState = PHONE_STATES.PHONE_PRESENT;
            lastConfirmedTimestamp = timestamp;
          } else if (consecutivePresentCount >= presentThreshold) {
            nextState = PHONE_STATES.PHONE_PRESENT;
            lastConfirmedTimestamp = timestamp;
          } else {
            // First frame debouncing: maintain PHONE_ABSENT until threshold reached
            nextState = PHONE_STATES.PHONE_ABSENT;
          }
        } else if (maxConfidence >= PHONE_CONFIDENCE_TIERS.MEDIUM) {
          // --- MEDIUM CONFIDENCE (0.22 - 0.35, typical for screen OFF / angled) ---
          if (currentState === PHONE_STATES.PHONE_PRESENT) {
            // Hysteresis: Screen turned OFF while phone was already detected
            nextState = PHONE_STATES.PHONE_PRESENT;
            lastConfirmedTimestamp = timestamp;
          } else if (consecutivePresentCount >= mediumPresentThreshold) {
            // Sustained screen-off phone detection across consecutive frames promotes to PRESENT
            nextState = PHONE_STATES.PHONE_PRESENT;
            lastConfirmedTimestamp = timestamp;
          } else {
            // Marginal / evaluating screen-off candidate
            nextState = PHONE_STATES.PHONE_UNCERTAIN;
          }
        } else {
          // --- MARGINAL CONFIDENCE (0.15 - 0.22, partially occluded or faint screen-off) ---
          if (currentState === PHONE_STATES.PHONE_PRESENT && (timestamp - lastConfirmedTimestamp < 2500)) {
            // Hysteresis window: allow temporary dip
            nextState = PHONE_STATES.PHONE_PRESENT;
          } else {
            nextState = PHONE_STATES.PHONE_UNCERTAIN;
          }
        }
      } else {
        // --- NO PHONE DETECTED IN FRAME ---
        consecutiveAbsentCount++;
        consecutivePresentCount = 0;

        if (consecutiveAbsentCount >= absentThreshold) {
          nextState = PHONE_STATES.PHONE_ABSENT;
        } else {
          // Temporal debouncing: maintain current state for up to absentThreshold - 1 frames
          nextState = currentState;
        }
      }

      // Check if state transitioned
      if (nextState !== currentState) {
        currentState = nextState;
        event = {
          type: currentState,
          confidence: currentState === PHONE_STATES.PHONE_ABSENT ? null : maxConfidence,
          timestamp,
        };
        if (onStateChange) {
          onStateChange(event);
        }
      }

      return {
        currentState,
        confidence: currentState === PHONE_STATES.PHONE_ABSENT ? null : maxConfidence,
        consecutivePresentCount,
        consecutiveAbsentCount,
        isUncertain: currentState === PHONE_STATES.PHONE_UNCERTAIN,
        isPhonePresent: currentState === PHONE_STATES.PHONE_PRESENT,
        event,
      };
    },
  };
}
