/**
 * Focus Points & Level System Utility for FocusLens.
 * 
 * Rules:
 * - 1 Focus Point for each 60 seconds (1 minute) of qualifying focused activity.
 * - Qualifying Activity Types: STUDY_LIKE, CODING, DOCUMENT_ACTIVITY.
 * - Non-qualifying Activity Types: PHONE_ACTIVITY, MULTIPLE_PEOPLE, AWAY_OR_NOT_VISIBLE, VIDEO_ACTIVITY, BROWSER_ACTIVITY, SPEECH_LIKE, UNKNOWN.
 * - Focus Points = Math.floor(totalQualifyingSeconds / 60).
 * 
 * Level Thresholds:
 * 0 - 299      -> Beginner
 * 300 - 549    -> Focused
 * 550 - 949    -> Consistent
 * 950 - 1499   -> Deep Worker
 * 1500+        -> Focus Master
 */

export const QUALIFYING_ACTIVITIES = new Set([
  'STUDY_LIKE',
  'CODING',
  'DOCUMENT_ACTIVITY',
]);

export const FOCUS_LEVELS = [
  { name: 'Beginner', minPoints: 0, maxPoints: 299 },
  { name: 'Focused', minPoints: 300, maxPoints: 549 },
  { name: 'Consistent', minPoints: 550, maxPoints: 949 },
  { name: 'Deep Worker', minPoints: 950, maxPoints: 1499 },
  { name: 'Focus Master', minPoints: 1500, maxPoints: Infinity },
];

/**
 * Checks if an activity type is a qualifying focused activity.
 */
export function isQualifyingActivity(activityType) {
  if (!activityType) return false;
  return QUALIFYING_ACTIVITIES.has(activityType.toUpperCase().trim());
}

/**
 * Calculates total qualifying focus seconds from activity segment durations in seconds or milliseconds.
 * 
 * @param {Object} durationsInSeconds Object mapping activity types to seconds, or array of segment objects
 * @returns {{ qualifyingSeconds: number, focusPoints: number }}
 */
export function calculateFocusPointsFromDurations(durationsInSeconds = {}) {
  let qualifyingSeconds = 0;

  if (Array.isArray(durationsInSeconds)) {
    // Array of segments passed
    const segments = durationsInSeconds;
    segments.forEach(seg => {
      const type = (seg.activityType || seg.type || '').toUpperCase().trim();
      if (QUALIFYING_ACTIVITIES.has(type)) {
        const durSec = Math.max(0, Math.round((seg.durationMs || (seg.endTime - seg.startTime) || 0) / 1000));
        qualifyingSeconds += durSec;
      }
    });
  } else if (typeof durationsInSeconds === 'object' && durationsInSeconds !== null) {
    // Durations object passed e.g. { STUDY_LIKE: 2400, PHONE_ACTIVITY: 300 }
    Object.entries(durationsInSeconds).forEach(([type, sec]) => {
      if (QUALIFYING_ACTIVITIES.has(type.toUpperCase().trim())) {
        qualifyingSeconds += Math.max(0, Number(sec) || 0);
      }
    });
  }

  const focusPoints = Math.floor(qualifyingSeconds / 60);

  return {
    qualifyingSeconds,
    qualifyingMinutes: Math.floor(qualifyingSeconds / 60),
    focusPoints,
  };
}

/**
 * Derives current Level and progress details from total Focus Points.
 * Strictly enforces boundary behavior:
 * 299 -> Beginner, 300 -> Focused
 * 549 -> Focused, 550 -> Consistent
 * 949 -> Consistent, 950 -> Deep Worker
 * 1499 -> Deep Worker, 1500 -> Focus Master
 * 
 * @param {number} totalPoints 
 * @returns {{
 *   level: string,
 *   currentPoints: number,
 *   pointsInLevel: number,
 *   pointsToNextLevel: number,
 *   nextLevel: string | null,
 *   nextLevelMinPoints: number | null,
 *   levelMinPoints: number,
 *   levelMaxPoints: number | null,
 *   progressPercent: number,
 *   isMaxLevel: boolean
 * }}
 */
export function getFocusLevel(totalPoints = 0) {
  const points = Math.max(0, Math.floor(Number(totalPoints) || 0));

  if (points >= 1500) {
    return {
      level: 'Focus Master',
      currentPoints: points,
      pointsInLevel: points - 1500,
      pointsToNextLevel: 0,
      nextLevel: null,
      nextLevelMinPoints: null,
      levelMinPoints: 1500,
      levelMaxPoints: null,
      progressPercent: 100,
      isMaxLevel: true,
    };
  }

  for (let i = 0; i < FOCUS_LEVELS.length - 1; i++) {
    const lvl = FOCUS_LEVELS[i];
    const nextLvl = FOCUS_LEVELS[i + 1];

    if (points >= lvl.minPoints && points <= lvl.maxPoints) {
      const levelSpan = nextLvl.minPoints - lvl.minPoints;
      const pointsInLevel = points - lvl.minPoints;
      const pointsToNextLevel = nextLvl.minPoints - points;
      const progressPercent = Math.min(100, Math.round((pointsInLevel / levelSpan) * 100));

      return {
        level: lvl.name,
        currentPoints: points,
        pointsInLevel,
        pointsToNextLevel,
        nextLevel: nextLvl.name,
        nextLevelMinPoints: nextLvl.minPoints,
        levelMinPoints: lvl.minPoints,
        levelMaxPoints: lvl.maxPoints,
        progressPercent,
        isMaxLevel: false,
      };
    }
  }

  return {
    level: 'Beginner',
    currentPoints: 0,
    pointsInLevel: 0,
    pointsToNextLevel: 300,
    nextLevel: 'Focused',
    nextLevelMinPoints: 300,
    levelMinPoints: 0,
    levelMaxPoints: 299,
    progressPercent: 0,
    isMaxLevel: false,
  };
}
