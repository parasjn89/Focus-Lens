export const PHONE_STATES = {
  PHONE_PRESENT: 'PHONE_PRESENT',
  PHONE_ABSENT: 'PHONE_ABSENT',
};

/**
 * Creates a phone tracker with temporal debouncing.
 * 
 * @param {Object} options
 * @param {number} [options.presentThreshold=2] - Consecutive frames required to declare PHONE_PRESENT
 * @param {number} [options.absentThreshold=3] - Consecutive missing frames required to declare PHONE_ABSENT
 * @param {Function} [options.onStateChange] - Callback invoked when state transitions
 */
export function createPhoneTracker({
  presentThreshold = 2,
  absentThreshold = 3,
  onStateChange = null,
} = {}) {
  let currentState = PHONE_STATES.PHONE_ABSENT;
  let consecutivePresentCount = 0;
  let consecutiveAbsentCount = 0;

  return {
    getCurrentState: () => currentState,

    reset: () => {
      currentState = PHONE_STATES.PHONE_ABSENT;
      consecutivePresentCount = 0;
      consecutiveAbsentCount = 0;
    },

    /**
     * Processes array of raw detected object objects from objectDetector.
     * @param {Array<Object>} detectedObjects 
     * @param {number} [timestamp=Date.now()]
     */
    processObjects: (detectedObjects = [], timestamp = Date.now()) => {
      // Find highest confidence phone detection in frame
      const phoneDetections = detectedObjects.filter(
        (obj) => obj.label === 'cell phone'
      );

      const hasPhone = phoneDetections.length > 0;
      const maxConfidence = hasPhone
        ? Math.max(...phoneDetections.map((d) => d.confidence))
        : null;

      let event = null;

      if (hasPhone) {
        consecutivePresentCount++;
        consecutiveAbsentCount = 0;

        if (
          currentState !== PHONE_STATES.PHONE_PRESENT &&
          consecutivePresentCount >= presentThreshold
        ) {
          currentState = PHONE_STATES.PHONE_PRESENT;
          event = {
            type: PHONE_STATES.PHONE_PRESENT,
            confidence: maxConfidence || 0.85,
            timestamp,
          };
          if (onStateChange) onStateChange(event);
        }
      } else {
        consecutiveAbsentCount++;
        consecutivePresentCount = 0;

        if (
          currentState !== PHONE_STATES.PHONE_ABSENT &&
          consecutiveAbsentCount >= absentThreshold
        ) {
          currentState = PHONE_STATES.PHONE_ABSENT;
          event = {
            type: PHONE_STATES.PHONE_ABSENT,
            confidence: null,
            timestamp,
          };
          if (onStateChange) onStateChange(event);
        }
      }

      return {
        currentState,
        confidence: currentState === PHONE_STATES.PHONE_PRESENT ? maxConfidence : null,
        consecutivePresentCount,
        consecutiveAbsentCount,
        event,
      };
    },
  };
}
