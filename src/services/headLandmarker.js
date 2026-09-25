import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_URL, MEDIAPIPE_MODELS } from './mediapipeConfig.js';

let landmarkerInstance = null;
let initPromise = null;
let delegateUsed = null;
let lastTimestamp = 0;

const WASM_URL = MEDIAPIPE_WASM_URL;
const MODEL_ASSET_PATH = MEDIAPIPE_MODELS.headLandmarker;

/**
 * Creates FaceLandmarker instance trying GPU delegate first with a 20000ms race timeout before falling back to CPU.
 */
async function createLandmarkerWithOptions(vision, options, timeoutMs = 20000) {
  console.log('[Vision] FaceLandmarker - exact model asset URL:', options.baseOptions?.modelAssetPath);
  console.log('[Vision] FaceLandmarker - runningMode:', options.runningMode);

  if (options.baseOptions?.delegate === 'GPU') {
    try {
      console.log('[Vision] FaceLandmarker - model creation started (delegate: GPU)');
      const gpuPromise = FaceLandmarker.createFromOptions(vision, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`GPU delegate creation timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const instance = await Promise.race([gpuPromise, timeoutPromise]);
      console.log('[Vision] FaceLandmarker - model creation succeeded (delegate: GPU)');
      return { instance, delegate: 'GPU' };
    } catch (gpuErr) {
      console.warn(`[Vision] FaceLandmarker GPU delegate failed or timed out (${gpuErr.message}). Falling back to CPU...`);
      console.warn('[Vision] FaceLandmarker GPU caught exception stack:', gpuErr.stack);
    }
  }

  try {
    console.log('[Vision] FaceLandmarker - model creation started (delegate: CPU)');
    const cpuOptions = {
      ...options,
      baseOptions: {
        ...options.baseOptions,
        delegate: 'CPU',
      },
    };
    const cpuPromise = FaceLandmarker.createFromOptions(vision, cpuOptions);
    const cpuTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`CPU delegate creation timed out after ${timeoutMs * 2}ms`)), timeoutMs * 2)
    );
    const instance = await Promise.race([cpuPromise, cpuTimeoutPromise]);
    console.log('[Vision] FaceLandmarker - model creation succeeded (delegate: CPU)');
    return { instance, delegate: 'CPU' };
  } catch (cpuErr) {
    console.error('[Vision] FaceLandmarker - caught exception message:', cpuErr.message);
    console.error('[Vision] FaceLandmarker - caught exception stack:', cpuErr.stack);
    throw cpuErr;
  }
}

/**
 * Initializes and retrieves the MediaPipe FaceLandmarker instance.
 */
export function getFaceLandmarker() {
  if (landmarkerInstance) return Promise.resolve(landmarkerInstance);
  if (initPromise) return initPromise;

  console.log('[Vision] FaceLandmarker - initialization started');

  initPromise = (async () => {
    try {
      console.log('[Vision] FaceLandmarker - FilesetResolver creation started');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      console.log('[Vision] FaceLandmarker - FilesetResolver creation succeeded');

      const options = {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU'
        },
        outputFaceBlendshapes: false,
        runningMode: 'VIDEO',
        numFaces: 1
      };

      const result = await createLandmarkerWithOptions(vision, options, 20000);
      landmarkerInstance = result.instance;
      delegateUsed = result.delegate;

      console.log(`[Vision] FaceLandmarker - model READY (delegate: ${delegateUsed})`);
      return landmarkerInstance;
    } catch (err) {
      console.error('[Vision] FaceLandmarker - initialization FAILED:', err.name, err.message, err.stack);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

function getMonotonicTimestamp() {
  const now = Math.round(performance.now());
  lastTimestamp = Math.max(now, lastTimestamp + 1);
  return lastTimestamp;
}

/**
 * Extracts 3D facial landmark points from an HTMLVideoElement frame.
 */
export async function detectFacialLandmarks(videoElement) {
  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0 || videoElement.paused || videoElement.ended) {
    return null;
  }

  try {
    const landmarker = await getFaceLandmarker();
    if (!landmarker) return null;

    const frameTimestamp = getMonotonicTimestamp();
    const result = landmarker.detectForVideo(videoElement, frameTimestamp);
    if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
      return result.faceLandmarks[0];
    }
    return null;
  } catch (err) {
    console.error('[FaceLandmarker] Error during detectFacialLandmarks:', err);
    return null;
  }
}

/**
 * Isolated developer test to verify FaceLandmarker initialization independently.
 */
export async function testLandmarkerInit() {
  const startTime = performance.now();
  console.log('=== FACE LANDMARKER INITIALIZATION DIRECT TEST ===');
  try {
    const instance = await getFaceLandmarker();
    const elapsedMs = Math.round(performance.now() - startTime);
    console.log(`[Landmarker Test] SUCCESS: LANDMARKER READY in ${elapsedMs}ms (delegate: ${delegateUsed})`);
    return { success: true, elapsedMs, delegate: delegateUsed };
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startTime);
    console.error(`[Landmarker Test] ERROR: ${err.name} - ${err.message}`, err.stack);
    return { success: false, elapsedMs, error: err.message || String(err) };
  }
}

/**
 * Isolated developer test to run face landmark detection ONCE on video element.
 */
export async function runSingleLandmarkerTest(videoElement) {
  console.log('=== FACE LANDMARKER DIRECT TEST ===');
  if (!videoElement) {
    console.error('Test Failed: videoElement is NULL');
    return { error: 'videoElement is null' };
  }

  try {
    const landmarks = await detectFacialLandmarks(videoElement);
    const count = landmarks ? landmarks.length : 0;
    console.log('[Landmarker Test] Single pass result:', {
      landmarkCount: count,
      landmarks,
    });
    return { success: true, landmarkCount: count, landmarks };
  } catch (err) {
    console.error('[Landmarker Test] Error during test:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Closes landmarker instance.
 */
export function closeFaceLandmarker() {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch (e) {
      // Ignore
    }
    landmarkerInstance = null;
  }
  initPromise = null;
  delegateUsed = null;
  lastTimestamp = 0;
}
