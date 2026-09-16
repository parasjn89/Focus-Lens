import { calculateAudioLevel } from './speechDetector.js';

let activeStream = null;
let audioContextInstance = null;
let sourceNodeInstance = null;
let analyserNodeInstance = null;
let analysisIntervalId = null;

/**
 * Requests browser microphone access using getUserMedia({ audio: true }).
 * Guaranteed to ONLY request audio, never video.
 * 
 * @returns {Promise<MediaStream>}
 */
export async function requestMicrophoneStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser mediaDevices.getUserMedia API is not supported in this environment.');
  }

  console.log('[Microphone] requesting microphone access (audio: true)...');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  activeStream = stream;
  console.log('[Microphone] microphone stream acquired successfully');
  return stream;
}

/**
 * Initializes Web Audio API AudioContext and AnalyserNode for local signal processing.
 * 
 * @param {MediaStream} stream 
 * @param {Function} onAudioFrameCallback - Called periodically with (normalizedAudioLevel, rawBuffer)
 * @param {number} [sampleIntervalMs=50] - Periodic analysis interval (default 50ms / 20Hz)
 * @returns {{ audioContext: AudioContext, analyser: AnalyserNode }}
 */
export function initAudioContext(stream, onAudioFrameCallback, sampleIntervalMs = 50) {
  if (!stream) {
    throw new Error('Cannot initialize AudioContext without an active MediaStream');
  }

  // Clean up any existing instances first
  closeMicrophoneMonitor();

  activeStream = stream;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API (AudioContext) is not supported in this browser');
  }

  audioContextInstance = new AudioCtx();
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume().catch((e) => console.warn('[Microphone] AudioContext resume warning:', e));
  }

  sourceNodeInstance = audioContextInstance.createMediaStreamSource(stream);
  analyserNodeInstance = audioContextInstance.createAnalyser();
  analyserNodeInstance.fftSize = 512;
  analyserNodeInstance.smoothingTimeConstant = 0.5;

  // Connect source -> analyser (do NOT connect to destination to prevent speaker feedback echo)
  sourceNodeInstance.connect(analyserNodeInstance);

  const bufferLength = analyserNodeInstance.fftSize;
  const timeDomainBuffer = new Uint8Array(bufferLength);

  console.log('[Microphone] Web Audio API AudioContext & AnalyserNode initialized');

  // Start lightweight periodic analysis loop
  analysisIntervalId = setInterval(() => {
    if (analyserNodeInstance && audioContextInstance && audioContextInstance.state === 'running') {
      analyserNodeInstance.getByteTimeDomainData(timeDomainBuffer);
      const audioLevel = calculateAudioLevel(timeDomainBuffer);
      if (onAudioFrameCallback) {
        onAudioFrameCallback(audioLevel, timeDomainBuffer);
      }
    }
  }, sampleIntervalMs);

  return {
    audioContext: audioContextInstance,
    analyser: analyserNodeInstance,
  };
}

/**
 * Safely performs 100% clean shutdown of microphone hardware, Web Audio nodes, and timers.
 * @param {Object} [options]
 * @param {boolean} [options.skipTrackStop=false] - If true, skips track.stop() calls (for externally owned streams)
 */
export function closeMicrophoneMonitor({ skipTrackStop = false } = {}) {
  console.log(`[Microphone] stopping microphone monitor and releasing resources... (skipTrackStop=${skipTrackStop})`);

  if (analysisIntervalId) {
    clearInterval(analysisIntervalId);
    analysisIntervalId = null;
  }

  if (sourceNodeInstance) {
    try {
      sourceNodeInstance.disconnect();
    } catch (e) {
      // Ignore
    }
    sourceNodeInstance = null;
  }

  if (analyserNodeInstance) {
    try {
      analyserNodeInstance.disconnect();
    } catch (e) {
      // Ignore
    }
    analyserNodeInstance = null;
  }

  if (audioContextInstance) {
    try {
      if (audioContextInstance.state !== 'closed') {
        audioContextInstance.close();
      }
    } catch (e) {
      // Ignore
    }
    audioContextInstance = null;
  }

  if (activeStream && !skipTrackStop) {
    try {
      activeStream.getTracks().forEach((track) => {
        track.stop();
        console.log(`[Microphone] Audio track [${track.label}] stopped.`);
      });
    } catch (e) {
      // Ignore
    }
  }
  activeStream = null;

  console.log('[Microphone] microphone monitor shutdown complete');
}

/**
 * Checks current AudioContext state for diagnostics.
 */
export function getMicrophoneDiagnosticStatus() {
  return {
    hasStream: Boolean(activeStream && activeStream.active),
    audioContextState: audioContextInstance ? audioContextInstance.state : 'CLOSED',
    analyserReady: Boolean(analyserNodeInstance),
  };
}
