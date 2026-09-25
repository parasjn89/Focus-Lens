/**
 * FocusLens MediaPipe Vision Configuration & Remote Asset Hub
 *
 * Centralizes all remote WASM binaries and machine learning models for the on-device
 * computer vision pipeline (Face Detection, Head Pose, Object/Phone Detection).
 *
 * Model assets are hosted on Google's high-availability storage CDN and jsDelivr CDN
 * to ensure fast streaming, browser-level cacheability, and minimal repository bloat.
 */

// MediaPipe Vision WASM Runtime (v1.0.1)
export const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

// On-Device ML Models (Float16 Quantized for client-side WebAssembly inference)
export const MEDIAPIPE_MODELS = {
  // BlazeFace Short-Range Detector (~2.3 MB)
  faceDetector: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',

  // Face Landmarker / Head Pose Estimator (~30 MB)
  headLandmarker: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',

  // EfficientDet-Lite0 Object & Phone Detector (~14 MB)
  objectDetector: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
};

/**
 * Returns the configured WASM URL
 */
export function getMediaPipeWasmUrl() {
  return MEDIAPIPE_WASM_URL;
}

/**
 * Returns model asset path for a given vision task
 * @param {'faceDetector' | 'headLandmarker' | 'objectDetector'} taskName
 */
export function getMediaPipeModelPath(taskName) {
  return MEDIAPIPE_MODELS[taskName] || null;
}
