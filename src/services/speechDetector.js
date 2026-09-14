export const SPEECH_STATES = {
  SPEECH_LIKE: 'SPEECH_LIKE',
  SILENCE: 'SILENCE',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Calculates normalized RMS (Root Mean Square) audio amplitude from time-domain byte buffer.
 * 
 * @param {Uint8Array} timeDomainBuffer - 8-bit unsigned byte buffer (centered around 128)
 * @returns {number} Normalized audio level between 0.0 and 1.0
 */
export function calculateAudioLevel(timeDomainBuffer) {
  if (!timeDomainBuffer || timeDomainBuffer.length === 0) return 0.0;

  let sumSquares = 0;
  const length = timeDomainBuffer.length;

  for (let i = 0; i < length; i++) {
    // Convert 0..255 byte value to normalized -1.0 .. +1.0 float
    const normalizedSample = (timeDomainBuffer[i] - 128) / 128.0;
    sumSquares += normalizedSample * normalizedSample;
  }

  const rms = Math.sqrt(sumSquares / length);
  // Scale and clamp RMS for intuitive meter representation (0.0 to 1.0)
  const scaledLevel = Math.min(1.0, Math.max(0.0, rms * 3.5));
  return Math.round(scaledLevel * 100) / 100;
}

/**
 * Creates a Voice Activity Detection (VAD) state tracker with hysteresis and debouncing.
 * 
 * Hysteresis Design:
 * - speechStartThreshold (0.15): Higher energy level required to initiate a speech candidate state.
 * - speechEndThreshold (0.08): Lower energy level required before considering speech to have ended.
 * - Dual thresholds prevent rapid flickering during natural vocal pitch modulation.
 * 
 * Debouncing Design:
 * - minimumSpeechDurationMs (1000ms): Sustained high energy required to prevent short noise spikes (e.g. keyboard clicks, chair sounds) from triggering speech state.
 * - minimumSilenceDurationMs (1500ms): Sustained low energy required to prevent brief inter-word pauses from fragmenting continuous speech.
 * 
 * @param {Object} options
 * @param {number} [options.speechStartThreshold=0.15]
 * @param {number} [options.speechEndThreshold=0.08]
 * @param {number} [options.minimumSpeechDurationMs=1000]
 * @param {number} [options.minimumSilenceDurationMs=1500]
 * @param {Function} [options.onStateChange]
 */
export function createSpeechTracker({
  speechStartThreshold = 0.15,
  speechEndThreshold = 0.08,
  minimumSpeechDurationMs = 1000,
  minimumSilenceDurationMs = 1500,
  onStateChange = null,
} = {}) {
  let currentState = SPEECH_STATES.SILENCE;
  let candidateState = SPEECH_STATES.SILENCE;
  let candidateStartTime = null;

  return {
    getCurrentState: () => currentState,

    reset: () => {
      currentState = SPEECH_STATES.SILENCE;
      candidateState = SPEECH_STATES.SILENCE;
      candidateStartTime = null;
    },

    /**
     * Evaluates a single audio frame level and updates VAD state machine.
     * 
     * @param {number} audioLevel - Normalized audio level (0.0 to 1.0)
     * @param {number} [timestamp=Date.now()]
     * @returns {{ currentState: string, confidence: number, audioLevel: number, stateChanged: boolean }}
     */
    processAudioFrame: (audioLevel = 0.0, timestamp = Date.now()) => {
      // 1. Determine instantaneous candidate based on dual hysteresis thresholds
      let rawCandidate = candidateState;

      if (currentState === SPEECH_STATES.SILENCE) {
        if (audioLevel >= speechStartThreshold) {
          rawCandidate = SPEECH_STATES.SPEECH_LIKE;
        } else {
          rawCandidate = SPEECH_STATES.SILENCE;
        }
      } else if (currentState === SPEECH_STATES.SPEECH_LIKE) {
        if (audioLevel < speechEndThreshold) {
          rawCandidate = SPEECH_STATES.SILENCE;
        } else {
          rawCandidate = SPEECH_STATES.SPEECH_LIKE;
        }
      }

      // 2. Evaluate debounce timing for candidate transitions
      if (rawCandidate !== candidateState) {
        candidateState = rawCandidate;
        candidateStartTime = timestamp;
      } else if (rawCandidate !== currentState && candidateStartTime !== null) {
        const elapsedMs = timestamp - candidateStartTime;
        const requiredDuration =
          rawCandidate === SPEECH_STATES.SPEECH_LIKE
            ? minimumSpeechDurationMs
            : minimumSilenceDurationMs;

        if (elapsedMs >= requiredDuration) {
          const previousState = currentState;
          currentState = rawCandidate;
          candidateStartTime = null;

          const event = {
            type: 'AUDIO_ACTIVITY',
            activity: currentState,
            timestamp,
            audioLevel,
            previousState,
          };

          if (onStateChange) {
            onStateChange(event);
          }

          return {
            currentState,
            confidence: currentState === SPEECH_STATES.SPEECH_LIKE ? 0.88 : 0.95,
            audioLevel,
            stateChanged: true,
          };
        }
      }

      return {
        currentState,
        confidence: currentState === SPEECH_STATES.SPEECH_LIKE ? 0.88 : 0.95,
        audioLevel,
        stateChanged: false,
      };
    },
  };
}
