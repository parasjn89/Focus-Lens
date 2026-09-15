import { calculateSessionAnalytics } from './analytics.js';

/**
 * Extract target local date components from any date/timestamp input
 * given an optional timezone offset in minutes (e.g. -330 for UTC+5:30)
 */
export function getLocalDateComponents(dateInput, offsetMinutes = null) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  if (offsetMinutes !== null && offsetMinutes !== undefined) {
    const targetMs = d.getTime() - offsetMinutes * 60 * 1000;
    const targetDate = new Date(targetMs);
    const isoString = targetDate.toISOString().split('T')[0];
    const parts = isoString.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10) - 1, // 0-indexed
      date: parseInt(parts[2], 10),
      dayOfWeek: targetDate.getUTCDay(), // 0 (Sun) - 6 (Sat)
      isoString,
    };
  }

  const year = d.getFullYear();
  const month = d.getMonth();
  const date = d.getDate();
  const dayOfWeek = d.getDay();
  const monthStr = String(month + 1).padStart(2, '0');
  const dateStr = String(date).padStart(2, '0');
  return {
    year,
    month,
    date,
    dayOfWeek,
    isoString: `${year}-${monthStr}-${dateStr}`,
  };
}

/**
 * Format a Date or timestamp to local date string YYYY-MM-DD
 */
export function getLocalDateString(dateInput, offsetMinutes = null) {
  const comp = getLocalDateComponents(dateInput, offsetMinutes);
  return comp ? comp.isoString : null;
}

/**
 * Focus Streaks & Consistency Engine
 */
export function generateConsistencyAnalysis(sessionsList = [], sessionSegmentMap = new Map(), options = {}) {
  const offsetMinutes = typeof options === 'number' ? options : (options?.timezoneOffsetMinutes ?? null);
  const now = options?.now ? new Date(options.now) : new Date();

  const nowComp = getLocalDateComponents(now, offsetMinutes);
  const todayStr = nowComp.isoString;

  const yesterdayComp = getLocalDateComponents(now.getTime() - 86400000, offsetMinutes);
  const yesterdayStr = yesterdayComp.isoString;

  // 1. Group qualifying completed sessions by local date string
  const dailyMap = new Map();

  sessionsList.forEach((s) => {
    if (!s || s.status !== 'COMPLETED') return;

    const segments = sessionSegmentMap.get(s.id) || [];
    const stats = calculateSessionAnalytics(s, segments);
    const qualifyingSecs = stats.qualifyingSeconds || 0;

    // Requirement 2: A streak day requires session.status === COMPLETED AND qualifying focus time > 0
    if (qualifyingSecs <= 0) return;

    const dateStr = getLocalDateString(s.startedAt || s.createdAt, offsetMinutes);
    if (!dateStr) return;

    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        focused: true,
        sessionCount: 0,
        qualifyingFocusSeconds: 0,
        focusPoints: 0,
      });
    }

    const dayEntry = dailyMap.get(dateStr);
    dayEntry.sessionCount += 1;
    dayEntry.qualifyingFocusSeconds += qualifyingSecs;
    dayEntry.focusPoints += stats.focusPoints || 0;
  });

  // Sort qualifying focus date strings in ascending order (chronological)
  const qualifyingDates = Array.from(dailyMap.keys()).sort();

  // 2. Calculate Streaks (Current & Best)
  let bestStreak = 0;
  let currentStreak = 0;
  let previousStreak = 0;

  if (qualifyingDates.length > 0) {
    let tempRun = 1;
    bestStreak = 1;

    for (let i = 1; i < qualifyingDates.length; i++) {
      const prevDate = new Date(qualifyingDates[i - 1]);
      const currDate = new Date(qualifyingDates[i]);
      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        tempRun += 1;
      } else if (diffDays > 1) {
        tempRun = 1;
      }

      if (tempRun > bestStreak) {
        bestStreak = tempRun;
      }
    }

    // Current Streak calculation ending at today or yesterday
    const lastQualifyingDateStr = qualifyingDates[qualifyingDates.length - 1];

    if (lastQualifyingDateStr === todayStr || lastQualifyingDateStr === yesterdayStr) {
      currentStreak = 1;
      let currIdx = qualifyingDates.length - 1;

      while (currIdx > 0) {
        const currDate = new Date(qualifyingDates[currIdx]);
        const prevDate = new Date(qualifyingDates[currIdx - 1]);
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          currentStreak += 1;
          currIdx--;
        } else {
          break;
        }
      }
    } else {
      // Streak broken prior to yesterday
      currentStreak = 0;
      previousStreak = tempRun;
    }
  }

  const todayFocused = dailyMap.has(todayStr);

  // 3. Weekly Consistency (Monday -> Sunday)
  const dayOfWeek = nowComp.dayOfWeek; // 0 (Sun) - 6 (Sat)
  const distToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekEligibleDays = distToMon + 1; // 1 to 7

  let thisWeekFocusDays = 0;
  for (let i = 0; i < 7; i++) {
    const dayOffset = i - distToMon;
    const dayComp = getLocalDateComponents(now.getTime() + dayOffset * 86400000, offsetMinutes);
    const dStr = dayComp.isoString;

    if (dStr > todayStr) continue; // Future days ignored

    if (dailyMap.has(dStr)) {
      thisWeekFocusDays++;
    }
  }

  const thisWeekPercentage = thisWeekEligibleDays > 0 ? Math.round((thisWeekFocusDays / thisWeekEligibleDays) * 100) : 0;

  // 4. Monthly Consistency (Current Month)
  const thisMonthEligibleDays = nowComp.date;
  let thisMonthFocusDays = 0;

  for (let i = 1; i <= nowComp.date; i++) {
    const mStr = String(nowComp.month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    const targetDateStr = `${nowComp.year}-${mStr}-${dStr}`;

    if (dailyMap.has(targetDateStr)) {
      thisMonthFocusDays++;
    }
  }

  const thisMonthPercentage = thisMonthEligibleDays > 0 ? Math.round((thisMonthFocusDays / thisMonthEligibleDays) * 100) : 0;

  // 5. Calendar Heatmap (Days in current month)
  const calendarDays = [];
  const daysInMonth = new Date(Date.UTC(nowComp.year, nowComp.month + 1, 0)).getUTCDate();

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 1; i <= daysInMonth; i++) {
    const mStr = String(nowComp.month + 1).padStart(2, '0');
    const dStr = String(i).padStart(2, '0');
    const targetDateStr = `${nowComp.year}-${mStr}-${dStr}`;

    const tempDate = new Date(Date.UTC(nowComp.year, nowComp.month, i));
    const dayName = weekdayNames[tempDate.getUTCDay()];

    const isFuture = targetDateStr > todayStr;
    const dayData = dailyMap.get(targetDateStr);

    calendarDays.push({
      date: targetDateStr,
      dayNumber: i,
      dayName,
      focused: Boolean(dayData?.focused),
      isFuture,
      isToday: targetDateStr === todayStr,
      sessionCount: dayData?.sessionCount || 0,
      qualifyingFocusSeconds: dayData?.qualifyingFocusSeconds || 0,
      focusPoints: dayData?.focusPoints || 0,
    });
  }

  // 6. Milestones
  const milestones = [3, 7, 14, 30, 60, 100];
  const activeMilestone = milestones.filter((m) => currentStreak >= m).pop() || null;

  return {
    currentStreak,
    bestStreak,
    previousStreak,
    todayFocused,
    todayDate: todayStr,
    thisWeek: {
      focusDays: thisWeekFocusDays,
      eligibleDays: thisWeekEligibleDays,
      percentage: thisWeekPercentage,
    },
    thisMonth: {
      focusDays: thisMonthFocusDays,
      eligibleDays: thisMonthEligibleDays,
      percentage: thisMonthPercentage,
    },
    milestones: {
      active: activeMilestone,
      label: activeMilestone ? `${activeMilestone}-day streak reached!` : null,
    },
    recentMilestone: activeMilestone ? {
      days: activeMilestone,
      message: `${activeMilestone}-day streak reached!`,
    } : null,
    calendar: calendarDays,
  };
}

export const calculateConsistencyMetrics = generateConsistencyAnalysis;
