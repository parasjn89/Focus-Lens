import { useState, useEffect, useRef } from 'react';
import { detectObjectsInVideo, getObjectDetector } from '../services/objectDetector';
import { createPhoneTracker, PHONE_STATES } from '../services/phoneTracker';
import { createPersonTracker, PERSON_STATES } from '../services/personTracker';
import { createEventEngine } from '../services/eventEngine';

/**
 * Custom React hook orchestrating local browser object detection.
 */
export function useObjectDetection({
  videoRef,
  isCameraActive,
  isVideoReady = false,
  detectionIntervalMs = 500,
  onObservationEvent = null,
  onSpanCompletedEvent = null,
}) {
  const [phoneState, setPhoneState] = useState(PHONE_STATES.PHONE_ABSENT);
  const [phoneConfidence, setPhoneConfidence] = useState(null);
  
  const [personState, setPersonState] = useState(PERSON_STATES.NO_PERSON);
  const [personCount, setPersonCount] = useState(0); // Real physical person count
  const [rawPersonCount, setRawPersonCount] = useState(0);
  const [personOnPhoneCount, setPersonOnPhoneCount] = useState(0);
  const [isPersonOnPhoneScreen, setIsPersonOnPhoneScreen] = useState(false);
  const [personConfidence, setPersonConfidence] = useState(null);

  const [modelStatus, setModelStatus] = useState('IDLE'); // 'IDLE' | 'LOADING' | 'READY' | 'ERROR'
  const [error, setError] = useState(null);

  // Keep callback references updated in refs
  const onObservationEventRef = useRef(onObservationEvent);
  useEffect(() => {
    onObservationEventRef.current = onObservationEvent;
  }, [onObservationEvent]);

  const onSpanCompletedEventRef = useRef(onSpanCompletedEvent);
  useEffect(() => {
    onSpanCompletedEventRef.current = onSpanCompletedEvent;
  }, [onSpanCompletedEvent]);

  // Telemetry debug diagnostics state
  const [debugStats, setDebugStats] = useState({
    attempts: 0,
    successes: 0,
    errors: 0,
    rawPeople: 0,
    realPeople: 0,
    onPhonePeople: 0,
    rawPhones: 0,
    lastRawPhoneConfidence: null,
    lastTimestamp: null,
    lastError: null,
  });

  const statsRef = useRef({ attempts: 0, successes: 0, errors: 0 });

  const phoneTrackerRef = useRef(null);
  const personTrackerRef = useRef(null);
  const eventEngineRef = useRef(null);

  // Initialize event engine
  if (!eventEngineRef.current) {
    eventEngineRef.current = createEventEngine({
      onSpanCompleted: (completedSpan) => {
        if (onSpanCompletedEventRef.current) {
          onSpanCompletedEventRef.current(completedSpan);
        }
      },
    });
  }

  // Initialize phone tracker
  if (!phoneTrackerRef.current) {
    phoneTrackerRef.current = createPhoneTracker({
      presentThreshold: 2,
      absentThreshold: 3,
      onStateChange: (evt) => {
        setPhoneState(evt.type);
        if (eventEngineRef.current) {
          eventEngineRef.current.processObservation(evt);
        }
        if (onObservationEventRef.current) {
          onObservationEventRef.current(evt);
        }
      },
    });
  }

  // Initialize person tracker
  if (!personTrackerRef.current) {
    personTrackerRef.current = createPersonTracker({
      stabilityThreshold: 2,
      onStateChange: (evt) => {
        setPersonState(evt.state);
        setPersonCount(evt.count);
        if (eventEngineRef.current) {
          eventEngineRef.current.processObservation(evt);
        }
        if (onObservationEventRef.current) {
          onObservationEventRef.current(evt);
        }
      },
    });
  }

  // 1. Model Initialization Effect
  useEffect(() => {
    let isSubscribed = true;

    if (isCameraActive) {
      console.log('[ObjectHook] initialization requested');

      if (modelStatus === 'READY') {
        console.log('[ObjectHook] detector already exists / READY');
        return;
      }

      console.log('[ObjectHook] initialization started');
      console.log('[ObjectHook] calling getObjectDetector()');
      setModelStatus('LOADING');
      setError(null);

      getObjectDetector()
        .then((instance) => {
          if (isSubscribed) {
            console.log('[ObjectHook] getObjectDetector() returned, instance exists:', Boolean(instance));
            console.log('[ObjectHook] initialization completed');
            setModelStatus('READY');
            setError(null);
          }
        })
        .catch((err) => {
          if (isSubscribed) {
            const errMsg = err.message || String(err);
            console.error('[ObjectHook] initialization failed:', errMsg, err.stack);
            setModelStatus('ERROR');
            setError(`Failed to initialize ObjectDetector: ${errMsg}`);
            setDebugStats((prev) => ({ ...prev, lastError: errMsg }));
          }
        });

      return () => {
        isSubscribed = false;
      };
    } else {
      setModelStatus('IDLE');
      setError(null);
      setPhoneState(PHONE_STATES.PHONE_ABSENT);
      setPhoneConfidence(null);
      setPersonState(PERSON_STATES.NO_PERSON);
      setPersonCount(0);
      setRawPersonCount(0);
      setPersonOnPhoneCount(0);
      setIsPersonOnPhoneScreen(false);
      setPersonConfidence(null);

      statsRef.current = { attempts: 0, successes: 0, errors: 0 };
      setDebugStats({
        attempts: 0,
        successes: 0,
        errors: 0,
        rawPeople: 0,
        realPeople: 0,
        onPhonePeople: 0,
        rawPhones: 0,
        lastRawPhoneConfidence: null,
        lastTimestamp: null,
        lastError: null,
      });

      if (phoneTrackerRef.current) phoneTrackerRef.current.reset();
      if (personTrackerRef.current) personTrackerRef.current.reset();
      if (eventEngineRef.current) eventEngineRef.current.reset();
    }
  }, [isCameraActive]);

  // 2. Periodic Inference Loop Effect
  useEffect(() => {
    if (modelStatus !== 'READY' || !isCameraActive || !isVideoReady) {
      return;
    }

    console.log('[ObjectHook] starting inference loop');
    let isSubscribed = true;

    const intervalId = setInterval(async () => {
      const video = videoRef?.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused || video.ended || (video.currentTime === 0 && !video.seeking)) {
        return;
      }

      statsRef.current.attempts += 1;
      const currentAttempt = statsRef.current.attempts;
      if (currentAttempt === 1 || currentAttempt % 20 === 0) {
        console.log(`[ObjectHook] inference attempt #${currentAttempt}`);
      }

      try {
        const detectedObjects = await detectObjectsInVideo(video);

        if (isSubscribed) {
          statsRef.current.successes += 1;

          // Process phone tracker
          const phoneRes = phoneTrackerRef.current.processObjects(detectedObjects);
          setPhoneState((prev) => (prev !== phoneRes.currentState ? phoneRes.currentState : prev));
          setPhoneConfidence((prev) => (prev !== phoneRes.confidence ? phoneRes.confidence : prev));

          // Process person tracker (includes spatial filtering)
          const personRes = personTrackerRef.current.processObjects(detectedObjects);
          setPersonState((prev) => (prev !== personRes.currentState ? personRes.currentState : prev));
          setPersonCount((prev) => (prev !== personRes.count ? personRes.count : prev));
          setRawPersonCount((prev) => (prev !== personRes.rawCount ? personRes.rawCount : prev));
          setPersonOnPhoneCount((prev) => (prev !== personRes.personOnPhoneCount ? personRes.personOnPhoneCount : prev));
          setIsPersonOnPhoneScreen((prev) => (prev !== personRes.isPersonOnPhoneScreen ? personRes.isPersonOnPhoneScreen : prev));
          setPersonConfidence((prev) => (prev !== personRes.confidence ? personRes.confidence : prev));

          const rawPeople = personRes.rawCount || 0;
          const realPeople = personRes.count || 0;
          const onPhonePeople = personRes.personOnPhoneCount || 0;
          const phoneObjects = detectedObjects.filter((o) => o.label === 'cell phone');
          const phoneCount = phoneObjects.length;
          const maxRawPhoneConf = phoneCount > 0 ? Math.max(...phoneObjects.map((p) => p.confidence)) : null;

          if (currentAttempt === 1 || currentAttempt % 20 === 0) {
            console.log(`[ObjectHook] raw people = ${rawPeople}, real people = ${realPeople}, on-phone people = ${onPhonePeople}, raw phones = ${phoneCount} (maxConf: ${maxRawPhoneConf ? maxRawPhoneConf.toFixed(2) : 'N/A'})`);
          }

          if (currentAttempt === 1 || currentAttempt % 4 === 0) {
            setDebugStats({
              attempts: statsRef.current.attempts,
              successes: statsRef.current.successes,
              errors: statsRef.current.errors,
              rawPeople,
              realPeople,
              onPhonePeople,
              rawPhones: phoneCount,
              lastRawPhoneConfidence: maxRawPhoneConf,
              lastTimestamp: Date.now(),
              lastError: null,
            });
          }
        }
      } catch (err) {
        statsRef.current.errors += 1;
        console.error('[ObjectHook] frame processing error:', err);
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
      if (phoneTrackerRef.current) phoneTrackerRef.current.reset();
      if (personTrackerRef.current) personTrackerRef.current.reset();
      if (eventEngineRef.current) eventEngineRef.current.reset();
    };
  }, []);

  const inferenceStatus = (modelStatus === 'READY' && isCameraActive && isVideoReady)
    ? 'RUNNING'
    : (modelStatus === 'READY' && isCameraActive ? 'WAITING FOR VIDEO' : 'STOPPED');

  return {
    phoneState,
    isPhoneDetected: phoneState === PHONE_STATES.PHONE_PRESENT,
    isPhoneUncertain: phoneState === PHONE_STATES.PHONE_UNCERTAIN,
    phoneConfidence,
    personState,
    personCount, // Real physical person count
    rawPersonCount,
    personOnPhoneCount,
    isPersonOnPhoneScreen,
    personConfidence,
    modelStatus,
    inferenceStatus,
    isLoading: modelStatus === 'LOADING',
    error,
    debugStats,
    eventEngine: eventEngineRef.current,
  };
}

