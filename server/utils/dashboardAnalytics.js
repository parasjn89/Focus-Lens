import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from './analytics.js';
import { getFocusLevel, calculateFocusPointsFromDurations } from './focusPoints.js';
import { formatDurationText } from '../../src/utils/deepWork.js';

export async function getPersonalDashboardData(userId) {
  const now = new Date();
  
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
    const st = new Date(s.startedAt);
    if (st >= startOfToday) {
      todayFocusPoints += sessionPoints;
    }
    if (st >= sevenDaysAgo) {
      weeklyFocusPoints += sessionPoints;
    }

    const longestBlockInSessionSec = stats.deepWork?.longestBlockSec || 0;
    if (longestBlockInSessionSec > personalBestDeepWorkSec) {
      personalBestDeepWorkSec = longestBlockInSessionSec;
      personalBestSessionId = s.id;
    }

    if (st >= startOfToday && longestBlockInSessionSec > todayLongestDeepWorkSec) {
      todayLongestDeepWorkSec = longestBlockInSessionSec;
    }

    if (st >= sevenDaysAgo && longestBlockInSessionSec > weeklyLongestDeepWorkSec) {
      weeklyLongestDeepWorkSec = longestBlockInSessionSec;
    }
  });

  const levelInfo = getFocusLevel(totalFocusPoints);

  // Filter Month Sessions
  const monthSessions = allUserSessions.filter(s => new Date(s.startedAt) >= startOfMonth);

  // Filter Recent Sessions
  const recentSessions = allUserSessions.slice(0, 10);

  // Filter Today Sessions
  const todaySessions = allUserSessions.filter(s => new Date(s.startedAt) >= startOfToday);

  // Filter Weekly Sessions (last 7 days)
  const weeklySessions = allUserSessions.filter(s => new Date(s.startedAt) >= sevenDaysAgo);

  // Helper to aggregate session analytics metrics
  function aggregateMetrics(sessionList) {
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

      totalStudyLikeSec += stats.durationsInSeconds.STUDY_LIKE || 0;
      totalCodingSec += stats.durationsInSeconds.CODING || 0;
      totalPhoneSec += stats.durationsInSeconds.PHONE_ACTIVITY || 0;
      totalAwaySec += stats.durationsInSeconds.AWAY_OR_NOT_VISIBLE || 0;
      totalSpeechSec += stats.durationsInSeconds.SPEECH_LIKE || 0;
      totalUnknownSec += stats.durationsInSeconds.UNKNOWN || 0;
      periodFocusPoints += stats.focusPoints || 0;

      if (stats.insights.longestStudyStreakSec > longestStreakSec) {
        longestStreakSec = stats.insights.longestStudyStreakSec;
      }
    });

    const sessionCount = sessionList.length;
    const avgDurationSec = sessionCount > 0 ? Math.round(totalActiveSec / sessionCount) : 0;
    const studyPercentage = totalActiveSec > 0 ? Math.round(((totalStudyLikeSec + totalCodingSec) / totalActiveSec) * 100) : 0;

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
      focusPoints: periodFocusPoints,
    };
  }

  // Calculate 7-day breakdown for Weekly Chart
  const weeklyDays = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const daySessions = weeklySessions.filter(s => {
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
    today: aggregateMetrics(todaySessions),
    weekly: {
      metrics: aggregateMetrics(weeklySessions),
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

