import { useState, useEffect, useRef, useCallback } from 'react';
import { requestMicrophoneStream, initAudioContext, closeMicrophoneMonitor, getMicrophoneDiagnosticStatus } from '../services/microphoneMonitor.js';
import { createSpeechTracker, SPEECH_STATES } from '../services/speechDetector.js';

/**
 * Custom React hook for local browser microphone monitoring and Voice Activity Detection (VAD).
 * 
 * @param {Object} [params]
 * @param {Function} [params.onSpeechStateChangeEvent] - Callback when speech state transitions
 * @param {number} [params.speechStartThreshold=0.15]
 * @param {number} [params.speechEndThreshold=0.08]
 * @param {number} [params.minimumSpeechDurationMs=1000]
 * @param {number} [params.minimumSilenceDurationMs=1500]
 */
export function useMicrophone({
  initialStream = null,
  onSpeechStateChangeEvent = null,
  speechStartThreshold = 0.15,
  speechEndThreshold = 0.08,
  minimumSpeechDurationMs = 1000,
  minimumSilenceDurationMs = 1500,
} = {}) {
  const [stream, setStream] = useState(initialStream);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(!!(initialStream && initialStream.active));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [speechState, setSpeechState] = useState(SPEECH_STATES.SILENCE);
  const [audioLevel, setAudioLevel] = useState(0.0);

  const [debugStats, setDebugStats] = useState({
    audioContextState: 'CLOSED',
    analyserReady: false,
    audioLevel: 0.0,
    speechState: SPEECH_STATES.SILENCE,
    lastError: null,
  });

  const onSpeechStateChangeEventRef = useRef(onSpeechStateChangeEvent);
  useEffect(() => {
    onSpeechStateChangeEventRef.current = onSpeechStateChangeEvent;
  }, [onSpeechStateChangeEvent]);

  const trackerRef = useRef(null);

  // Ownership flag: true = stream was passed externally (caller owns lifecycle), false = we created it
  const isExternalStreamRef = useRef(!!(initialStream && initialStream.active));

  if (!trackerRef.current) {
    trackerRef.current = createSpeechTracker({
      speechStartThreshold,
      speechEndThreshold,
      minimumSpeechDurationMs,
      minimumSilenceDurationMs,
      onStateChange: (evt) => {
        setSpeechState(evt.activity);
        if (onSpeechStateChangeEventRef.current) {
          onSpeechStateChangeEventRef.current(evt);
        }
      },
    });
  }

  // Handle pre-opened initialStream
  useEffect(() => {
    if (initialStream && initialStream.active) {
      isExternalStreamRef.current = true;
      setStream(initialStream);
      setIsMicrophoneActive(true);
      if (trackerRef.current) trackerRef.current.reset();

      // Monitor for external track death (hardware unplug, OS revocation)
      const audioTrack = initialStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          console.warn('[Microphone] external audio track ended (hardware disconnect or OS revocation)');
          setStream(null);
          setIsMicrophoneActive(false);
        };
      }

      let lastStateUpdateTs = 0;
      let prevLevelRef = 0;

      try {
        initAudioContext(initialStream, (level) => {
          const vadRes = trackerRef.current ? trackerRef.current.processAudioFrame(level, Date.now()) : { currentState: SPEECH_STATES.SILENCE };
          const now = Date.now();
          const levelDelta = Math.abs(level - prevLevelRef);
          if (now - lastStateUpdateTs > 200 || levelDelta > 0.05) {
            lastStateUpdateTs = now;
            prevLevelRef = level;
            setAudioLevel(level);

            const diag = getMicrophoneDiagnosticStatus();
            setDebugStats({
              audioContextState: diag.audioContextState,
              analyserReady: diag.analyserReady,
              audioLevel: level,
              speechState: vadRes.currentState,
              lastError: null,
            });
          }
        });
      } catch (e) {
        console.warn('[useMicrophone] AudioContext initialization from initialStream:', e);
      }
    }
  }, [initialStream]);

  // Start microphone monitoring
  const startMicrophone = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useMicrophone] starting microphone initialization...');
      const micStream = await requestMicrophoneStream();
      setStream(micStream);
      setIsMicrophoneActive(true);
      isExternalStreamRef.current = false; // We created this stream — we own it

      trackerRef.current.reset();

      let lastStateUpdateTs = 0;
      let prevLevelRef = 0;

      initAudioContext(micStream, (level) => {
        const vadRes = trackerRef.current.processAudioFrame(level, Date.now());
        const now = Date.now();

        // Throttle UI state updates to max once per 200ms or when state changes / significant audio level delta
        const levelDelta = Math.abs(level - prevLevelRef);
        if (now - lastStateUpdateTs > 200 || levelDelta > 0.05) {
          lastStateUpdateTs = now;
          prevLevelRef = level;
          setAudioLevel(level);

          const diag = getMicrophoneDiagnosticStatus();
          setDebugStats({
            audioContextState: diag.audioContextState,
            analyserReady: diag.analyserReady,
            audioLevel: level,
            speechState: vadRes.currentState,
            lastError: null,
          });
        }
      });

      setIsLoading(false);
      console.log('[useMicrophone] microphone started and audio context running');
    } catch (err) {
      console.error('[useMicrophone] failed to start microphone:', err);
      const errMsg = err.message || 'Microphone access denied or unavailable.';
      setError(errMsg);
      setIsLoading(false);
      setIsMicrophoneActive(false);
      setStream(null);
      setSpeechState(SPEECH_STATES.UNKNOWN);
      setDebugStats((prev) => ({ ...prev, lastError: errMsg }));
    }
  }, []);

  // Stop microphone monitoring
  const stopMicrophone = useCallback(({ skipTrackStop = false } = {}) => {
    console.log(`[useMicrophone] stopping microphone... (skipTrackStop=${skipTrackStop})`);
    closeMicrophoneMonitor({ skipTrackStop });
    isExternalStreamRef.current = false;
    setIsMicrophoneActive(false);
    setStream(null);
    setIsLoading(false);
    setError(null);
    setSpeechState(SPEECH_STATES.SILENCE);
    setAudioLevel(0.0);
    if (trackerRef.current) {
      trackerRef.current.reset();
    }
    setDebugStats({
      audioContextState: 'CLOSED',
      analyserReady: false,
      audioLevel: 0.0,
      speechState: SPEECH_STATES.SILENCE,
      lastError: null,
    });
  }, []);

  // Cleanup on component unmount — skip track.stop() for externally owned streams
  useEffect(() => {
    return () => {
      if (isExternalStreamRef.current) {
        console.log('[Microphone] cleanup: external stream — skipping track.stop()');
        stopMicrophone({ skipTrackStop: true });
      } else {
        stopMicrophone();
      }
    };
  }, [stopMicrophone]);

  return {
    stream,
    isMicrophoneActive,
    isLoading,
    error,
    speechState,
    isSpeechDetected: speechState === SPEECH_STATES.SPEECH_LIKE,
    audioLevel,
    debugStats,
    startMicrophone,
    stopMicrophone: () => stopMicrophone(), // Public API always stops tracks (user-initiated)
  };
}
