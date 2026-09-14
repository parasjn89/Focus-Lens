import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from './analytics.js';

export async function getPersonalDashboardData(userId) {
  const now = new Date();
  
  // Start of today (00:00:00.000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Start of last 7 days
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);

  // Start of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // Fetch all user's sessions from the start of the month onwards
  const monthSessions = await dbStore.getSessionsByUserId(userId, {
    limit: 500,
    from: startOfMonth.toISOString(),
  });

  // Also fetch all user's recent sessions for history list
  const recentSessions = await dbStore.getSessionsByUserId(userId, {
    limit: 10,
  });

  // Pre-load segments for each session
  const sessionSegmentMap = new Map();
  const sessionIds = Array.from(new Set([...monthSessions.map(s => s.id), ...recentSessions.map(s => s.id)]));

  for (const sId of sessionIds) {
    const segs = await dbStore.getSegmentsBySessionId(sId);
    sessionSegmentMap.set(sId, segs);
  }

  // Filter Today Sessions
  const todaySessions = monthSessions.filter(s => new Date(s.startedAt) >= startOfToday);

  // Filter Weekly Sessions (last 7 days)
  const weeklySessions = monthSessions.filter(s => new Date(s.startedAt) >= sevenDaysAgo);

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
    });
  }

  return {
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
        percentages: stats.percentages,
        durationsInSeconds: stats.durationsInSeconds,
      };
    }),
  };
}
