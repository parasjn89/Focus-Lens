import { useState, useEffect, useRef } from 'react';
import { detectFaceInVideo, getFaceDetector } from '../services/faceDetector';
import { createFaceTracker, FACE_STATES } from '../services/faceTracker';

/**
 * React hook to manage local browser face detection on an active video stream.
 * 
 * @param {Object} params
 * @param {React.RefObject<HTMLVideoElement>} params.videoRef - Ref to active HTMLVideoElement
 * @param {boolean} params.isCameraActive - Whether webcam hardware is enabled
 * @param {boolean} [params.isVideoReady=false] - Whether video metadata & playback are active
 * @param {number} [params.detectionIntervalMs=500] - Interval in ms between inference passes
 * @param {Function} [params.onStateChangeEvent] - Callback when state transitions (FACE_PRESENT / FACE_ABSENT)
 */
export function useFaceDetection({
  videoRef,
  isCameraActive,
  isVideoReady = false,
  detectionIntervalMs = 500,
  onStateChangeEvent = null,
}) {
  const [detectionState, setDetectionState] = useState(FACE_STATES.FACE_ABSENT);
  const [confidence, setConfidence] = useState(null);
  const [modelStatus, setModelStatus] = useState('IDLE'); // 'IDLE' | 'LOADING' | 'READY' | 'ERROR'
  const [modelError, setModelError] = useState(null);

  // Keep callback reference updated in ref to prevent effect re-subscriptions
  const onStateChangeEventRef = useRef(onStateChangeEvent);
  useEffect(() => {
    onStateChangeEventRef.current = onStateChangeEvent;
  }, [onStateChangeEvent]);

  // Debug & telemetry diagnostics state
  const [debugStats, setDebugStats] = useState({
    attempts: 0,
    successes: 0,
    errors: 0,
    rawFaces: 0,
    lastTimestamp: null,
    lastError: null,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
  });

  const statsRef = useRef({ attempts: 0, successes: 0, errors: 0 });
  const trackerRef = useRef(null);

  if (!trackerRef.current) {
    trackerRef.current = createFaceTracker({
      presentThreshold: 2,
      absentThreshold: 3,
      onStateChange: (evt) => {
        setDetectionState(evt.type);
        if (onStateChangeEventRef.current) {
          onStateChangeEventRef.current(evt);
        }
      },
    });
  }

  // 1. Model Initialization Effect
  useEffect(() => {
    let isSubscribed = true;

    if (isCameraActive) {
      console.log('[FaceHook] initialization requested');

      if (modelStatus === 'READY') {
        console.log('[FaceHook] detector already exists / READY');
        return;
      }

      console.log('[FaceHook] initialization started');
      console.log('[FaceHook] calling getFaceDetector()');
      setModelStatus('LOADING');
      setModelError(null);

      getFaceDetector()
        .then((instance) => {
          if (isSubscribed) {
            console.log('[FaceHook] getFaceDetector() returned, instance exists:', Boolean(instance));
            console.log('[FaceHook] initialization completed');
            setModelStatus('READY');
            setModelError(null);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            const errMsg = err.message || String(err);
            console.error('[FaceHook] initialization failed:', errMsg, err.stack);
            setModelStatus('ERROR');
            setModelError(`Failed to initialize FaceDetector: ${errMsg}`);
            setDebugStats((prev) => ({ ...prev, lastError: errMsg }));
          }
        });

      return () => {
        isSubscribed = false;
      };
    } else {
      setModelStatus('IDLE');
      setModelError(null);
      setDetectionState(FACE_STATES.FACE_ABSENT);
      setConfidence(null);
      statsRef.current = { attempts: 0, successes: 0, errors: 0 };
      setDebugStats({
        attempts: 0,
        successes: 0,
        errors: 0,
        rawFaces: 0,
        lastTimestamp: null,
        lastError: null,
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
      });

      if (trackerRef.current) {
        trackerRef.current.reset();
      }
    }
  }, [isCameraActive]);

  // 2. Periodic Inference Loop Effect
  useEffect(() => {
    if (modelStatus !== 'READY' || !isCameraActive || !isVideoReady) {
      return;
    }

    console.log('[FaceHook] starting inference loop');
    let isSubscribed = true;

    const intervalId = setInterval(async () => {
      const video = videoRef?.current;

      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended || (video.currentTime === 0 && !video.seeking)) {
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
      const currentAttempt = statsRef.current.attempts;
      if (currentAttempt === 1 || currentAttempt % 20 === 0) {
        console.log(`[FaceHook] inference attempt #${currentAttempt}`);
      }

      try {
        const rawResult = await detectFaceInVideo(video);
        if (isSubscribed) {
          statsRef.current.successes += 1;
          const rawFaceCount = rawResult.faceDetected ? 1 : 0;
          if (currentAttempt === 1 || currentAttempt % 20 === 0) {
            console.log(`[FaceHook] raw faces = ${rawFaceCount}`);
          }

          const trackerRes = trackerRef.current.processDetection(rawResult);
          setDetectionState((prev) => (prev !== trackerRes.currentState ? trackerRes.currentState : prev));
          setConfidence((prev) => (prev !== trackerRes.confidence ? trackerRes.confidence : prev));

          if (currentAttempt === 1 || currentAttempt % 4 === 0) {
            setDebugStats({
              attempts: statsRef.current.attempts,
              successes: statsRef.current.successes,
              errors: statsRef.current.errors,
              rawFaces: rawFaceCount,
              lastTimestamp: rawResult.timestamp,
              lastError: null,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              readyState: video.readyState,
            });
          }
        }
      } catch (err) {
        statsRef.current.errors += 1;
        console.error('[FaceHook] frame processing error:', err);
        if (isSubscribed) {
          setDebugStats((prev) => ({
            ...prev,
            attempts: statsRef.current.attempts,
            errors: statsRef.current.errors,
            lastError: err.message || String(err),
          }));
        }
      }
    }, detectionIntervalMs);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [modelStatus, isCameraActive, isVideoReady, videoRef, detectionIntervalMs]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        trackerRef.current.reset();
      }
    };
  }, []);

  const inferenceStatus = (modelStatus === 'READY' && isCameraActive && isVideoReady)
    ? 'RUNNING'
    : (modelStatus === 'READY' && isCameraActive ? 'WAITING FOR VIDEO' : 'STOPPED');

  return {
    detectionState,
    isFaceDetected: detectionState === FACE_STATES.FACE_PRESENT,
    confidence,
    modelStatus,
    inferenceStatus,
    isModelLoading: modelStatus === 'LOADING',
    modelError,
    debugStats,
  };
}

