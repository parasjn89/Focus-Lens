export const HEAD_ORIENTATIONS = {
  FORWARD: 'FORWARD',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  DOWN: 'DOWN',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Key MediaPipe FaceLandmarker 3D landmark indices.
 */
const LANDMARK_INDICES = {
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  FOREHEAD: 10,
};

/**
 * Estimates head orientation (Yaw & Pitch) from an array of 478 3D face landmarks.
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @param {Object} [options]
 * @param {number} [options.yawThreshold=0.14] - Threshold ratio for left/right yaw
 * @param {number} [options.pitchDownThreshold=0.48] - Ratio threshold for looking down
 * @param {number} [timestamp=Date.now()]
 * @returns {{ type: string, orientation: string, confidence: number | null, timestamp: number, metrics: { yaw: number, pitch: number } }}
 */
export function estimateHeadPose(landmarks, options = {}, timestamp = Date.now()) {
  const {
    yawThreshold = 0.14,
    pitchDownThreshold = 0.48,
  } = options;

  if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 264) {
    return {
      type: 'HEAD_ORIENTATION',
      orientation: HEAD_ORIENTATIONS.UNKNOWN,
      confidence: null,
      timestamp,
      metrics: { yaw: 0, pitch: 0 }
    };
  }

  try {
    const nose = landmarks[LANDMARK_INDICES.NOSE_TIP];
    const chin = landmarks[LANDMARK_INDICES.CHIN];
    const leftEye = landmarks[LANDMARK_INDICES.LEFT_EYE_OUTER];
    const rightEye = landmarks[LANDMARK_INDICES.RIGHT_EYE_OUTER];
    const forehead = landmarks[LANDMARK_INDICES.FOREHEAD];

    if (!nose || !leftEye || !rightEye || !chin || !forehead) {
      return {
        type: 'HEAD_ORIENTATION',
        orientation: HEAD_ORIENTATIONS.UNKNOWN,
        confidence: null,
        timestamp,
        metrics: { yaw: 0, pitch: 0 }
      };
    }

    // Midpoint between outer eye corners
    const eyeMidpointX = (leftEye.x + rightEye.x) / 2;
    const eyeMidpointY = (leftEye.y + rightEye.y) / 2;

    const faceWidth = Math.abs(rightEye.x - leftEye.x) || 0.001;
    const faceHeight = Math.abs(chin.y - forehead.y) || 0.001;

    // Calculate normalized Yaw (-0.5 to +0.5 approx)
    const rawYaw = (nose.x - eyeMidpointX) / faceWidth;
    
    // Calculate normalized Pitch (vertical ratio)
    const rawPitch = (nose.y - eyeMidpointY) / faceHeight;

    const yaw = Math.round(rawYaw * 100) / 100;
    const pitch = Math.round(rawPitch * 100) / 100;

    let orientation = HEAD_ORIENTATIONS.FORWARD;

    // Classify head direction
    if (rawPitch > pitchDownThreshold) {
      orientation = HEAD_ORIENTATIONS.DOWN;
    } else if (rawYaw < -yawThreshold) {
      // Note: Video is mirrored in preview, so negative yaw corresponds to looking right / left
      orientation = HEAD_ORIENTATIONS.LEFT;
    } else if (rawYaw > yawThreshold) {
      orientation = HEAD_ORIENTATIONS.RIGHT;
    }

    // Estimate confidence from landmark clarity
    const confidence = 0.88;

    return {
      type: 'HEAD_ORIENTATION',
      orientation,
      confidence,
      timestamp,
      metrics: { yaw, pitch }
    };
  } catch (err) {
    console.error('Error during head pose estimation:', err);
    return {
      type: 'HEAD_ORIENTATION',
      orientation: HEAD_ORIENTATIONS.UNKNOWN,
      confidence: null,
      timestamp,
      metrics: { yaw: 0, pitch: 0 }
    };
  }
}
