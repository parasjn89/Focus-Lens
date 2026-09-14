import { useState, useEffect, useRef } from 'react';
import { classifyScreenVideoElement, SCREEN_ACTIVITIES, SCREEN_ACTIVITY_LABELS } from '../services/screenClassifier';
import { createScreenTracker } from '../services/screenTracker';

/**
 * Custom React hook orchestrating local browser screen content classification.
 * 
 * @param {Object} params
 * @param {React.RefObject<HTMLVideoElement>} params.screenVideoRef - Ref to shared screen video element
 * @param {boolean} params.isScreenActive - Whether screen share is active
 * @param {number} [params.analysisIntervalMs=2000] - Configurable analysis interval in ms
 * @param {Function} [params.onStateChangeEvent] - Callback when stable screen activity transitions
 */
export function useScreenClassifier({
  screenVideoRef,
  isScreenActive,
  analysisIntervalMs = 2000,
  onStateChangeEvent = null,
}) {
  const [screenActivity, setScreenActivity] = useState(SCREEN_ACTIVITIES.UNKNOWN);
  const [confidence, setConfidence] = useState(null);
  const [metrics, setMetrics] = useState({ darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 });
  const [error, setError] = useState(null);

  const [debugStats, setDebugStats] = useState({
    attempts: 0,
    successes: 0,
    errors: 0,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    lastTimestamp: null,
    lastError: null,
  });

  const statsRef = useRef({ attempts: 0, successes: 0, errors: 0 });
  const trackerRef = useRef(null);
  const hiddenCanvasRef = useRef(null);

  const onStateChangeEventRef = useRef(onStateChangeEvent);
  useEffect(() => {
    onStateChangeEventRef.current = onStateChangeEvent;
  }, [onStateChangeEvent]);

  if (!trackerRef.current) {
    trackerRef.current = createScreenTracker({
      stabilityThreshold: 2,
      onStateChange: (evt) => {
        setScreenActivity(evt.activity);
        if (onStateChangeEventRef.current) {
          onStateChangeEventRef.current(evt);
        }
      },
    });
  }

  useEffect(() => {
    let intervalId = null;
    let isSubscribed = true;

    if (isScreenActive) {
      setError(null);

      // Create a single reusable hidden canvas instance to prevent DOM recreation memory overhead
      if (!hiddenCanvasRef.current && typeof document !== 'undefined') {
        hiddenCanvasRef.current = document.createElement('canvas');
        hiddenCanvasRef.current.width = 320;
        hiddenCanvasRef.current.height = 180;
      }

      intervalId = setInterval(() => {
        const video = screenVideoRef?.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.ended) {
          if (video && isSubscribed) {
            setDebugStats((prev) => ({
              ...prev,
              videoWidth: video.videoWidth || 0,
              videoHeight: video.videoHeight || 0,
              readyState: video.readyState || 0,
            }));
          }
          return;
        }

        statsRef.current.attempts += 1;

        try {
          const classification = classifyScreenVideoElement(video, hiddenCanvasRef.current);

          if (isSubscribed) {
            statsRef.current.successes += 1;
            const trackerRes = trackerRef.current.processClassification(classification);

            setScreenActivity((prev) => (prev !== trackerRes.currentState ? trackerRes.currentState : prev));
            setConfidence((prev) => (prev !== trackerRes.confidence ? trackerRes.confidence : prev));
            setMetrics(trackerRes.metrics);

            setDebugStats({
              attempts: statsRef.current.attempts,
              successes: statsRef.current.successes,
              errors: statsRef.current.errors,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
              lastTimestamp: classification.timestamp,
              lastError: null,
            });
          }
        } catch (err) {
          statsRef.current.errors += 1;
          console.error('Error during screen classification frame processing:', err);
          if (isSubscribed) {
            setError('Screen analysis unavailable.');
            setDebugStats((prev) => ({
              ...prev,
              attempts: statsRef.current.attempts,
              errors: statsRef.current.errors,
              lastError: err.message || String(err),
            }));
          }
        }
      }, analysisIntervalMs);
    } else {
      setScreenActivity(SCREEN_ACTIVITIES.UNKNOWN);
      setConfidence(null);
      setMetrics({ darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 });
      setError(null);
      statsRef.current = { attempts: 0, successes: 0, errors: 0 };
      setDebugStats({
        attempts: 0,
        successes: 0,
        errors: 0,
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
        lastTimestamp: null,
        lastError: null,
      });

      if (trackerRef.current) {
        trackerRef.current.reset();
      }
    }

    return () => {
      isSubscribed = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isScreenActive, screenVideoRef, analysisIntervalMs]);

  // Clean up canvas memory on unmount
  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        trackerRef.current.reset();
      }
      hiddenCanvasRef.current = null;
    };
  }, []);

  return {
    screenActivity,
    activityLabel: SCREEN_ACTIVITY_LABELS[screenActivity] || 'Unable to determine',
    confidence,
    metrics,
    debugStats,
    error,
  };
}
