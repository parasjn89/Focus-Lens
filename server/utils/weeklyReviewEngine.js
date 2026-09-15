import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from './analytics.js';
import { getLocalDateComponents, getLocalDateString, generateConsistencyAnalysis } from './consistencyEngine.js';
import { generateFocusCoachAnalysis } from './focusCoachEngine.js';
import { formatDurationText } from '../../src/utils/deepWork.js';

/**
 * Format date object into YYYY-MM-DD
 */
function formatDateISO(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get Monday date string YYYY-MM-DD for any given date & offset
 */
export function getMondayOfWeek(dateInput, offsetMinutes = null) {
  const comp = getLocalDateComponents(dateInput, offsetMinutes);
  if (!comp) return null;

  const dayOfWeek = comp.dayOfWeek; // 0 (Sun) - 6 (Sat)
  const distToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Input timestamp in target local representation
  const d = new Date(dateInput);
  const targetMs = offsetMinutes !== null && offsetMinutes !== undefined
    ? d.getTime() - offsetMinutes * 60 * 1000
    : d.getTime();

  const mondayMs = targetMs - distToMon * 86400000;
  const mondayDate = new Date(mondayMs);

  if (offsetMinutes !== null && offsetMinutes !== undefined) {
    return mondayDate.toISOString().split('T')[0];
  }

  const y = mondayDate.getFullYear();
  const m = String(mondayDate.getMonth() + 1).padStart(2, '0');
  const day = String(mondayDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * FocusLens Weekly Review Engine
 */
export async function generateWeeklyReviewAnalysis(userId, weekDateInput = null, options = {}) {
  const offsetMinutes = typeof options === 'number' ? options : (options?.timezoneOffsetMinutes ?? null);
  const now = options?.now ? new Date(options.now) : new Date();

  // Determine current/target week Monday YYYY-MM-DD
  const targetInput = weekDateInput || now;
  const weekStartDate = getMondayOfWeek(targetInput, offsetMinutes);

  // Compute Monday date components
  const mondayParts = weekStartDate.split('-').map(Number);
  const mondayUtc = new Date(Date.UTC(mondayParts[0], mondayParts[1] - 1, mondayParts[2]));

  // 7 days of the target week (Monday -> Sunday)
  const weekDays = [];
  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(mondayUtc.getTime() + i * 86400000);
    const dateStr = formatDateISO(dayDate);
    weekDays.push({
      dateStr,
      dayName: weekdayNames[i],
    });
  }

  const weekEndDate = weekDays[6].dateStr;

  // Determine Previous Week Monday YYYY-MM-DD
  const prevMondayUtc = new Date(mondayUtc.getTime() - 7 * 86400000);
  const prevWeekDays = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(prevMondayUtc.getTime() + i * 86400000);
    prevWeekDays.push(formatDateISO(dayDate));
  }

  // Fetch all user sessions
  const allUserSessions = await dbStore.getSessionsByUserId(userId, { limit: 2000 });

  // Pre-load segment map
  const sessionSegmentMap = new Map();
  for (const s of allUserSessions) {
    const segs = await dbStore.getSegmentsBySessionId(s.id);
    sessionSegmentMap.set(s.id, segs);
  }

  // Helper to check if a session date string matches target week
  const getSessionDateStr = (s) => getLocalDateString(s.startedAt || s.createdAt, offsetMinutes);

  const currentWeekSessions = [];
  const previousWeekSessions = [];

  let allTimePersonalBestDeepWorkSec = 0;

  allUserSessions.forEach((s) => {
    const dateStr = getSessionDateStr(s);
    const segs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segs);

    const longestBlockSec = stats.deepWork?.longestBlockSec || 0;
    if (longestBlockSec > allTimePersonalBestDeepWorkSec) {
      allTimePersonalBestDeepWorkSec = longestBlockSec;
    }

    if (weekDays.some(d => d.dateStr === dateStr)) {
      currentWeekSessions.push(s);
    }
    if (prevWeekDays.includes(dateStr)) {
      previousWeekSessions.push(s);
    }
  });

  // Filter completed sessions
  const currentCompleted = currentWeekSessions.filter(s => s.status === 'COMPLETED');
  const previousCompleted = previousWeekSessions.filter(s => s.status === 'COMPLETED');

  // 1. Overview Metrics (Current Week)
  let currentFocusPoints = 0;
  let currentFocusedSec = 0;
  let currentActiveSec = 0;
  const currentFocusDatesSet = new Set();

  currentCompleted.forEach((s) => {
    const segs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segs);

    currentFocusPoints += stats.focusPoints || 0;
    currentFocusedSec += stats.qualifyingSeconds || 0;
    currentActiveSec += stats.totalActiveSeconds || 0;

    if (stats.qualifyingSeconds > 0) {
      const dStr = getSessionDateStr(s);
      if (dStr) currentFocusDatesSet.add(dStr);
    }
  });

  const completedSessionsCount = currentCompleted.length;
  const focusDaysCount = currentFocusDatesSet.size;

  // 2. Previous Week Overview Metrics
  let previousFocusPoints = 0;
  let previousFocusedSec = 0;
  let previousActiveSec = 0;

  previousCompleted.forEach((s) => {
    const segs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segs);

    previousFocusPoints += stats.focusPoints || 0;
    previousFocusedSec += stats.qualifyingSeconds || 0;
    previousActiveSec += stats.totalActiveSeconds || 0;
  });

  const previousSessionCount = previousCompleted.length;
  const hasPreviousData = previousSessionCount > 0;

  // Comparison Percentages
  let focusedChangePercent = 0;
  if (hasPreviousData && previousFocusedSec > 0) {
    focusedChangePercent = Math.round(((currentFocusedSec - previousFocusedSec) / previousFocusedSec) * 100);
  }

  let focusPointsChangePercent = 0;
  if (hasPreviousData && previousFocusPoints > 0) {
    focusPointsChangePercent = Math.round(((currentFocusPoints - previousFocusPoints) / previousFocusPoints) * 100);
  }

  const sessionCountChange = completedSessionsCount - previousSessionCount;

  // 3. Daily Activity Breakdown (Mon -> Sun)
  const dailyActivity = weekDays.map(({ dateStr, dayName }) => {
    const daySessions = currentCompleted.filter(s => getSessionDateStr(s) === dateStr);
    let dayFocusedSec = 0;
    let dayPoints = 0;

    daySessions.forEach(s => {
      const segs = sessionSegmentMap.get(s.id) || [];
      const stats = calculateSessionAnalytics(s, segs);
      dayFocusedSec += stats.qualifyingSeconds || 0;
      dayPoints += stats.focusPoints || 0;
    });

    return {
      date: dateStr,
      dayName,
      focusedSeconds: dayFocusedSec,
      focusedMinutes: Math.round(dayFocusedSec / 60),
      focusPoints: dayPoints,
      sessionCount: daySessions.length,
    };
  });

  // 4. Deep Work Metrics
  let weeklyLongestDeepWorkSec = 0;
  let totalDeepWorkSec = 0;
  let deepWorkBlockCount = 0;

  currentCompleted.forEach(s => {
    const segs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segs);

    const longest = stats.deepWork?.longestBlockSec || 0;
    if (longest > weeklyLongestDeepWorkSec) {
      weeklyLongestDeepWorkSec = longest;
    }

    const blocks = stats.deepWork?.blocks || [];
    deepWorkBlockCount += blocks.length;
    blocks.forEach(b => {
      totalDeepWorkSec += b.durationSec || 0;
    });
  });

  const isPersonalBest = weeklyLongestDeepWorkSec > 0 && weeklyLongestDeepWorkSec >= allTimePersonalBestDeepWorkSec;

  // 5. Goals Metrics
  const currentGoalSessions = currentWeekSessions.filter(s => s.goalType && s.goalType !== 'NONE' && s.goalText);
  const goalSessionsCount = currentGoalSessions.length;
  const completedGoalsCount = currentGoalSessions.filter(s => Boolean(s.goalCompleted)).length;
  const goalCompletionRate = goalSessionsCount > 0 ? Math.round((completedGoalsCount / goalSessionsCount) * 100) : 0;

  const goalSummaryList = currentGoalSessions.slice(0, 5).map(s => ({
    id: s.id,
    goalText: s.goalText,
    goalType: s.goalType,
    goalProgress: s.goalProgress || 0,
    targetValue: s.targetValue,
    targetUnit: s.targetUnit,
    goalCompleted: Boolean(s.goalCompleted),
    status: s.status,
  }));

  // 6. Distraction Metrics
  const distractionDurations = {
    PHONE_ACTIVITY: 0,
    AWAY_OR_NOT_VISIBLE: 0,
    SPEECH_LIKE: 0,
    MULTIPLE_PEOPLE: 0,
    UNKNOWN: 0,
  };
  let totalDistractionEvents = 0;
  const sessionDistractionTracker = new Map();

  currentCompleted.forEach(s => {
    const segs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segs);

    distractionDurations.PHONE_ACTIVITY += stats.durationsInSeconds.PHONE_ACTIVITY || 0;
    distractionDurations.AWAY_OR_NOT_VISIBLE += stats.durationsInSeconds.AWAY_OR_NOT_VISIBLE || 0;
    distractionDurations.SPEECH_LIKE += stats.durationsInSeconds.SPEECH_LIKE || 0;
    distractionDurations.MULTIPLE_PEOPLE += stats.durationsInSeconds.MULTIPLE_PEOPLE || 0;
    distractionDurations.UNKNOWN += stats.durationsInSeconds.UNKNOWN || 0;

    totalDistractionEvents += (stats.segmentCounts.PHONE_ACTIVITY || 0)
      + (stats.segmentCounts.AWAY_OR_NOT_VISIBLE || 0)
      + (stats.segmentCounts.SPEECH_LIKE || 0)
      + (stats.segmentCounts.MULTIPLE_PEOPLE || 0);

    const hasPhone = (stats.durationsInSeconds.PHONE_ACTIVITY || 0) > 30;
    const hasAway = (stats.durationsInSeconds.AWAY_OR_NOT_VISIBLE || 0) > 30;
    const hasSpeech = (stats.durationsInSeconds.SPEECH_LIKE || 0) > 30;
    const hasPeople = (stats.durationsInSeconds.MULTIPLE_PEOPLE || 0) > 30;

    if (hasPhone) sessionDistractionTracker.set('PHONE_ACTIVITY', (sessionDistractionTracker.get('PHONE_ACTIVITY') || 0) + 1);
    if (hasAway) sessionDistractionTracker.set('AWAY_OR_NOT_VISIBLE', (sessionDistractionTracker.get('AWAY_OR_NOT_VISIBLE') || 0) + 1);
    if (hasSpeech) sessionDistractionTracker.set('SPEECH_LIKE', (sessionDistractionTracker.get('SPEECH_LIKE') || 0) + 1);
    if (hasPeople) sessionDistractionTracker.set('MULTIPLE_PEOPLE', (sessionDistractionTracker.get('MULTIPLE_PEOPLE') || 0) + 1);
  });

  const totalDistractionSec = Object.values(distractionDurations).reduce((a, b) => a + b, 0);

  // Find top distraction category
  let topCategory = 'None';
  let topCategorySec = 0;

  Object.entries(distractionDurations).forEach(([cat, sec]) => {
    if (sec > topCategorySec) {
      topCategorySec = sec;
      topCategory = cat;
    }
  });

  const categoryLabels = {
    PHONE_ACTIVITY: 'Phone activity',
    AWAY_OR_NOT_VISIBLE: 'Looking away / not visible',
    SPEECH_LIKE: 'Background speech',
    MULTIPLE_PEOPLE: 'Multiple people present',
    UNKNOWN: 'Unclassified screen activity',
    None: 'None',
  };

  const topCategoryLabel = categoryLabels[topCategory] || topCategory;
  const topCategorySessions = sessionDistractionTracker.get(topCategory) || 0;

  // 7. Consistency Streaks
  const consistencyData = generateConsistencyAnalysis(allUserSessions, sessionSegmentMap, {
    timezoneOffsetMinutes: offsetMinutes,
  });

  // 8. Weekly Highlight (ONE strongest supported positive factual statement)
  let highlight = 'Keep building your focus habit one session at a time.';

  if (weeklyLongestDeepWorkSec >= 1200) {
    highlight = `Your longest Deep Work Block was ${formatDurationText(weeklyLongestDeepWorkSec)}.`;
  } else if (currentFocusPoints >= 100) {
    highlight = `You earned ${currentFocusPoints} Focus Points this week.`;
  } else if (completedSessionsCount >= 3) {
    highlight = `You completed ${completedSessionsCount} focus sessions this week.`;
  } else if (focusDaysCount >= 3) {
    highlight = `You focused on ${focusDaysCount} days this week.`;
  } else if (currentFocusedSec > 0) {
    highlight = `You completed ${Math.round(currentFocusedSec / 60)} minutes of qualifying focus time this week.`;
  }

  // 9. Focus Coach Recommendation for Next Week
  const coachAnalysis = generateFocusCoachAnalysis(currentCompleted, sessionSegmentMap);
  const recommendation = coachAnalysis.recommendation || 'Keep sessions consistent and short for steady progress.';

  // 10. Saved Reflection Notes
  const savedNote = await dbStore.getWeeklyReviewNote(userId, weekStartDate);

  return {
    weekStartDate,
    weekEndDate,
    todayDate: getLocalDateString(now, offsetMinutes),

    overview: {
      focusPoints: currentFocusPoints,
      focusedSeconds: currentFocusedSec,
      focusedText: formatDurationText(currentFocusedSec),
      completedSessions: completedSessionsCount,
      focusDays: focusDaysCount,
      eligibleDays: 7,
    },

    comparison: {
      hasPreviousData,
      previousFocusedSeconds: previousFocusedSec,
      previousFocusedText: formatDurationText(previousFocusedSec),
      focusedChangePercent,
      previousFocusPoints,
      focusPointsChangePercent,
      previousSessionCount,
      sessionCountChange,
    },

    daily: dailyActivity,

    deepWork: {
      longestBlockSeconds: weeklyLongestDeepWorkSec,
      longestBlockText: formatDurationText(weeklyLongestDeepWorkSec),
      totalDeepWorkSeconds: totalDeepWorkSec,
      totalDeepWorkText: formatDurationText(totalDeepWorkSec),
      blockCount: deepWorkBlockCount,
      isPersonalBest,
    },

    goals: {
      goalSessions: goalSessionsCount,
      completedGoals: completedGoalsCount,
      completionRate: goalCompletionRate,
      goalsList: goalSummaryList,
    },

    distractions: {
      totalEvents: totalDistractionEvents,
      totalSeconds: totalDistractionSec,
      totalText: formatDurationText(totalDistractionSec),
      topCategory: topCategoryLabel,
      topCategorySessions,
      completedSessionsCount,
    },

    consistency: {
      currentStreak: consistencyData.currentStreak,
      bestStreak: consistencyData.bestStreak,
      focusDays: focusDaysCount,
      eligibleDays: 7,
    },

    highlight,
    recommendation,

    notes: {
      workedWell: savedNote?.workedWell || '',
      madeItHard: savedNote?.madeItHard || '',
      updatedAt: savedNote?.updatedAt || null,
    },
  };
}
