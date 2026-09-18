import { useState, useEffect, useRef } from 'react';
import { detectFacialLandmarks, getFaceLandmarker } from '../services/headLandmarker';
import { estimateHeadPose, HEAD_ORIENTATIONS } from '../services/headPoseEstimator';
import { createHeadTracker } from '../services/headTracker';

/**
 * React hook orchestrating local browser face landmark extraction and head orientation estimation.
 */
export function useHeadOrientation({
  videoRef,
  isCameraActive,
  isVideoReady = false,
  detectionIntervalMs = 500,
  onStateChangeEvent = null,
  yawThreshold = 0.14,
  pitchDownThreshold = 0.48,
}) {
  const [orientation, setOrientation] = useState(HEAD_ORIENTATIONS.UNKNOWN);
  const [confidence, setConfidence] = useState(null);
  const [metrics, setMetrics] = useState({ yaw: 0, pitch: 0 });
  const [modelStatus, setModelStatus] = useState('IDLE'); // 'IDLE' | 'LOADING' | 'READY' | 'ERROR'
  const [error, setError] = useState(null);

  // Keep callback reference updated in ref
  const onStateChangeEventRef = useRef(onStateChangeEvent);
  useEffect(() => {
    onStateChangeEventRef.current = onStateChangeEvent;
  }, [onStateChangeEvent]);

  // Telemetry debug stats state
  const [debugStats, setDebugStats] = useState({
    attempts: 0,
    successes: 0,
    errors: 0,
    landmarkCount: 0,
    rawOrientation: 'UNKNOWN',
    lastTimestamp: null,
    lastError: null,
  });

  const statsRef = useRef({ attempts: 0, successes: 0, errors: 0 });
  const trackerRef = useRef(null);

  if (!trackerRef.current) {
    trackerRef.current = createHeadTracker({
      stabilityThreshold: 2,
      onStateChange: (evt) => {
        setOrientation(evt.orientation);
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
      console.log('[HeadHook] initialization requested');

      if (modelStatus === 'READY') {
        console.log('[HeadHook] detector already exists / READY');
        return;
      }

      console.log('[HeadHook] initialization started');
      console.log('[HeadHook] calling getFaceLandmarker()');
      setModelStatus('LOADING');
      setError(null);

      getFaceLandmarker()
        .then((instance) => {
          if (isSubscribed) {
            console.log('[HeadHook] getFaceLandmarker() returned, instance exists:', Boolean(instance));
            console.log('[HeadHook] initialization completed');
            setModelStatus('READY');
            setError(null);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            const errMsg = err.message || String(err);
            console.error('[HeadHook] initialization failed:', errMsg, err.stack);
            setModelStatus('ERROR');
            setError(`Failed to initialize FaceLandmarker: ${errMsg}`);
            setDebugStats((prev) => ({ ...prev, lastError: errMsg }));
          }
        });

      return () => {
        isSubscribed = false;
      };
    } else {
      setModelStatus('IDLE');
      setError(null);
      setOrientation(HEAD_ORIENTATIONS.UNKNOWN);
      setConfidence(null);
      setMetrics({ yaw: 0, pitch: 0 });

      statsRef.current = { attempts: 0, successes: 0, errors: 0 };
      setDebugStats({
        attempts: 0,
        successes: 0,
        errors: 0,
        landmarkCount: 0,
        rawOrientation: 'UNKNOWN',
        lastTimestamp: null,
        lastError: null,
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

    console.log('[HeadHook] starting inference loop');
    let isSubscribed = true;

    const intervalId = setInterval(async () => {
      const video = videoRef?.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended || (video.currentTime === 0 && !video.seeking)) {
        return;
      }

      statsRef.current.attempts += 1;
      const currentAttempt = statsRef.current.attempts;
      if (currentAttempt === 1 || currentAttempt % 20 === 0) {
        console.log(`[HeadHook] inference attempt #${currentAttempt}`);
      }

      try {
        const landmarks = await detectFacialLandmarks(video);
        const poseEstimate = estimateHeadPose(landmarks, { yawThreshold, pitchDownThreshold });

        if (isSubscribed) {
          statsRef.current.successes += 1;
          const landmarkCount = landmarks ? landmarks.length : 0;

          if (currentAttempt === 1 || currentAttempt % 20 === 0) {
            console.log(`[HeadHook] raw landmarks = ${landmarkCount}`);
          }

          const trackerRes = trackerRef.current.processPose(poseEstimate);
          setOrientation((prev) => (prev !== trackerRes.currentState ? trackerRes.currentState : prev));
          setConfidence((prev) => (prev !== trackerRes.confidence ? trackerRes.confidence : prev));

          setMetrics((prev) => {
            if (!prev || Math.abs((prev.yaw || 0) - (trackerRes.metrics?.yaw || 0)) > 0.03 || Math.abs((prev.pitch || 0) - (trackerRes.metrics?.pitch || 0)) > 0.03) {
              return trackerRes.metrics;
            }
            return prev;
          });

          if (currentAttempt === 1 || currentAttempt % 4 === 0) {
            setDebugStats({
              attempts: statsRef.current.attempts,
              successes: statsRef.current.successes,
              errors: statsRef.current.errors,
              landmarkCount,
              rawOrientation: poseEstimate.orientation,
              lastTimestamp: Date.now(),
              lastError: null,
            });
          }
        }
      } catch (err) {
        statsRef.current.errors += 1;
        console.error('[HeadHook] frame processing error:', err);
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
  }, [modelStatus, isCameraActive, isVideoReady, videoRef, detectionIntervalMs, yawThreshold, pitchDownThreshold]);

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
    orientation,
    confidence,
    metrics,
    modelStatus,
    inferenceStatus,
    isLoading: modelStatus === 'LOADING',
    error,
    debugStats,
  };
}

