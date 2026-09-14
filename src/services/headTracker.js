import { HEAD_ORIENTATIONS } from './headPoseEstimator.js';

export const HEAD_STATE_EVENTS = {
  HEAD_FORWARD: 'HEAD_FORWARD',
  HEAD_LEFT: 'HEAD_LEFT',
  HEAD_RIGHT: 'HEAD_RIGHT',
  HEAD_DOWN: 'HEAD_DOWN',
  HEAD_UNKNOWN: 'HEAD_UNKNOWN',
};

/**
 * Maps orientation string to event type.
 */
export function getEventFromOrientation(orientation) {
  switch (orientation) {
    case HEAD_ORIENTATIONS.FORWARD:
      return HEAD_STATE_EVENTS.HEAD_FORWARD;
    case HEAD_ORIENTATIONS.LEFT:
      return HEAD_STATE_EVENTS.HEAD_LEFT;
    case HEAD_ORIENTATIONS.RIGHT:
      return HEAD_STATE_EVENTS.HEAD_RIGHT;
    case HEAD_ORIENTATIONS.DOWN:
      return HEAD_STATE_EVENTS.HEAD_DOWN;
    default:
      return HEAD_STATE_EVENTS.HEAD_UNKNOWN;
  }
}

/**
 * Creates a head orientation tracker with temporal debouncing.
 * 
 * @param {Object} options
 * @param {number} [options.stabilityThreshold=2] - Consecutive frames required to confirm state transition
 * @param {Function} [options.onStateChange] - Callback invoked when stable orientation changes
 */
export function createHeadTracker({
  stabilityThreshold = 2,
  onStateChange = null,
} = {}) {
  let currentState = HEAD_ORIENTATIONS.UNKNOWN;
  let pendingState = HEAD_ORIENTATIONS.UNKNOWN;
  let pendingStateConsecutive = 0;
  let latestMetrics = { yaw: 0, pitch: 0 };
  let latestConfidence = null;

  return {
    getCurrentState: () => currentState,
    getMetrics: () => latestMetrics,
    getConfidence: () => latestConfidence,

    reset: () => {
      currentState = HEAD_ORIENTATIONS.UNKNOWN;
      pendingState = HEAD_ORIENTATIONS.UNKNOWN;
      pendingStateConsecutive = 0;
      latestMetrics = { yaw: 0, pitch: 0 };
      latestConfidence = null;
    },

    /**
     * Processes normalized head pose estimate frame.
     * @param {{ type: string, orientation: string, confidence: number | null, timestamp: number, metrics: { yaw: number, pitch: number } }} poseEstimate 
     */
    processPose: (poseEstimate) => {
      const { orientation = HEAD_ORIENTATIONS.UNKNOWN, confidence = null, metrics = { yaw: 0, pitch: 0 }, timestamp = Date.now() } = poseEstimate || {};

      latestMetrics = metrics;
      latestConfidence = confidence;

      let event = null;

      if (orientation === pendingState) {
        pendingStateConsecutive++;
      } else {
        pendingState = orientation;
        pendingStateConsecutive = 1;
      }

      // Check if pending state has stabilized over stabilityThreshold frames
      if (pendingStateConsecutive >= stabilityThreshold && currentState !== pendingState) {
        currentState = pendingState;
        const eventType = getEventFromOrientation(currentState);

        event = {
          type: eventType,
          orientation: currentState,
          confidence,
          timestamp,
          metrics,
        };

        if (onStateChange) {
          onStateChange(event);
        }
      }

      return {
        currentState,
        confidence,
        metrics,
        event,
      };
    },
  };
}
