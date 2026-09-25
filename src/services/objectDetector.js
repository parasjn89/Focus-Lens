import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_URL, MEDIAPIPE_MODELS } from './mediapipeConfig.js';

let detectorInstance = null;
let initPromise = null;
let delegateUsed = null;
let lastTimestamp = 0;

const WASM_URL = MEDIAPIPE_WASM_URL;
const MODEL_ASSET_PATH = MEDIAPIPE_MODELS.objectDetector;

/**
 * Creates ObjectDetector instance trying GPU delegate first with a 20000ms race timeout before falling back to CPU.
 */
async function createObjectDetectorWithOptions(vision, options, timeoutMs = 20000) {
  console.log('[Vision] ObjectDetector - exact model asset URL:', options.baseOptions?.modelAssetPath);
  console.log('[Vision] ObjectDetector - runningMode:', options.runningMode);

  if (options.baseOptions?.delegate === 'GPU') {
    try {
      console.log('[Vision] ObjectDetector - model creation started (delegate: GPU)');
      const gpuPromise = ObjectDetector.createFromOptions(vision, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`GPU delegate creation timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      const instance = await Promise.race([gpuPromise, timeoutPromise]);
      console.log('[Vision] ObjectDetector - model creation succeeded (delegate: GPU)');
      return { instance, delegate: 'GPU' };
    } catch (gpuErr) {
      console.warn(`[Vision] ObjectDetector GPU delegate failed or timed out (${gpuErr.message}). Falling back to CPU...`);
      console.warn('[Vision] ObjectDetector GPU caught exception stack:', gpuErr.stack);
    }
  }

  try {
    console.log('[Vision] ObjectDetector - model creation started (delegate: CPU)');
    const cpuOptions = {
      ...options,
      baseOptions: {
        ...options.baseOptions,
        delegate: 'CPU',
      },
    };
    const cpuPromise = ObjectDetector.createFromOptions(vision, cpuOptions);
    const cpuTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`CPU delegate creation timed out after ${timeoutMs * 2}ms`)), timeoutMs * 2)
    );
    const instance = await Promise.race([cpuPromise, cpuTimeoutPromise]);
    console.log('[Vision] ObjectDetector - model creation succeeded (delegate: CPU)');
    return { instance, delegate: 'CPU' };
  } catch (cpuErr) {
    console.error('[Vision] ObjectDetector - caught exception message:', cpuErr.message);
    console.error('[Vision] ObjectDetector - caught exception stack:', cpuErr.stack);
    throw cpuErr;
  }
}

/**
 * Initializes and retrieves the MediaPipe ObjectDetector instance.
 */
export function getObjectDetector() {
  if (detectorInstance) return Promise.resolve(detectorInstance);
  if (initPromise) return initPromise;

  console.log('[Vision] ObjectDetector - initialization started');

  initPromise = (async () => {
    try {
      console.log('[Vision] ObjectDetector - FilesetResolver creation started');
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      console.log('[Vision] ObjectDetector - FilesetResolver creation succeeded');

      const options = {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: 'GPU'
        },
        scoreThreshold: 0.15,
        runningMode: 'VIDEO'
      };

      const result = await createObjectDetectorWithOptions(vision, options, 20000);
      detectorInstance = result.instance;
      delegateUsed = result.delegate;

      console.log(`[Vision] ObjectDetector - model READY (delegate: ${delegateUsed})`);
      return detectorInstance;
    } catch (err) {
      console.error('[Vision] ObjectDetector - initialization FAILED:', err.name, err.message, err.stack);
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
 * Detects if a given video element is rendering a screen-share stream.
 * Physical camera object detection must never run on screen-share frames.
 */
export function isScreenShareVideo(videoElement) {
  if (!videoElement) return false;
  try {
    const stream = videoElement.srcObject;
    if (stream && typeof stream.getVideoTracks === 'function') {
      const tracks = stream.getVideoTracks();
      for (const track of tracks) {
        const settings = track.getSettings ? track.getSettings() : {};
        if (settings.displaySurface) {
          return true;
        }
        const label = (track.label || '').toLowerCase();
        if (label.includes('screen') || label.includes('display') || label.includes('window') || label.includes('monitor')) {
          return true;
        }
      }
    }
  } catch (e) {
    // Non-fatal fallback
  }
  return false;
}

/**
 * Executes local object detection on an HTMLVideoElement frame.
 */
export async function detectObjectsInVideo(videoElement) {
  const timestamp = Date.now();

  if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0 || videoElement.paused || videoElement.ended) {
    return [];
  }

  if (isScreenShareVideo(videoElement)) {
    console.warn('[ObjectDetector] Discarded inference call on screen-share stream. Object detection runs only on webcam streams.');
    return [];
  }

  try {
    const detector = await getObjectDetector();
    if (!detector) return [];

    const frameTimestamp = getMonotonicTimestamp();
    const result = detector.detectForVideo(videoElement, frameTimestamp);

    if (!result || !result.detections) return [];

    const normalizedObjects = [];

    result.detections.forEach((det) => {
      if (det.categories && det.categories.length > 0) {
        const category = det.categories[0];
        const rawLabel = (category.categoryName || category.displayName || '').toLowerCase();
        
        let normalizedLabel = rawLabel;
        if (rawLabel.includes('phone') || rawLabel.includes('mobile')) {
          normalizedLabel = 'cell phone';
        } else if (rawLabel.includes('person')) {
          normalizedLabel = 'person';
        }

        const bbox = det.boundingBox || { originX: 0, originY: 0, width: 0, height: 0 };

        if (normalizedLabel === 'cell phone') {
          console.log(`[ObjectDetector Raw] Raw phone detection: rawLabel="${rawLabel}", score=${category.score.toFixed(3)}, box=[${Math.round(bbox.originX)}, ${Math.round(bbox.originY)}, ${Math.round(bbox.width)}, ${Math.round(bbox.height)}]`);
        } else if (normalizedLabel === 'person') {
          console.log(`[ObjectDetector Raw] Raw person detection: score=${category.score.toFixed(3)}, box=[x:${Math.round(bbox.originX)}, y:${Math.round(bbox.originY)}, w:${Math.round(bbox.width)}, h:${Math.round(bbox.height)}]`);
        }

        normalizedObjects.push({
          type: 'OBJECT_DETECTED',
          label: normalizedLabel,
          confidence: Math.round(category.score * 100) / 100,
          timestamp,
          boundingBox: {
            x: Math.round(bbox.originX),
            y: Math.round(bbox.originY),
            width: Math.round(bbox.width),
            height: Math.round(bbox.height),
          }
        });
      }
    });

    const personDets = normalizedObjects.filter((o) => o.label === 'person');
    if (personDets.length > 1) {
      console.log(`[ObjectDetector Raw] Multi-person raw detections (${personDets.length} in frame):`, personDets.map((p) => `conf=${p.confidence}, box=[${p.boundingBox.x},${p.boundingBox.y},${p.boundingBox.width}x${p.boundingBox.height}]`).join(' | '));
    }

    return normalizedObjects;
  } catch (err) {
    console.error('[ObjectDetector] Inference error in detectObjectsInVideo:', err);
    return [];
  }
}

/**
 * Isolated developer test to verify ObjectDetector initialization independently.
 */
export async function testObjectModelInit() {
  const startTime = performance.now();
  console.log('=== OBJECT MODEL INITIALIZATION DIRECT TEST ===');
  try {
    const instance = await getObjectDetector();
    const elapsedMs = Math.round(performance.now() - startTime);
    console.log(`[ObjectDetector Test] SUCCESS: OBJECT MODEL READY in ${elapsedMs}ms (delegate: ${delegateUsed})`);
    return { success: true, elapsedMs, delegate: delegateUsed };
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - startTime);
    console.error(`[ObjectDetector Test] ERROR: ${err.name} - ${err.message}`, err.stack);
    return { success: false, elapsedMs, error: err.message || String(err) };
  }
}

/**
 * Isolated developer test to run object detection ONCE on video element.
 */
export async function runSingleObjectTest(videoElement) {
  console.log('=== OBJECT DETECTION DIRECT TEST ===');
  if (!videoElement) {
    console.error('Test Failed: videoElement is NULL');
    return { error: 'videoElement is null' };
  }

  try {
    const objects = await detectObjectsInVideo(videoElement);
    const peopleCount = objects.filter((o) => o.label === 'person').length;
    const phoneCount = objects.filter((o) => o.label === 'cell phone').length;

    console.log('[ObjectDetector Test] Single pass results:', {
      totalObjects: objects.length,
      peopleCount,
      phoneCount,
      rawObjects: objects,
    });

    return {
      success: true,
      totalObjects: objects.length,
      peopleCount,
      phoneCount,
      objects,
    };
  } catch (err) {
    console.error('[ObjectDetector Test] Error during test:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Resets object detector instance.
 */
export function closeObjectDetector() {
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
