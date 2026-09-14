import { SCREEN_ACTIVITIES } from './screenClassifier.js';

export const SCREEN_STATE_EVENTS = {
  SCREEN_CODING: 'SCREEN_CODING',
  SCREEN_BROWSER: 'SCREEN_BROWSER',
  SCREEN_DOCUMENT: 'SCREEN_DOCUMENT',
  SCREEN_VIDEO: 'SCREEN_VIDEO',
  SCREEN_UNKNOWN: 'SCREEN_UNKNOWN',
};

/**
 * Maps raw screen activity to event type.
 */
export function getEventFromScreenActivity(activity) {
  switch (activity) {
    case SCREEN_ACTIVITIES.CODING:
      return SCREEN_STATE_EVENTS.SCREEN_CODING;
    case SCREEN_ACTIVITIES.BROWSER:
      return SCREEN_STATE_EVENTS.SCREEN_BROWSER;
    case SCREEN_ACTIVITIES.DOCUMENT:
      return SCREEN_STATE_EVENTS.SCREEN_DOCUMENT;
    case SCREEN_ACTIVITIES.VIDEO:
      return SCREEN_STATE_EVENTS.SCREEN_VIDEO;
    default:
      return SCREEN_STATE_EVENTS.SCREEN_UNKNOWN;
  }
}

/**
 * Creates a screen activity tracker with temporal debouncing.
 * 
 * @param {Object} options
 * @param {number} [options.stabilityThreshold=2] - Consecutive frames required to confirm screen activity transition
 * @param {Function} [options.onStateChange] - Callback invoked when stable screen activity transitions
 */
export function createScreenTracker({
  stabilityThreshold = 2,
  onStateChange = null,
} = {}) {
  let currentState = SCREEN_ACTIVITIES.UNKNOWN;
  let pendingState = SCREEN_ACTIVITIES.UNKNOWN;
  let pendingStateConsecutive = 0;
  let latestMetrics = { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 };
  let latestConfidence = null;

  return {
    getCurrentState: () => currentState,
    getMetrics: () => latestMetrics,
    getConfidence: () => latestConfidence,

    reset: () => {
      currentState = SCREEN_ACTIVITIES.UNKNOWN;
      pendingState = SCREEN_ACTIVITIES.UNKNOWN;
      pendingStateConsecutive = 0;
      latestMetrics = { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 };
      latestConfidence = null;
    },

    /**
     * Processes raw screen activity classification.
     * @param {{ type: string, activity: string, confidence: number | null, timestamp: number, metrics: Object }} rawClassification 
     */
    processClassification: (rawClassification) => {
      const {
        activity = SCREEN_ACTIVITIES.UNKNOWN,
        confidence = null,
        metrics = { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 },
        timestamp = Date.now()
      } = rawClassification || {};

      latestMetrics = metrics;
      latestConfidence = confidence;

      let event = null;

      if (activity === pendingState) {
        pendingStateConsecutive++;
      } else {
        pendingState = activity;
        pendingStateConsecutive = 1;
      }

      // Transition state if pending state has stabilized over stabilityThreshold frames
      if (pendingStateConsecutive >= stabilityThreshold && currentState !== pendingState) {
        currentState = pendingState;
        const eventType = getEventFromScreenActivity(currentState);

        event = {
          type: eventType,
          activity: currentState,
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
