export const SCREEN_SOURCE_TYPES = {
  SCREEN: 'screen',
  WINDOW: 'window',
  BROWSER_TAB: 'browser-tab',
  UNKNOWN: 'unknown',
};

/**
 * Maps browser MediaTrackSettings displaySurface property to normalized sourceType.
 * @param {MediaStreamTrack} track 
 * @returns {string} screen | window | browser-tab | unknown
 */
export function getSourceTypeFromTrack(track) {
  if (!track || typeof track.getSettings !== 'function') {
    return SCREEN_SOURCE_TYPES.UNKNOWN;
  }

  const settings = track.getSettings();
  const surface = settings.displaySurface;

  if (surface === 'monitor') return SCREEN_SOURCE_TYPES.SCREEN;
  if (surface === 'window') return SCREEN_SOURCE_TYPES.WINDOW;
  if (surface === 'browser') return SCREEN_SOURCE_TYPES.BROWSER_TAB;

  return SCREEN_SOURCE_TYPES.UNKNOWN;
}

/**
 * Creates a normalized screen observation payload.
 * 
 * @param {boolean} screenActive 
 * @param {MediaStreamTrack | null} [track=null] 
 * @param {number} [timestamp=Date.now()]
 * @returns {{ type: string, screenActive: boolean, sourceType: string, timestamp: number }}
 */
export function createScreenObservation(screenActive, track = null, timestamp = Date.now()) {
  const sourceType = screenActive && track ? getSourceTypeFromTrack(track) : SCREEN_SOURCE_TYPES.UNKNOWN;

  return {
    type: 'SCREEN_OBSERVATION',
    screenActive,
    sourceType,
    timestamp,
  };
}
