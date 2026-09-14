import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detectorInstance = null;
let initPromise = null;
let delegateUsed = null;
let lastTimestamp = 0;

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_ASSET_PATH = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/**
 * Creates FaceDetector instance trying GPU delegate first with a 3000ms race timeout before falling back to CPU.
 */
async function createFaceDetectorWithOptions(vision, options, timeoutMs = 3000) {
  // 1. Try GPU delegate with timeout if requested
  if (options.baseOptions?.delegate === 'GPU') {
    try {
      console.log('[Vision] face model creation started (delegate: GPU)');
      const gpuPromise = FaceDetector.createFromOptions(vision, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`GPU delegate creation timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const instance = await Promise.race([gpuPromise, timeoutPromise]);
      console.log('[Vision] face model creation succeeded (delegate: GPU)');
      return { instance, delegate: 'GPU' };
    } catch (gpuErr) {
      console.warn(`[Vision] FaceDetector GPU delegate failed or timed out (${gpuErr.message}). Falling back to CPU...`);
    }
  }

  // 2. CPU fallback
  console.log('[Vision] face model creation started (delegate: CPU)');
  const cpuOptions = {
    ...options,
    baseOptions: {
      ...options.baseOptions,
      delegate: 'CPU',
    },
  };
  const cpuPromise = FaceDetector.createFromOptions(vision, cpuOptions);
  const cpuTimeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`CPU delegate creation timed out after ${timeoutMs * 2}ms`)), timeoutMs * 2)
  );
  const instance = await Promise.race([cpuPromise, cpuTimeoutPromise]);
  console.log('[Vision] face model creation succeeded (delegate: CPU)');
  return { instance, delegate: 'CPU' };
}

/**
 * Initializes and retrieves the MediaPipe FaceDetector instance.
 * Uses a single-promise lock to prevent concurrent initialization races.
 */
export function getFaceDetector() {
  if (detectorInstance) return Promise.resolve(detectorInstance);
  if (initPromise) return initPromise;

  console.log('[Vision] face initialization started');

  initPromise = (async () => {
    try {
      console.log('[Vision] face WASM/fileset loading started');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      console.log('[Vision] face WASM/fileset loaded');

      const options = {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.3,
      };

      const result = await createFaceDetectorWithOptions(vision, options, 3000);
      detectorInstance = result.instance;
      delegateUsed = result.delegate;

      console.log(`[Vision] face model READY (delegate: ${delegateUsed})`);
      return detectorInstance;
    } catch (err) {
      console.error('[Vision] face initialization FAILED:', err.name, err.message, err.stack);
      initPromise = null; // Clear lock so subsequent retries are permitted
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Ensures timestamp is strictly increasing for detectForVideo calls.
 */
function getMonotonicTimestamp() {
  const now = performance.now();
  const ts = Math.max(now, lastTimestamp + 1);
  lastTimestamp = ts;
  return Math.round(ts);
}

/**
 * Executes local face detection on an HTMLVideoElement frame.
 */
export async function detectFaceInVideo(videoElement) {
  const timestamp = Date.now();

  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0 || videoElement.paused || videoElement.ended) {
    return { faceDetected: false, confidence: null, timestamp, rawDetections: [], error: null };
  }

  try {
    const detector = await getFaceDetector();
    if (!detector) {
      return { faceDetected: false, confidence: null, timestamp, rawDetections: [], error: 'Detector instance unavailable' };
    }

    const frameTimestamp = getMonotonicTimestamp();
    const result = detector.detectForVideo(videoElement, frameTimestamp);

    if (result && result.detections && result.detections.length > 0) {
      let maxScore = 0;
      result.detections.forEach((det) => {
        if (det.categories && det.categories.length > 0) {
          const score = det.categories[0].score;
          if (score > maxScore) maxScore = score;
        }
      });

      return {
        faceDetected: true,
        confidence: Math.round(maxScore * 100) / 100,
        timestamp,
        rawDetections: result.detections,
        error: null,
      };
    }

    return {
      faceDetected: false,
      confidence: null,
      timestamp,
      rawDetections: [],
      error: null,
    };
  } catch (err) {
    console.error('[FaceDetector] Inference error during detectFaceInVideo:', err);
    return {
      faceDetected: false,
      confidence: null,
      timestamp,
      rawDetections: [],
      error: err.message || String(err),
    };
  }
}

/**
 * Isolated developer test to verify FaceDetector initialization independently.
 */
export async function testFaceModelInit() {
  const startTime = performance.now();
  console.log('=== FACE MODEL INITIALIZATION DIRECT TEST ===');
  try {
    const instance = await getFaceDetector();
    const elapsedMs = Math.round(performance.now() - startTime);
    console.log(`[FaceDetector Test] SUCCESS: FACE MODEL READY in ${elapsedMs}ms (delegate: ${delegateUsed})`);
    return { success: true, elapsedMs, delegate: delegateUsed };
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startTime);
    console.error(`[FaceDetector Test] ERROR: ${err.name} - ${err.message}`, err.stack);
    return { success: false, elapsedMs, error: err.message || String(err) };
  }
}

/**
 * Isolated developer test to run face detection ONCE on video element.
 */
export async function runSingleFaceTest(videoElement) {
  console.log('=== FACE DETECTION DIRECT TEST ===');
  if (!videoElement) {
    console.error('Test Failed: videoElement is NULL');
    return { error: 'videoElement is null' };
  }

  const info = {
    tagName: videoElement.tagName,
    readyState: videoElement.readyState,
    videoWidth: videoElement.videoWidth,
    videoHeight: videoElement.videoHeight,
    paused: videoElement.paused,
    currentTime: videoElement.currentTime,
    srcObject: Boolean(videoElement.srcObject),
  };

  console.log('Video Element Properties:', info);

  if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    console.error('Test Failed: Video element is not in ready state');
    return { error: 'Video element not ready', videoInfo: info };
  }

  try {
    const detector = await getFaceDetector();
    const ts = getMonotonicTimestamp();
    const result = detector.detectForVideo(videoElement, ts);

    console.log('Raw MediaPipe FaceDetector Result:', result);
    console.log('Number of Detections:', result?.detections?.length || 0);

    return {
      videoInfo: info,
      detectionsCount: result?.detections?.length || 0,
      rawResult: result,
    };
  } catch (err) {
    console.error('Test Execution Threw Error:', err);
    return { error: err.message || String(err), videoInfo: info };
  }
}

/**
 * Resets detector instance and clears lock.
 */
export function closeFaceDetector() {
  if (detectorInstance) {
    try {
      detectorInstance.close();
    } catch (e) {
      // Ignore
    }
    detectorInstance = null;
  }
  initPromise = null;
  delegateUsed = null;
  lastTimestamp = 0;
}
