import { filterObjectsAndClassifyScreenPeople } from './spatialFilter.js';

export const PERSON_STATES = {
  NO_PERSON: 'NO_PERSON',
  ONE_PERSON: 'ONE_PERSON',
  MULTIPLE_PEOPLE: 'MULTIPLE_PEOPLE',
};

/**
 * Derives stable person count category from numeric count.
 * @param {number} count 
 * @returns {string} NO_PERSON | ONE_PERSON | MULTIPLE_PEOPLE
 */
export function getPersonStateFromCount(count) {
  if (count <= 0) return PERSON_STATES.NO_PERSON;
  if (count === 1) return PERSON_STATES.ONE_PERSON;
  return PERSON_STATES.MULTIPLE_PEOPLE;
}

/**
 * Creates a person tracker with count smoothing and phone-screen person filtering.
 * 
 * @param {Object} options
 * @param {number} [options.stabilityThreshold=2] - Consecutive frames required to update stable count state
 * @param {Function} [options.onStateChange] - Callback invoked when person state changes
 */
export function createPersonTracker({
  stabilityThreshold = 2,
  onStateChange = null,
} = {}) {
  let currentState = PERSON_STATES.NO_PERSON;
  let currentStableCount = 0;
  let currentRawCount = 0;
  let currentPhoneScreenPersonCount = 0;
  let pendingCount = 0;
  let pendingCountConsecutive = 0;

  return {
    getCurrentState: () => currentState,
    getStableCount: () => currentStableCount,
    getRawCount: () => currentRawCount,
    getPhoneScreenPersonCount: () => currentPhoneScreenPersonCount,

    reset: () => {
      currentState = PERSON_STATES.NO_PERSON;
      currentStableCount = 0;
      currentRawCount = 0;
      currentPhoneScreenPersonCount = 0;
      pendingCount = 0;
      pendingCountConsecutive = 0;
    },

    /**
     * Processes array of raw detected objects from objectDetector.
     * @param {Array<Object>} detectedObjects 
     * @param {number} [timestamp=Date.now()]
     */
    processObjects: (detectedObjects = [], timestamp = Date.now()) => {
      // Apply spatial containment filter to distinguish physical people from on-screen people
      const spatialRes = filterObjectsAndClassifyScreenPeople(detectedObjects);
      
      const realPersonDetections = spatialRes.realPersonDetections;
      const realCount = spatialRes.realPersonCount;
      const rawCount = spatialRes.rawPersonCount;
      const personOnPhoneCount = spatialRes.personOnPhoneCount;

      currentRawCount = rawCount;
      currentPhoneScreenPersonCount = personOnPhoneCount;

      const maxConfidence = realCount > 0
        ? Math.max(...realPersonDetections.map((d) => d.confidence))
        : (spatialRes.allPersonDetections.length > 0 ? Math.max(...spatialRes.allPersonDetections.map(d => d.confidence)) : null);

      let event = null;

      if (realCount === pendingCount) {
        pendingCountConsecutive++;
      } else {
        pendingCount = realCount;
        pendingCountConsecutive = 1;
      }

      // Check if pending real person count has stabilized over stabilityThreshold frames
      if (pendingCountConsecutive >= stabilityThreshold && currentStableCount !== pendingCount) {
        currentStableCount = pendingCount;
        const newState = getPersonStateFromCount(currentStableCount);
        const stateChanged = currentState !== newState;
        currentState = newState;

        event = {
          type: 'PERSON_COUNT',
          state: currentState,
          count: currentStableCount,
          rawCount,
          personOnPhoneCount,
          confidence: maxConfidence || 0.9,
          timestamp,
          stateChanged,
        };

        if (stateChanged && onStateChange) {
          onStateChange(event);
        }
      }

      return {
        currentState,
        count: currentStableCount,
        rawCount,
        personOnPhoneCount,
        isPersonOnPhoneScreen: personOnPhoneCount > 0,
        confidence: currentStableCount > 0 ? maxConfidence : null,
        event,
        spatialRes,
      };
    },
  };
}

