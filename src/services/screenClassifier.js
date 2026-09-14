export const SCREEN_ACTIVITIES = {
  CODING: 'CODING',
  BROWSER: 'BROWSER',
  DOCUMENT: 'DOCUMENT',
  VIDEO: 'VIDEO',
  UNKNOWN: 'UNKNOWN',
};

export const SCREEN_ACTIVITY_LABELS = {
  CODING: 'Coding',
  BROWSER: 'Browser',
  DOCUMENT: 'Document',
  VIDEO: 'Video',
  UNKNOWN: 'Unable to determine',
};

/**
 * Evaluates visual features from image pixel data.
 * 
 * @param {ImageData} imageData 
 * @param {number} [timestamp=Date.now()]
 * @returns {{ type: string, activity: string, confidence: number | null, timestamp: number, metrics: { darkPixelRatio: number, brightPixelRatio: number, syntaxColorRatio: number, edgeDensity: number } }}
 */
export function classifyScreenImageData(imageData, timestamp = Date.now()) {
  if (!imageData || !imageData.data || imageData.data.length === 0) {
    return {
      type: 'SCREEN_ACTIVITY',
      activity: SCREEN_ACTIVITIES.UNKNOWN,
      confidence: null,
      timestamp,
      metrics: { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 }
    };
  }

  const data = imageData.data;
  let darkPixels = 0;
  let brightPixels = 0;
  let syntaxPixels = 0;
  let edgeDiffSum = 0;

  // Sample every 4th pixel for performance optimization (< 1ms execution)
  const step = 4 * 4; 
  let sampledCount = 0;

  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    sampledCount++;

    // Dark pixel check (IDE / Terminal dark backgrounds)
    if (r < 65 && g < 65 && b < 65) {
      darkPixels++;
    } 
    // Bright pixel check (Document / Light Web page backgrounds)
    else if (r > 190 && g > 190 && b > 190) {
      brightPixels++;
    }

    // Syntax highlight color check (non-grayscale, vibrant code hues)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    if (diff > 30 && max > 50) {
      syntaxPixels++;
    }

    // Edge difference metric with next sampled pixel
    if (i + step < data.length) {
      const nextR = data[i + step];
      const nextG = data[i + step + 1];
      const nextB = data[i + step + 2];
      edgeDiffSum += Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
    }
  }

  const darkPixelRatio = Math.round((darkPixels / sampledCount) * 100) / 100;
  const brightPixelRatio = Math.round((brightPixels / sampledCount) * 100) / 100;
  const syntaxColorRatio = Math.round((syntaxPixels / sampledCount) * 100) / 100;
  const avgEdgeDiff = edgeDiffSum / (sampledCount || 1);
  const edgeDensity = Math.round((avgEdgeDiff / 255) * 100) / 100;

  let activity = SCREEN_ACTIVITIES.UNKNOWN;
  let confidence = null;

  // Rule 1: CODING (Dark theme IDE / VS Code / Terminal with dark background & text/syntax features)
  if (darkPixelRatio > 0.32 && (syntaxColorRatio > 0.02 || edgeDensity > 0.03)) {
    activity = SCREEN_ACTIVITIES.CODING;
    confidence = 0.89;
  }
  // Rule 2: DOCUMENT (Bright white background document / PDF / paper layout)
  else if (brightPixelRatio > 0.50 && darkPixelRatio < 0.25 && syntaxColorRatio < 0.12) {
    activity = SCREEN_ACTIVITIES.DOCUMENT;
    confidence = 0.86;
  }
  // Rule 3: VIDEO (Balanced color distribution, lower sharp text edge density, higher hue saturation)
  else if (syntaxColorRatio > 0.15 && edgeDensity < 0.07 && brightPixelRatio < 0.70) {
    activity = SCREEN_ACTIVITIES.VIDEO;
    confidence = 0.82;
  }
  // Rule 4: BROWSER (Mixed bright/dark web page elements)
  else if (brightPixelRatio >= 0.15 || darkPixelRatio >= 0.15) {
    activity = SCREEN_ACTIVITIES.BROWSER;
    confidence = 0.84;
  }

  return {
    type: 'SCREEN_ACTIVITY',
    activity,
    confidence,
    timestamp,
    metrics: {
      darkPixelRatio,
      brightPixelRatio,
      syntaxColorRatio,
      edgeDensity,
    }
  };
}

/**
 * Captures a lightweight snapshot from an HTMLVideoElement onto a temporary hidden canvas.
 * @param {HTMLVideoElement} videoElement 
 * @param {HTMLCanvasElement} [hiddenCanvas=null] 
 * @returns {Object} Normalized screen activity payload
 */
export function classifyScreenVideoElement(videoElement, hiddenCanvas = null) {
  const timestamp = Date.now();

  if (!videoElement || videoElement.readyState < 2 || videoElement.ended) {
    return {
      type: 'SCREEN_ACTIVITY',
      activity: SCREEN_ACTIVITIES.UNKNOWN,
      confidence: null,
      timestamp,
      metrics: { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 }
    };
  }

  try {
    const canvas = hiddenCanvas || document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        type: 'SCREEN_ACTIVITY',
        activity: SCREEN_ACTIVITIES.UNKNOWN,
        confidence: null,
        timestamp,
        metrics: { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 }
      };
    }

    ctx.drawImage(videoElement, 0, 0, 320, 180);
    const imageData = ctx.getImageData(0, 0, 320, 180);

    return classifyScreenImageData(imageData, timestamp);
  } catch (err) {
    console.error('Error during classifyScreenVideoElement:', err);
    return {
      type: 'SCREEN_ACTIVITY',
      activity: SCREEN_ACTIVITIES.UNKNOWN,
      confidence: null,
      timestamp,
      metrics: { darkPixelRatio: 0, brightPixelRatio: 0, syntaxColorRatio: 0, edgeDensity: 0 }
    };
  }
}
