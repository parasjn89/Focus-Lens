/**
 * State machine constants
 */
export const FACE_STATES = {
  FACE_PRESENT: 'FACE_PRESENT',
  FACE_ABSENT: 'FACE_ABSENT',
};

/**
 * Creates a face tracker instance with temporal debouncing.
 * Prevents rapid flickering / false negatives caused by momentary frame drops.
 * 
 * @param {Object} options
 * @param {number} [options.presentThreshold=2] - Consecutive positive frames required to transition to FACE_PRESENT
 * @param {number} [options.absentThreshold=3] - Consecutive negative frames required to transition to FACE_ABSENT
 * @param {Function} [options.onStateChange] - Callback invoked when stable state transitions
 */
export function createFaceTracker({
  presentThreshold = 2,
  absentThreshold = 3,
  onStateChange = null,
} = {}) {
  let currentState = FACE_STATES.FACE_ABSENT;
  let consecutivePresentCount = 0;
  let consecutiveAbsentCount = 0;

  return {
    /**
     * Gets the current stable state.
     */
    getCurrentState: () => currentState,

    /**
     * Resets tracker counters and state.
     */
    reset: () => {
      currentState = FACE_STATES.FACE_ABSENT;
      consecutivePresentCount = 0;
      consecutiveAbsentCount = 0;
    },

    /**
     * Processes a normalized detection frame and updates state machine.
     * @param {{ faceDetected: boolean, confidence: number | null, timestamp: number }} detection 
     * @returns {{ currentState: string, event: Object | null }}
     */
    processDetection: ({ faceDetected, confidence = null, timestamp = Date.now() }) => {
      let event = null;

      if (faceDetected) {
        consecutivePresentCount++;
        consecutiveAbsentCount = 0;

        // Transition from FACE_ABSENT -> FACE_PRESENT if threshold reached
        if (
          currentState !== FACE_STATES.FACE_PRESENT &&
          consecutivePresentCount >= presentThreshold
        ) {
          currentState = FACE_STATES.FACE_PRESENT;
          event = {
            type: FACE_STATES.FACE_PRESENT,
            timestamp,
            confidence: confidence || 0.9,
          };
          if (onStateChange) onStateChange(event);
        }
      } else {
        consecutiveAbsentCount++;
        consecutivePresentCount = 0;

        // Transition from FACE_PRESENT -> FACE_ABSENT if threshold reached
        if (
          currentState !== FACE_STATES.FACE_ABSENT &&
          consecutiveAbsentCount >= absentThreshold
        ) {
          currentState = FACE_STATES.FACE_ABSENT;
          event = {
            type: FACE_STATES.FACE_ABSENT,
            timestamp,
            confidence: null,
          };
          if (onStateChange) onStateChange(event);
        }
      }

      return {
        currentState,
        confidence: currentState === FACE_STATES.FACE_PRESENT ? confidence : null,
        consecutivePresentCount,
        consecutiveAbsentCount,
        event,
      };
    },
  };
}
