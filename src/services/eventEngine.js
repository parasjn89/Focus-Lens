/**
 * Event Engine managing active time-based state spans (start time, end time, duration).
 * Converts point-in-time observational state changes into interval span records.
 */
export function createEventEngine({ onSpanCompleted = null } = {}) {
  const activeSpans = new Map(); // key -> { type, startTime, confidence, metadata }
  const completedSpans = [];

  /**
   * Starts a new state span if not already open.
   */
  const startSpan = (key, type, timestamp, confidence = null, metadata = {}) => {
    if (!activeSpans.has(key)) {
      activeSpans.set(key, {
        type,
        startTime: timestamp,
        confidence,
        metadata,
      });
    }
  };

  /**
   * Ends an active state span and records completed interval.
   */
  const endSpan = (key, timestamp) => {
    if (activeSpans.has(key)) {
      const span = activeSpans.get(key);
      activeSpans.delete(key);

      const durationMs = Math.max(0, timestamp - span.startTime);
      const durationSeconds = Math.round(durationMs / 1000);

      // Only record spans longer than 1 second (filter noise)
      if (durationSeconds >= 1) {
        const completedRecord = {
          type: span.type,
          startTime: span.startTime,
          endTime: timestamp,
          durationSeconds,
          confidence: span.confidence,
          metadata: span.metadata,
        };

        completedSpans.push(completedRecord);
        if (onSpanCompleted) onSpanCompleted(completedRecord);
        return completedRecord;
      }
    }
    return null;
  };

  return {
    getActiveSpans: () => Array.from(activeSpans.values()),
    getCompletedSpans: () => [...completedSpans],

    reset: () => {
      activeSpans.clear();
      completedSpans.length = 0;
    },

    /**
     * Processes observational state change events.
     * @param {{ type: string, timestamp: number, confidence?: number | null, count?: number }} event 
     */
    processObservation: (event) => {
      if (!event || !event.type) return;
      const { type, timestamp = Date.now(), confidence = null } = event;

      // Handle Phone States
      if (type === 'PHONE_PRESENT') {
        startSpan('PHONE', 'PHONE_PRESENT', timestamp, confidence);
      } else if (type === 'PHONE_ABSENT') {
        endSpan('PHONE', timestamp);
      }

      // Handle Person Count States
      if (type === 'MULTIPLE_PEOPLE' || (event.state === 'MULTIPLE_PEOPLE')) {
        startSpan('MULTIPLE_PEOPLE', 'MULTIPLE_PEOPLE', timestamp, confidence, { count: event.count || 2 });
      } else if (type === 'ONE_PERSON' || type === 'NO_PERSON' || (event.state && event.state !== 'MULTIPLE_PEOPLE')) {
        endSpan('MULTIPLE_PEOPLE', timestamp);
      }

      // Handle Face Absence States
      if (type === 'FACE_ABSENT') {
        startSpan('FACE_ABSENT', 'FACE_ABSENT', timestamp, confidence);
      } else if (type === 'FACE_PRESENT') {
        endSpan('FACE_ABSENT', timestamp);
      }

      // Handle Audio Speech States
      if (type === 'AUDIO_ACTIVITY') {
        if (event.activity === 'SPEECH_LIKE') {
          startSpan('SPEECH_LIKE', 'SPEECH_LIKE', timestamp, confidence, { audioLevel: event.audioLevel });
        } else if (event.activity === 'SILENCE') {
          endSpan('SPEECH_LIKE', timestamp);
        }
      }
    },
  };
}
