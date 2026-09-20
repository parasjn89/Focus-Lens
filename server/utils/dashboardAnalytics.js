import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from './analytics.js';
import { getFocusLevel, calculateFocusPointsFromDurations } from './focusPoints.js';
import { formatDurationText } from '../../src/utils/deepWork.js';
import { getLocalDateString } from './consistencyEngine.js';
import { getMondayOfWeek } from './weeklyReviewEngine.js';

const CODING_KEYWORDS = [
  'cod', 'dev', 'program', 'software', 'script', 'hack', 'debug',
  'frontend', 'front-end', 'backend', 'back-end', 'fullstack', 'full-stack',
  'python', 'javascript', 'typescript', 'react', 'node', 'html', 'css',
  'sql', 'golang', 'rust', 'c++', 'c#', 'java', 'kotlin', 'swift', 'php', 'ruby',
  'git', 'github', 'gitlab', 'api', 'endpoint',
  'algorithm', 'algo', 'leetcode', 'dsa', 'data structure',
  'terminal', 'compiler', 'build', 'bug', 'feature', 'repo'
];

const STUDY_KEYWORDS = [
  'stud', 'learn', 'lecture', 'read', 'book', 'paper', 'notes',
  'course', 'class', 'tutorial', 'homework', 'assignment', 'exam',
  'test', 'revision', 'review', 'research', 'math', 'physics',
  'history', 'biology', 'science', 'chemistry', 'article', 'doc'
];

export function getSessionCategory(session) {
  if (!session) return 'Other';

  if (session.category) {
    const cat = session.category.toLowerCase().trim();
    if (cat === 'study') return 'Study';
    if (cat === 'coding') return 'Coding';
    if (cat === 'other') return 'Other';
  }

  const act = (session.selectedActivity || session.activity || session.activityType || '').toLowerCase().trim();
  const desc = (session.description || session.goalText || session.intention || session.notes || '').toLowerCase().trim();
  const fullText = `${act} ${desc}`.trim();

  // Test primary activity string first
  const actIsStudy = STUDY_KEYWORDS.some(kw => act.includes(kw));
  const actIsCoding = CODING_KEYWORDS.some(kw => act.includes(kw));

  if (actIsStudy && !actIsCoding) return 'Study';
  if (actIsCoding && !actIsStudy) return 'Coding';

  // Test full text (activity + description + goalText + intention)
  const isStudy = STUDY_KEYWORDS.some(kw => fullText.includes(kw));
  const isCoding = CODING_KEYWORDS.some(kw => fullText.includes(kw));

  if (isStudy && !isCoding) return 'Study';
  if (isCoding && !isStudy) return 'Coding';
  if (isStudy && isCoding) return actIsCoding ? 'Coding' : 'Study';

  return 'Other';
}

export function isSessionMatchingCategory(session, category) {
  if (!category || category === 'ALL' || category === 'All Work') return true;
  const target = category.toLowerCase().trim();
  const sessionCat = getSessionCategory(session).toLowerCase().trim();
  return sessionCat === target;
}

export async function getPersonalDashboardData(userId, options = {}) {
  const offsetMinutes = typeof options === 'number' ? options : (options?.timezoneOffsetMinutes ?? null);
  const now = options?.now ? new Date(options.now) : new Date();
  const requestedCategory = options?.category && options.category !== 'All Work' ? options.category : 'ALL';

  // Local calendar boundaries using FocusLens date conventions
  const todayStr = getLocalDateString(now, offsetMinutes);
  const mondayStr = getMondayOfWeek(now, offsetMinutes);
  
  // Start of today (00:00:00.000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Start of last 7 days
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);

  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // Fetch all user's sessions to compute exact user-isolated all-time Focus Points and Personal Best
  const allUserSessions = await dbStore.getSessionsByUserId(userId, { limit: 2000 });

  // Pre-load segments for each session
  const sessionSegmentMap = new Map();
  for (const s of allUserSessions) {
    const segs = await dbStore.getSegmentsBySessionId(s.id);
    sessionSegmentMap.set(s.id, segs);
  }

  let totalFocusPoints = 0;
  let todayFocusPoints = 0;
  let weeklyFocusPoints = 0;

  // Personal Best Calculation across completed user sessions
  let personalBestDeepWorkSec = 0;
  let personalBestSessionId = null;

  let todayLongestDeepWorkSec = 0;
  let weeklyLongestDeepWorkSec = 0;

  allUserSessions.forEach(s => {
    const sessionSegs = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, sessionSegs);
    const sessionPoints = stats.focusPoints || 0;

    totalFocusPoints += sessionPoints;
    const sDateStr = getLocalDateString(s.startedAt, offsetMinutes);
    const st = new Date(s.startedAt);

    const isTodaySession = sDateStr ? (sDateStr === todayStr) : (st >= startOfToday);
    const isThisWeekSession = (sDateStr && mondayStr)
      ? (sDateStr >= mondayStr && sDateStr <= todayStr)
      : (st >= sevenDaysAgo);

    if (isTodaySession) {
      todayFocusPoints += sessionPoints;
    }
    if (isThisWeekSession) {
      weeklyFocusPoints += sessionPoints;
    }

    const longestBlockInSessionSec = stats.deepWork?.longestBlockSec || 0;
    if (longestBlockInSessionSec > personalBestDeepWorkSec) {
      personalBestDeepWorkSec = longestBlockInSessionSec;
      personalBestSessionId = s.id;
    }

    if (isTodaySession && longestBlockInSessionSec > todayLongestDeepWorkSec) {
      todayLongestDeepWorkSec = longestBlockInSessionSec;
    }

    if (isThisWeekSession && longestBlockInSessionSec > weeklyLongestDeepWorkSec) {
      weeklyLongestDeepWorkSec = longestBlockInSessionSec;
    }
  });

  const levelInfo = getFocusLevel(totalFocusPoints);

  // Filter Month Sessions
  const monthSessions = allUserSessions.filter(s => new Date(s.startedAt) >= startOfMonth);

  // Filter Recent Sessions
  const recentSessions = allUserSessions.slice(0, 10);

  // Filter Today Sessions
  const todaySessions = allUserSessions.filter(s => {
    const sDateStr = getLocalDateString(s.startedAt, offsetMinutes);
    return sDateStr ? (sDateStr === todayStr) : (new Date(s.startedAt) >= startOfToday);
  });

  // Filter Weekly Sessions
  const weeklySessions = allUserSessions.filter(s => {
    const sDateStr = getLocalDateString(s.startedAt, offsetMinutes);
    return (sDateStr && mondayStr) ? (sDateStr >= mondayStr && sDateStr <= todayStr) : (new Date(s.startedAt) >= sevenDaysAgo);
  });

  // Helper to aggregate session analytics metrics
  function aggregateMetrics(sessionList) {
    if (!sessionList || sessionList.length === 0) {
      return {
        sessionCount: 0,
        totalActiveSec: 0,
        totalStudyLikeSec: 0,
        totalCodingSec: 0,
        totalPhoneSec: 0,
        totalAwaySec: 0,
        totalSpeechSec: 0,
        totalUnknownSec: 0,
        avgDurationSec: 0,
        longestStreakSec: 0,
        studyPercentage: 0,
        focusScore: 0,
        focusPoints: 0,
      };
    }

    let totalActiveSec = 0;
    let totalStudyLikeSec = 0;
    let totalCodingSec = 0;
    let totalPhoneSec = 0;
    let totalAwaySec = 0;
    let totalSpeechSec = 0;
    let totalUnknownSec = 0;
    let longestStreakSec = 0;
    let periodFocusPoints = 0;

    sessionList.forEach(session => {
      const actualSec = Math.round((session.actualDurationMs || session.plannedDurationMs || 0) / 1000);
      totalActiveSec += actualSec;

      const sessionSegs = sessionSegmentMap.get(session.id) || [];
      const stats = calculateSessionAnalytics(session, sessionSegs);

      const hasMeasuredSegments = sessionSegs && sessionSegs.length > 0;
      let sessionCodingSec = stats.durationsInSeconds.CODING || 0;
      let sessionStudySec = stats.durationsInSeconds.STUDY_LIKE || 0;

      // If no camera activity segments exist (e.g. camera disabled or offline),
      // attribute active focus time to the session's intended category so completed
      // sessions are not penalized with 0% focus scores.
      if (!hasMeasuredSegments && actualSec > 0) {
        const cat = getSessionCategory(session);
        if (cat === 'Coding') {
          sessionCodingSec = actualSec;
        } else if (cat === 'Study') {
          sessionStudySec = actualSec;
        }
      }

      totalStudyLikeSec += sessionStudySec;
      totalCodingSec += sessionCodingSec;
      totalPhoneSec += stats.durationsInSeconds.PHONE_ACTIVITY || 0;
      totalAwaySec += stats.durationsInSeconds.AWAY_OR_NOT_VISIBLE || 0;
      totalSpeechSec += stats.durationsInSeconds.SPEECH_LIKE || 0;
      totalUnknownSec += stats.durationsInSeconds.UNKNOWN || 0;

      const sessionPoints = (stats.focusPoints && stats.focusPoints > 0)
        ? stats.focusPoints
        : (Number(session.focusPoints) || 0);
      periodFocusPoints += sessionPoints;

      const sessionLongestStreak = stats.insights?.longestStudyStreakSec || (!hasMeasuredSegments ? actualSec : 0);
      if (sessionLongestStreak > longestStreakSec) {
        longestStreakSec = sessionLongestStreak;
      }
    });

    const sessionCount = sessionList.length;
    const avgDurationSec = sessionCount > 0 ? Math.round(totalActiveSec / sessionCount) : 0;
    const studyPercentage = totalActiveSec > 0 ? Math.min(100, Math.round(((totalStudyLikeSec + totalCodingSec) / totalActiveSec) * 100)) : 0;

    return {
      sessionCount,
      totalActiveSec,
      totalStudyLikeSec,
      totalCodingSec,
      totalPhoneSec,
      totalAwaySec,
      totalSpeechSec,
      totalUnknownSec,
      avgDurationSec,
      longestStreakSec,
      studyPercentage,
      focusScore: studyPercentage,
      focusPoints: periodFocusPoints,
    };
  }

  // Precompute isolated category buckets for Today
  const todayStudySessions = todaySessions.filter(s => isSessionMatchingCategory(s, 'Study'));
  const todayCodingSessions = todaySessions.filter(s => isSessionMatchingCategory(s, 'Coding'));
  const todayOtherSessions = todaySessions.filter(s => isSessionMatchingCategory(s, 'Other'));

  const categories = {
    ALL: aggregateMetrics(todaySessions),
    Study: aggregateMetrics(todayStudySessions),
    Coding: aggregateMetrics(todayCodingSessions),
    Other: aggregateMetrics(todayOtherSessions),
  };

  // Normalize requested category case
  let canonicalRequestedCategory = 'ALL';
  if (requestedCategory && requestedCategory !== 'ALL' && requestedCategory !== 'All Work') {
    const lower = requestedCategory.toLowerCase().trim();
    if (lower === 'study') canonicalRequestedCategory = 'Study';
    else if (lower === 'coding') canonicalRequestedCategory = 'Coding';
    else if (lower === 'other') canonicalRequestedCategory = 'Other';
  }

  const activeToday = canonicalRequestedCategory !== 'ALL'
    ? (categories[canonicalRequestedCategory] || aggregateMetrics([]))
    : categories.ALL;

  // Filter Weekly Sessions by requestedCategory if specified
  const filteredWeeklySessions = requestedCategory !== 'ALL'
    ? weeklySessions.filter(s => isSessionMatchingCategory(s, requestedCategory))
    : weeklySessions;

  // Calculate 7-day breakdown for Weekly Chart
  const weeklyDays = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const daySessions = filteredWeeklySessions.filter(s => {
      const st = new Date(s.startedAt);
      return st >= dayStart && st <= dayEnd;
    });

    const dayStats = aggregateMetrics(daySessions);

    weeklyDays.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: daysOfWeek[d.getDay()],
      activeSeconds: dayStats.totalActiveSec,
      studyLikeSeconds: dayStats.totalStudyLikeSec + dayStats.totalCodingSec,
      sessionCount: daySessions.length,
      focusPoints: dayStats.focusPoints,
    });
  }

  // Goal Metrics Calculation across authenticated user's sessions
  const goalSessionsList = allUserSessions.filter(s => s.goalType && s.goalType !== 'NONE' && s.goalText);
  const goalSessionsCount = goalSessionsList.length;
  const goalsCompletedCount = goalSessionsList.filter(s => Boolean(s.goalCompleted)).length;
  const goalCompletionRate = goalSessionsCount > 0 ? Math.round((goalsCompletedCount / goalSessionsCount) * 100) : 0;

  return {
    focusPoints: {
      total: totalFocusPoints,
      today: todayFocusPoints,
      weekly: weeklyFocusPoints,
      todayPoints: todayFocusPoints,
      weekPoints: weeklyFocusPoints,
      lifetime: totalFocusPoints,
      lifetimePoints: totalFocusPoints,
      currentStage: levelInfo.level,
      currentStagePoints: levelInfo.pointsInLevel,
      nextStage: levelInfo.nextLevel,
      nextStagePoints: levelInfo.nextLevelMinPoints,
      pointsToNextStage: levelInfo.pointsToNextLevel,
      progressPercent: levelInfo.progressPercent,
      isMaxStage: levelInfo.isMaxLevel,
      levelInfo,
    },
    deepWork: {
      personalBestSec: personalBestDeepWorkSec,
      personalBestText: formatDurationText(personalBestDeepWorkSec),
      personalBestSessionId,
      todayLongestSec: todayLongestDeepWorkSec,
      todayLongestText: formatDurationText(todayLongestDeepWorkSec),
      weeklyLongestSec: weeklyLongestDeepWorkSec,
      weeklyLongestText: formatDurationText(weeklyLongestDeepWorkSec),
    },
    goals: {
      totalGoalSessions: goalSessionsCount,
      goalsCompleted: goalsCompletedCount,
      completionRate: goalCompletionRate,
    },
    selectedCategory: requestedCategory,
    categories,
    today: activeToday,
    weekly: {
      metrics: aggregateMetrics(filteredWeeklySessions),
      days: weeklyDays,
    },
    monthly: {
      metrics: aggregateMetrics(monthSessions),
      monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
    },
    recentSessions: recentSessions.map(s => {
      const sessionSegs = sessionSegmentMap.get(s.id) || [];
      const stats = calculateSessionAnalytics(s, sessionSegs);
      return {
        ...s,
        focusPoints: stats.focusPoints,
        qualifyingSeconds: stats.qualifyingSeconds,
        percentages: stats.percentages,
        durationsInSeconds: stats.durationsInSeconds,
        deepWork: stats.deepWork,
      };
    }),
  };
}

