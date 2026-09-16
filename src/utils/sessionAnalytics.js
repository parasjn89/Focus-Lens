import { ACTIVITY_TYPES, ACTIVITY_LABELS } from '../services/activityAnalyzer.js';

// Authoritative Permission Terminal State Check Helpers
export const isTerminalCamera = (status) => ['ALLOWED', 'DENIED', 'UNAVAILABLE', 'ERROR'].includes(status);
export const isTerminalMic = (status) => ['ALLOWED', 'DENIED', 'UNAVAILABLE', 'ERROR'].includes(status);
export const isTerminalScreen = (status) => ['SHARED', 'CANCELLED', 'UNAVAILABLE', 'ERROR'].includes(status);

export const isPermissionsComplete = (statuses) =>
  isTerminalCamera(statuses?.camera) &&
  isTerminalMic(statuses?.microphone) &&
  isTerminalScreen(statuses?.screen);


/**
 * Normalizes an activity segment to ensure it contains both canonical frontend and database keys.
 * 
 * @param {Object} seg 
 * @param {number} [idx=0] 
 * @returns {Object|null}
 */
export function normalizeActivitySegment(seg, idx = 0) {
  if (!seg || typeof seg !== 'object') return null;
  const type = seg.type || seg.activityType || 'UNKNOWN';
  const start = Number(seg.startTime ?? seg.startTimeMs ?? 0);
  const end = Number(seg.endTime ?? seg.endTimeMs ?? (start + Number(seg.durationMs || 0)));
  const dur = Number(seg.durationMs ?? Math.max(0, end - start));

  return {
    ...seg,
    id: seg.id || `seg_${idx}`,
    type,
    activityType: type,
    startTime: start,
    startTimeMs: start,
    endTime: Math.max(start, end),
    endTimeMs: Math.max(start, end),
    durationMs: dur,
    label: seg.label || ACTIVITY_LABELS[type] || type,
  };
}

/**
 * Merges adjacent activity segments of identical activity types.
 * 
 * @param {Array<Object>} segments 
 * @returns {Array<Object>}
 */
export function mergeAdjacentSegments(segments = []) {
  if (!segments || segments.length === 0) return [];

  // Normalize and sort chronologically by startTime
  const normalized = segments
    .map((s, idx) => normalizeActivitySegment(s, idx))
    .filter(Boolean)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  if (normalized.length === 0) return [];

  const merged = [];
  let current = { ...normalized[0] };

  for (let i = 1; i < normalized.length; i++) {
    const next = normalized[i];

    if (next.type === current.type) {
      current.endTime = Math.max(current.endTime || 0, next.endTime || 0);
      current.endTimeMs = current.endTime;
      current.durationMs = Math.max(0, current.endTime - (current.startTime || 0));
      
      if (next.contributingSignals) {
        current.contributingSignals = Array.from(
          new Set([...(current.contributingSignals || []), ...(next.contributingSignals || [])])
        );
      }
      if (next.explanation) {
        current.explanation = Array.from(
          new Set([...(current.explanation || []), ...(next.explanation || [])])
        );
      }
    } else {
      current.durationMs = Math.max(0, (current.endTime || 0) - (current.startTime || 0));
      merged.push(current);
      current = { ...next };
    }
  }

  current.durationMs = Math.max(0, (current.endTime || 0) - (current.startTime || 0));
  merged.push(current);

  return merged;
}

/**
 * Calculates total aggregated durations for every activity category in seconds.
 * 
 * @param {Array<Object>} segments 
 * @returns {Object} Total duration in seconds per activity type
 */
export function calculateActivityDurations(segments = []) {
  const totals = {
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

  const merged = mergeAdjacentSegments(segments);

  merged.forEach((seg) => {
    const durationMs = seg.durationMs || ((seg.endTime || 0) - (seg.startTime || 0));
    const durationSec = Math.max(0, Math.round(durationMs / 1000));
    const type = seg.type || seg.activityType || 'UNKNOWN';
    
    if (totals[type] !== undefined) {
      totals[type] += durationSec;
    } else {
      totals.UNKNOWN += durationSec;
    }
  });

  return totals;
}

/**
 * Calculates percentage distribution for each activity category relative to total active seconds.
 * 
 * @param {Object} durations - Durations object in seconds per category
 * @param {number} totalActiveSeconds - Total active session duration in seconds
 * @returns {Object} Percentage integer per category
 */
export function calculateActivityPercentages(durations = {}, totalActiveSeconds = 0) {
  const sumDurations = Object.values(durations).reduce((acc, d) => acc + (d || 0), 0);
  const effectiveTotal = sumDurations > 0 ? sumDurations : Math.max(0, totalActiveSeconds);
  const percentages = {};

  if (effectiveTotal <= 0) {
    Object.keys(ACTIVITY_TYPES).forEach((key) => {
      percentages[key] = 0;
    });
    return percentages;
  }

  Object.keys(ACTIVITY_TYPES).forEach((key) => {
    const durationSec = durations[key] || 0;
    percentages[key] = Math.round((durationSec / effectiveTotal) * 100);
  });

  return percentages;
}

/**
 * Finds the longest uninterrupted segment for a target activity (or overall).
 * 
 * @param {Array<Object>} segments 
 * @param {string} [targetType=null] - Optional activity type to filter by
 * @returns {{ durationSeconds: number, segment: Object | null }}
 */
export function getLongestActivitySegment(segments = [], targetType = null) {
  const merged = mergeAdjacentSegments(segments);
  let maxSec = 0;
  let maxSeg = null;

  merged.forEach((seg) => {
    if (!targetType || seg.type === targetType) {
      const durationMs = seg.durationMs || ((seg.endTime || 0) - (seg.startTime || 0));
      const durationSec = Math.max(0, Math.round(durationMs / 1000));
      if (durationSec > maxSec) {
        maxSec = durationSec;
        maxSeg = seg;
      }
    }
  });

  return { durationSeconds: maxSec, segment: maxSeg };
}

/**
 * Counts segment occurrences per activity category.
 * 
 * @param {Array<Object>} segments 
 * @returns {Object} Segment count per category
 */
export function countActivitySegments(segments = []) {
  const counts = {
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

  const merged = mergeAdjacentSegments(segments);

  merged.forEach((seg) => {
    const type = seg.type || seg.activityType || 'UNKNOWN';
    if (counts[type] !== undefined) {
      counts[type] += 1;
    } else {
      counts.UNKNOWN += 1;
    }
  });

  return counts;
}

/**
 * Calculates transition count between different activity types.
 * 
 * @param {Array<Object>} segments 
 * @returns {number} Number of transitions
 */
export function calculateTransitionCount(segments = []) {
  const merged = mergeAdjacentSegments(segments);
  return Math.max(0, merged.length - 1);
}

/**
 * Normalizes activity segments by filling gaps with UNKNOWN activity and clamping bounds.
 * 
 * @param {Array<Object>} segments 
 * @param {number} sessionStartMs 
 * @param {number} sessionEndMs 
 * @returns {Array<Object>} Normalized, gap-filled segment list
 */
export function normalizeActivitySegments(segments = [], sessionStartMs = Date.now(), sessionEndMs = Date.now()) {
  if (!segments || segments.length === 0) {
    const durationMs = Math.max(0, sessionEndMs - sessionStartMs);
    if (durationMs <= 0) return [];
    return [{
      id: `norm_gap_0`,
      type: ACTIVITY_TYPES.UNKNOWN,
      label: ACTIVITY_LABELS.UNKNOWN,
      startTime: sessionStartMs,
      endTime: sessionEndMs,
      durationMs,
      evidenceScore: null,
      explanation: ['No activity recorded'],
      contributingSignals: [],
    }];
  }

  const sorted = [...segments].sort((a, b) => a.startTime - b.startTime);
  const normalized = [];
  let currentCursor = sessionStartMs;

  sorted.forEach((seg, idx) => {
    const clampedStart = Math.max(sessionStartMs, seg.startTime);
    const clampedEnd = Math.min(sessionEndMs, seg.endTime);

    if (clampedStart > currentCursor + 2000) {
      // Gap detected -> insert UNKNOWN
      normalized.push({
        id: `norm_gap_${idx}`,
        type: ACTIVITY_TYPES.UNKNOWN,
        label: ACTIVITY_LABELS.UNKNOWN,
        startTime: currentCursor,
        endTime: clampedStart,
        durationMs: clampedStart - currentCursor,
        evidenceScore: null,
        explanation: ['Unmonitored interval gap'],
        contributingSignals: [],
      });
    }

    if (clampedEnd > clampedStart) {
      normalized.push({
        ...seg,
        startTime: clampedStart,
        endTime: clampedEnd,
        durationMs: clampedEnd - clampedStart,
      });
      currentCursor = clampedEnd;
    }
  });

  if (sessionEndMs > currentCursor + 2000) {
    normalized.push({
      id: `norm_gap_end`,
      type: ACTIVITY_TYPES.UNKNOWN,
      label: ACTIVITY_LABELS.UNKNOWN,
      startTime: currentCursor,
      endTime: sessionEndMs,
      durationMs: sessionEndMs - currentCursor,
      evidenceScore: null,
      explanation: ['Session concluded gap'],
      contributingSignals: [],
    });
  }

  return mergeAdjacentSegments(normalized);
}

/**
 * Computes structured insights summary from activity segments.
 * 
 * @param {Array<Object>} segments 
 * @param {number} totalActiveSeconds 
 * @returns {Object} Structured insights metrics
 */
export function generateSessionInsights(segments = [], totalActiveSeconds = 0) {
  const merged = mergeAdjacentSegments(segments);
  const durations = calculateActivityDurations(merged);
  const counts = countActivitySegments(merged);

  // Longest study-like or coding streak
  let longestStudyStreakSec = 0;
  merged.forEach((seg) => {
    if (seg.type === 'STUDY_LIKE' || seg.type === 'CODING') {
      const durSec = Math.round((seg.durationMs || (seg.endTime - seg.startTime)) / 1000);
      if (durSec > longestStudyStreakSec) longestStudyStreakSec = durSec;
    }
  });

  const longestCoding = getLongestActivitySegment(merged, 'CODING');
  const longestPhone = getLongestActivitySegment(merged, 'PHONE_ACTIVITY');

  return {
    totalActiveSeconds,
    longestStudyStreakSec,
    longestCodingStreakSec: longestCoding.durationSeconds,
    totalPhoneSec: durations.PHONE_ACTIVITY || 0,
    phoneEventCount: counts.PHONE_ACTIVITY || 0,
    longestPhoneEventSec: longestPhone.durationSeconds,
    totalMultiplePeopleSec: durations.MULTIPLE_PEOPLE || 0,
    multiplePeopleEventCount: counts.MULTIPLE_PEOPLE || 0,
    totalAwaySec: durations.AWAY_OR_NOT_VISIBLE || 0,
    totalUnknownSec: durations.UNKNOWN || 0,
    transitionCount: calculateTransitionCount(merged),
  };
}

/**
 * Prepares JSON export payload containing derived metadata ONLY.
 * Guaranteed to exclude binary images, video streams, or canvas data.
 * 
 * @param {Object} sessionInfo 
 * @param {Array<Object>} segments 
 * @param {Object} [analyticsStats=null] 
 * @returns {Object} Clean JSON export metadata payload
 */
export function exportSessionMetadata(sessionInfo = {}, segments = [], analyticsStats = null) {
  const merged = mergeAdjacentSegments(segments);
  const totalActiveSeconds = sessionInfo.actualSecondsSpent || 0;
  const durations = calculateActivityDurations(merged);
  const percentages = calculateActivityPercentages(durations, totalActiveSeconds);
  const counts = countActivitySegments(merged);
  const insights = generateSessionInsights(merged, totalActiveSeconds);

  // Sanitize segment fields to guarantee privacy
  const sanitizedSegments = merged.map((seg, idx) => ({
    id: seg.id || `seg_${idx}`,
    type: seg.type,
    label: seg.label || ACTIVITY_LABELS[seg.type] || seg.type,
    startTime: seg.startTime,
    endTime: seg.endTime,
    durationMs: seg.durationMs || ((seg.endTime || 0) - (seg.startTime || 0)),
    evidenceScore: seg.evidenceScore ?? null,
    explanation: seg.explanation || [],
    contributingSignals: seg.contributingSignals || [],
    userFeedback: seg.userFeedback || null,
  }));

  return {
    app: 'FocusLens',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    privacyNotice: 'Report generated from locally processed activity signals. No raw video, frames, screenshots, or recordings are included.',
    session: {
      activity: sessionInfo.activity || 'Focus Session',
      targetMinutes: sessionInfo.targetMinutes || 25,
      actualSecondsSpent: totalActiveSeconds,
      pausedSecondsSpent: sessionInfo.pausedSecondsSpent || 0,
      completedAt: sessionInfo.completedAt || new Date().toLocaleTimeString(),
    },
    statistics: {
      totalActiveSeconds,
      durationsInSeconds: durations,
      percentages,
      segmentCounts: counts,
      transitionCount: insights.transitionCount,
      insights,
    },
    activitySegments: sanitizedSegments,
  };
}

/**
 * Deterministic developer-only test dataset generator (120 minutes focus session).
 * Used ONLY for dev/testing analytics UI without live camera recording.
 * 
 * Distribution:
 * - 0:00 -> 35:00 (2100s) STUDY_LIKE
 * - 35:00 -> 44:00 (540s) PHONE_ACTIVITY
 * - 44:00 -> 72:00 (1680s) CODING
 * - 72:00 -> 81:00 (540s) MULTIPLE_PEOPLE
 * - 81:00 -> 109:00 (1680s) STUDY_LIKE
 * - 109:00 -> 114:00 (300s) AWAY_OR_NOT_VISIBLE
 * - 114:00 -> 118:00 (240s) UNKNOWN
 * 
 * Total: 118 minutes (7080 seconds).
 * 
 * @returns {Object} Mock report data payload
 */
export function generateMockSessionData() {
  const baseTime = Date.now() - 7080 * 1000;

  const mockSegments = [
    {
      id: 'mock_seg_1',
      type: ACTIVITY_TYPES.STUDY_LIKE,
      label: ACTIVITY_LABELS.STUDY_LIKE,
      startTime: baseTime,
      endTime: baseTime + 2100 * 1000,
      durationMs: 2100 * 1000,
      evidenceScore: 0.88,
      explanation: ['Face present in camera view', 'Document/PDF page detected on screen', 'One person detected', 'Head oriented forward'],
      contributingSignals: ['SCREEN_DOCUMENT', 'FACE_PRESENT', 'ONE_PERSON', 'HEAD_FORWARD'],
    },
    {
      id: 'mock_seg_2',
      type: ACTIVITY_TYPES.PHONE_ACTIVITY,
      label: ACTIVITY_LABELS.PHONE_ACTIVITY,
      startTime: baseTime + 2100 * 1000,
      endTime: baseTime + 2640 * 1000,
      durationMs: 540 * 1000,
      evidenceScore: 0.95,
      explanation: ['Cell phone detected in camera view', 'Head oriented downward toward phone'],
      contributingSignals: ['PHONE_PRESENT', 'HEAD_DOWN'],
    },
    {
      id: 'mock_seg_3',
      type: ACTIVITY_TYPES.CODING,
      label: ACTIVITY_LABELS.CODING,
      startTime: baseTime + 2640 * 1000,
      endTime: baseTime + 4320 * 1000,
      durationMs: 1680 * 1000,
      evidenceScore: 0.90,
      explanation: ['Coding environment detected on screen', 'Face present in camera view', 'One person detected'],
      contributingSignals: ['SCREEN_CODING', 'FACE_PRESENT', 'ONE_PERSON'],
    },
    {
      id: 'mock_seg_4',
      type: ACTIVITY_TYPES.MULTIPLE_PEOPLE,
      label: ACTIVITY_LABELS.MULTIPLE_PEOPLE,
      startTime: baseTime + 4320 * 1000,
      endTime: baseTime + 4860 * 1000,
      durationMs: 540 * 1000,
      evidenceScore: 0.92,
      explanation: ['More than one person detected in camera view'],
      contributingSignals: ['MULTIPLE_PEOPLE', 'COUNT_2'],
    },
    {
      id: 'mock_seg_5',
      type: ACTIVITY_TYPES.STUDY_LIKE,
      label: ACTIVITY_LABELS.STUDY_LIKE,
      startTime: baseTime + 4860 * 1000,
      endTime: baseTime + 6540 * 1000,
      durationMs: 1680 * 1000,
      evidenceScore: 0.88,
      explanation: ['Document/PDF page detected on screen', 'Face present in camera view'],
      contributingSignals: ['SCREEN_DOCUMENT', 'FACE_PRESENT', 'ONE_PERSON'],
    },
    {
      id: 'mock_seg_6',
      type: ACTIVITY_TYPES.AWAY_OR_NOT_VISIBLE,
      label: ACTIVITY_LABELS.AWAY_OR_NOT_VISIBLE,
      startTime: baseTime + 6540 * 1000,
      endTime: baseTime + 6840 * 1000,
      durationMs: 300 * 1000,
      evidenceScore: 0.92,
      explanation: ['No face detected in camera view', 'User stepped away from desk'],
      contributingSignals: ['FACE_ABSENT', 'NO_PERSON'],
    },
    {
      id: 'mock_seg_7',
      type: ACTIVITY_TYPES.UNKNOWN,
      label: ACTIVITY_LABELS.UNKNOWN,
      startTime: baseTime + 6840 * 1000,
      endTime: baseTime + 7080 * 1000,
      durationMs: 240 * 1000,
      evidenceScore: null,
      explanation: ['Insufficient or unclassified observational signals'],
      contributingSignals: ['UNCLASSIFIED_SIGNALS'],
    }
  ];

  return {
    activity: 'Studying & Deep Focus',
    targetMinutes: 120,
    actualSecondsSpent: 7080,
    pausedSecondsSpent: 120,
    activitySegments: mockSegments,
    completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isMockData: true,
  };
}
