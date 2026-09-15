import { ACTIVITY_LABELS, ACTIVITY_TYPES } from '../services/activityAnalyzer.js';
import { calculateFocusPointsFromDurations, isQualifyingActivity } from './focusPoints.js';
import { formatSecondsToTime } from './formatters.js';
import { calculateDeepWorkBlocks } from './deepWork.js';

/**
 * Calculates complete Focus Replay summary metrics from activity segments and session info.
 * 
 * @param {Array<Object>} segments Chronological activity segments
 * @param {Object} sessionInfo Session metadata (targetMinutes, actualSecondsSpent, etc.)
 * @returns {Object} Replay summary metrics, deep work blocks, and formatted interruptions
 */
export function calculateFocusReplayMetrics(segments = [], sessionInfo = {}) {
  const deepWorkData = calculateDeepWorkBlocks(segments, sessionInfo);

  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      sessionDurationMin: Math.max(1, Math.round((sessionInfo.actualSecondsSpent || sessionInfo.targetMinutes * 60 || 0) / 60)),
      focusedTimeMin: 0,
      focusPoints: 0,
      longestFocusBlockSec: 0,
      longestFocusBlockText: '0m 0s',
      longestFocusBlockSegment: null,
      totalInterruptions: 0,
      interruptions: [],
      mergedSegments: [],
      deepWork: deepWorkData,
      hasData: false,
    };
  }

  // 1. Base time normalization
  const firstStartMs = segments[0]?.startTime || Date.now();
  let totalActiveSec = sessionInfo.actualSecondsSpent || 0;

  if (totalActiveSec <= 0 && segments.length > 0) {
    const lastEndMs = segments[segments.length - 1]?.endTime || firstStartMs;
    totalActiveSec = Math.max(1, Math.round((lastEndMs - firstStartMs) / 1000));
  }

  // 2. Merge adjacent segments of identical activity type
  const mergedSegments = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.type === current.type) {
      current.endTime = Math.max(current.endTime || 0, next.endTime || 0);
      current.durationMs = Math.max(0, current.endTime - current.startTime);
      if (next.explanation) {
        current.explanation = Array.from(new Set([...(current.explanation || []), ...(next.explanation || [])]));
      }
      if (next.contributingSignals) {
        current.contributingSignals = Array.from(new Set([...(current.contributingSignals || []), ...(next.contributingSignals || [])]));
      }
    } else {
      current.durationMs = Math.max(0, (current.endTime || 0) - (current.startTime || 0));
      mergedSegments.push(current);
      current = { ...next };
    }
  }
  current.durationMs = Math.max(0, (current.endTime || 0) - (current.startTime || 0));
  mergedSegments.push(current);

  // 3. Calculate Longest Focus Block
  let longestFocusBlockSec = 0;
  let longestFocusBlockSegment = null;
  let currentFocusBlockSec = 0;
  let currentFocusBlockStartMs = null;
  let currentFocusBlockEndMs = null;

  let totalQualifyingSec = 0;
  const interruptions = [];

  mergedSegments.forEach((seg, idx) => {
    const durSec = Math.max(0, Math.round((seg.durationMs || (seg.endTime - seg.startTime)) / 1000));
    const isQualifying = isQualifyingActivity(seg.type);

    if (isQualifying) {
      totalQualifyingSec += durSec;

      if (currentFocusBlockStartMs === null) {
        currentFocusBlockStartMs = seg.startTime;
      }
      currentFocusBlockEndMs = seg.endTime;
      currentFocusBlockSec += durSec;

      if (currentFocusBlockSec > longestFocusBlockSec) {
        longestFocusBlockSec = currentFocusBlockSec;
        longestFocusBlockSegment = {
          type: 'QUALIFYING_FOCUS_BLOCK',
          label: 'Continuous Focus Block',
          startTime: currentFocusBlockStartMs,
          endTime: currentFocusBlockEndMs,
          durationMs: currentFocusBlockSec * 1000,
          durationSec: currentFocusBlockSec,
        };
      }
    } else {
      // Reset contiguous focus block
      currentFocusBlockSec = 0;
      currentFocusBlockStartMs = null;
      currentFocusBlockEndMs = null;

      // Track non-qualifying interruption
      const relativeStartSec = Math.max(0, Math.round((seg.startTime - firstStartMs) / 1000));
      const relativeEndSec = Math.max(0, Math.round((seg.endTime - firstStartMs) / 1000));
      const label = ACTIVITY_LABELS[seg.type] || seg.type;

      let observationalReason = `${label} detected.`;
      if (seg.type === 'PHONE_ACTIVITY') {
        observationalReason = 'Phone-related activity detected in camera view.';
      } else if (seg.type === 'AWAY_OR_NOT_VISIBLE') {
        observationalReason = 'Face was not detected in camera view during this period.';
      } else if (seg.type === 'MULTIPLE_PEOPLE') {
        observationalReason = 'Multiple people were detected in camera view.';
      } else if (seg.type === 'SPEECH_LIKE') {
        observationalReason = 'Speech-like audio activity detected on microphone input.';
      } else if (seg.type === 'VIDEO_ACTIVITY') {
        observationalReason = 'Video playback detected on shared screen.';
      } else if (seg.type === 'BROWSER_ACTIVITY') {
        observationalReason = 'Web browser activity detected on shared screen.';
      } else if (seg.explanation && seg.explanation.length > 0) {
        observationalReason = seg.explanation[0];
      }

      interruptions.push({
        id: seg.id || `interruption_${idx}`,
        type: seg.type,
        label,
        startTime: seg.startTime,
        endTime: seg.endTime,
        relativeStartSec,
        relativeEndSec,
        relativeStartTimeText: formatSecondsToTime(relativeStartSec),
        relativeEndTimeText: formatSecondsToTime(relativeEndSec),
        durationSec: durSec,
        durationText: formatSecondsToTime(durSec),
        observationalReason,
        explanation: seg.explanation || [observationalReason],
        contributingSignals: seg.contributingSignals || [],
        evidenceScore: seg.evidenceScore ?? null,
      });
    }
  });

  const sessionDurationMin = Math.max(1, Math.round(totalActiveSec / 60));
  const focusedTimeMin = Math.floor(totalQualifyingSec / 60);
  const focusPointsData = calculateFocusPointsFromDurations({ STUDY_LIKE: totalQualifyingSec });

  // Format longest focus block string e.g. "31m 42s" or "12m 0s"
  const mins = Math.floor(longestFocusBlockSec / 60);
  const secs = longestFocusBlockSec % 60;
  const longestFocusBlockText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return {
    sessionDurationMin,
    focusedTimeMin,
    totalActiveSec,
    totalQualifyingSec,
    focusPoints: focusPointsData.focusPoints,
    longestFocusBlockSec,
    longestFocusBlockText,
    longestFocusBlockSegment,
    totalInterruptions: interruptions.length,
    interruptions,
    mergedSegments,
    deepWork: deepWorkData,
    hasData: true,
  };
}

