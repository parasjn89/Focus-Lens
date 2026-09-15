import { isQualifyingActivity } from './focusPoints.js';
import { formatSecondsToTime } from './formatters.js';

/**
 * Checks whether an activity type qualifies as a focus activity.
 * Canonical focus activity types: STUDY_LIKE, CODING, DOCUMENT_ACTIVITY.
 * 
 * @param {string} activityType 
 * @returns {boolean}
 */
export function isQualifyingFocusActivity(activityType) {
  return isQualifyingActivity(activityType);
}

/**
 * Formats a timestamp into HH:MM or MM:SS format relative to session start or absolute clock.
 * 
 * @param {number} timestampMs 
 * @param {number} sessionStartMs 
 * @returns {string} E.g., "14:20" or "00:00"
 */
export function formatBlockTime(timestampMs, sessionStartMs = null) {
  if (!timestampMs || isNaN(timestampMs)) return '00:00';
  
  if (sessionStartMs !== null && sessionStartMs > 0 && timestampMs >= sessionStartMs) {
    const diffSec = Math.max(0, Math.floor((timestampMs - sessionStartMs) / 1000));
    return formatSecondsToTime(diffSec);
  }

  const d = new Date(timestampMs);
  if (isNaN(d.getTime())) return '00:00';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Formats seconds duration into readable text e.g. "31m 42s", "24m 0s", "45s".
 * 
 * @param {number} totalSec 
 * @returns {string}
 */
export function formatDurationText(totalSec = 0) {
  const validSec = Math.max(0, Math.round(totalSec || 0));
  if (validSec === 0) return '0m 0s';
  const mins = Math.floor(validSec / 60);
  const secs = validSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Calculates continuous Deep Work Blocks from activity segments.
 * 
 * Rule:
 * 1. Adjacent qualifying segments (STUDY_LIKE, CODING, DOCUMENT_ACTIVITY) are merged into a continuous Deep Work Block.
 * 2. Gap threshold: Adjacent qualifying segments within 10 seconds of each other without non-qualifying segments between them are merged into one block.
 * 3. Non-qualifying activities (PHONE_ACTIVITY, AWAY_OR_NOT_VISIBLE, MULTIPLE_PEOPLE, SPEECH_LIKE, VIDEO_ACTIVITY, BROWSER_ACTIVITY, UNKNOWN) terminate the block.
 * 4. Overlapping segment ranges are merged cleanly without double-counting duration.
 * 
 * @param {Array<Object>} segments - Array of activity segments
 * @param {Object} [sessionInfo={}] - Optional session metadata
 * @returns {Object} Deep Work Blocks analytics
 */
export function calculateDeepWorkBlocks(segments = [], sessionInfo = {}) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      blocks: [],
      longestBlockSec: 0,
      longestBlockText: '0m 0s',
      longestBlockRange: '00:00–00:00',
      longestBlock: null,
      totalDeepWorkSec: 0,
      totalDeepWorkText: '0m 0s',
      deepWorkBlocksCount: 0,
      hasData: false,
    };
  }

  // 1. Sort segments chronologically
  const validSegments = segments
    .filter(s => s && typeof s === 'object')
    .map((s, idx) => {
      const start = Number(s.startTime) || 0;
      const end = Number(s.endTime) || start + Number(s.durationMs || 0);
      return {
        ...s,
        id: s.id || `seg_${idx}`,
        startTime: start,
        endTime: Math.max(start, end),
        type: s.activityType || s.type || 'UNKNOWN',
      };
    })
    .sort((a, b) => a.startTime - b.startTime);

  if (validSegments.length === 0) {
    return {
      blocks: [],
      longestBlockSec: 0,
      longestBlockText: '0m 0s',
      longestBlockRange: '00:00–00:00',
      longestBlock: null,
      totalDeepWorkSec: 0,
      totalDeepWorkText: '0m 0s',
      deepWorkBlocksCount: 0,
      hasData: false,
    };
  }

  const sessionStartMs = validSegments[0].startTime;

  // 2. Identify and merge continuous qualifying focus blocks
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < validSegments.length; i++) {
    const seg = validSegments[i];
    const isQualifying = isQualifyingFocusActivity(seg.type);

    if (isQualifying) {
      if (!currentBlock) {
        // Start new Deep Work Block
        currentBlock = {
          id: `deep_work_block_${blocks.length + 1}`,
          startTime: seg.startTime,
          endTime: seg.endTime,
          qualifyingSegments: [seg],
          types: new Set([seg.type]),
        };
      } else {
        // Check if contiguous or overlapping with current block (gap <= 10000ms / 10s)
        const gapMs = seg.startTime - currentBlock.endTime;
        if (gapMs <= 10000) {
          // Extend current block
          currentBlock.endTime = Math.max(currentBlock.endTime, seg.endTime);
          currentBlock.qualifyingSegments.push(seg);
          currentBlock.types.add(seg.type);
        } else {
          // Finalize current block and start a new one
          blocks.push(currentBlock);
          currentBlock = {
            id: `deep_work_block_${blocks.length + 1}`,
            startTime: seg.startTime,
            endTime: seg.endTime,
            qualifyingSegments: [seg],
            types: new Set([seg.type]),
          };
        }
      }
    } else {
      // Non-qualifying segment breaks the active Deep Work Block
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    }
  }

  // Finalize last active block if present
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // 3. Process finalized blocks (calculate exact non-overlapping durations and readable labels)
  let longestBlockSec = 0;
  let longestBlock = null;
  let totalDeepWorkSec = 0;

  const processedBlocks = blocks.map((block, idx) => {
    const durationMs = Math.max(0, block.endTime - block.startTime);
    const durationSec = Math.round(durationMs / 1000);
    const durationText = formatDurationText(durationSec);

    const startText = formatBlockTime(block.startTime, sessionStartMs);
    const endText = formatBlockTime(block.endTime, sessionStartMs);
    const timeRangeText = `${startText}–${endText}`;

    totalDeepWorkSec += durationSec;

    const processed = {
      id: block.id || `deep_work_block_${idx + 1}`,
      blockNumber: idx + 1,
      startTime: block.startTime,
      endTime: block.endTime,
      durationMs,
      durationSec,
      durationText,
      startText,
      endText,
      timeRangeText,
      types: Array.from(block.types),
      segmentCount: block.qualifyingSegments.length,
    };

    if (durationSec > longestBlockSec || !longestBlock) {
      longestBlockSec = durationSec;
      longestBlock = processed;
    }

    return processed;
  });

  const longestBlockText = formatDurationText(longestBlockSec);
  const totalDeepWorkText = formatDurationText(totalDeepWorkSec);

  return {
    blocks: processedBlocks,
    longestBlockSec,
    longestBlockText,
    longestBlockRange: longestBlock ? longestBlock.timeRangeText : '00:00–00:00',
    longestBlock,
    totalDeepWorkSec,
    totalDeepWorkText,
    deepWorkBlocksCount: processedBlocks.length,
    hasData: processedBlocks.length > 0,
  };
}
