import { calculateFocusPointsFromDurations } from './focusPoints.js';
import { calculateDeepWorkBlocks } from '../../src/utils/deepWork.js';

export function calculateSessionAnalytics(session, segments = []) {
  const actualDurationMs = session.actualDurationMs || session.plannedDurationMs || 0;
  const totalActiveSeconds = Math.max(1, Math.round(actualDurationMs / 1000));

  const durationsInSeconds = {
    CODING: 0,
    STUDY_LIKE: 0,
    PHONE_ACTIVITY: 0,
    MULTIPLE_PEOPLE: 0,
    AWAY_OR_NOT_VISIBLE: 0,
    VIDEO_ACTIVITY: 0,
    BROWSER_ACTIVITY: 0,
    DOCUMENT_ACTIVITY: 0,
    SPEECH_LIKE: 0,
    UNKNOWN: 0,
  };

  const segmentCounts = {
    CODING: 0,
    STUDY_LIKE: 0,
    PHONE_ACTIVITY: 0,
    MULTIPLE_PEOPLE: 0,
    AWAY_OR_NOT_VISIBLE: 0,
    VIDEO_ACTIVITY: 0,
    BROWSER_ACTIVITY: 0,
    DOCUMENT_ACTIVITY: 0,
    SPEECH_LIKE: 0,
    UNKNOWN: 0,
  };

  let longestStreakSec = 0;
  let currentStreakSec = 0;
  let lastType = null;

  segments.forEach((seg) => {
    const type = seg.activityType || seg.type || 'UNKNOWN';
    const durSec = Math.max(0, Math.round((seg.durationMs || 0) / 1000));

    if (durationsInSeconds[type] !== undefined) {
      durationsInSeconds[type] += durSec;
      segmentCounts[type] += 1;
    } else {
      durationsInSeconds.UNKNOWN += durSec;
      segmentCounts.UNKNOWN += 1;
    }

    if (type === lastType) {
      currentStreakSec += durSec;
    } else {
      currentStreakSec = durSec;
      lastType = type;
    }

    if ((type === 'STUDY_LIKE' || type === 'CODING' || type === 'DOCUMENT_ACTIVITY') && currentStreakSec > longestStreakSec) {
      longestStreakSec = currentStreakSec;
    }
  });

  const percentages = {};
  Object.keys(durationsInSeconds).forEach((key) => {
    percentages[key] = Math.round((durationsInSeconds[key] / totalActiveSeconds) * 100);
  });

  const focusScore = Math.min(100, Math.max(0, (percentages.STUDY_LIKE || 0) + (percentages.CODING || 0) + (percentages.DOCUMENT_ACTIVITY || 0)));

  const pointsData = calculateFocusPointsFromDurations(durationsInSeconds);
  const deepWorkData = calculateDeepWorkBlocks(segments, session);

  return {
    focusScore,
    focusPoints: pointsData.focusPoints,
    qualifyingSeconds: pointsData.qualifyingSeconds,
    qualifyingMinutes: pointsData.qualifyingMinutes,
    totalActiveSeconds,
    durationsInSeconds,
    percentages,
    segmentCounts,
    deepWork: deepWorkData,
    insights: {
      longestStudyStreakSec: longestStreakSec,
      totalPhoneSec: durationsInSeconds.PHONE_ACTIVITY,
      phoneEventCount: segmentCounts.PHONE_ACTIVITY,
      totalMultiplePeopleSec: durationsInSeconds.MULTIPLE_PEOPLE,
      multiplePeopleEventCount: segmentCounts.MULTIPLE_PEOPLE,
      totalAwaySec: durationsInSeconds.AWAY_OR_NOT_VISIBLE,
      totalUnknownSec: durationsInSeconds.UNKNOWN,
      totalSegments: segments.length,
    },
  };
}

