import { getLocalDateComponents, getLocalDateString } from './consistencyEngine.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Format a timestamp into localized 12-hour time string (e.g. "10:30 AM")
 * taking into account client timezone offset in minutes.
 */
export function formatLocalTime(dateInput, offsetMinutes = null) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  if (offsetMinutes !== null && offsetMinutes !== undefined) {
    const targetMs = d.getTime() - offsetMinutes * 60 * 1000;
    const targetDate = new Date(targetMs);
    let hours = targetDate.getUTCHours();
    const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours}:${minutes} ${ampm}`;
  }

  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * FocusLens Calendar Engine
 * Groups user's focus sessions and target tasks by local calendar date for a given month.
 *
 * @param {Array} sessionsList - Raw sessions from dbStore
 * @param {string} targetMonthStr - 'YYYY-MM' (e.g. '2026-09')
 * @param {Object} options
 * @param {number|null} options.offsetMinutes - Client timezone offset in minutes
 * @param {Date|string|null} options.now - Reference timestamp for default month calculation
 */
export function generateCalendarMonthData(sessionsList = [], targetMonthStr = null, options = {}) {
  const offsetMinutes = typeof options === 'number' ? options : (options?.offsetMinutes ?? null);
  const now = options?.now ? new Date(options.now) : new Date();

  // Validate or default month string
  let monthStr = targetMonthStr;
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    const nowComp = getLocalDateComponents(now, offsetMinutes);
    const monthNum = String(nowComp.month + 1).padStart(2, '0');
    monthStr = `${nowComp.year}-${monthNum}`;
  }

  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthNumStr, 10) - 1; // 0-indexed: 0 = Jan, 11 = Dec

  // Days in this month (using UTC leap-year safe date calculation)
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthName = `${MONTH_NAMES[monthIndex]} ${year}`;

  // Initialize day entries for every day of the month
  const days = [];
  const daysMap = new Map();

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dayStr = String(dayNum).padStart(2, '0');
    const dateStr = `${monthStr}-${dayStr}`;

    // Determine day of week (0=Sun, 6=Sat) in local terms
    const tempDate = new Date(Date.UTC(year, monthIndex, dayNum, 12, 0, 0));
    const dayOfWeek = tempDate.getUTCDay();

    const dayObj = {
      date: dateStr,
      dayNumber: dayNum,
      dayOfWeek,
      sessionCount: 0,
      totalDurationSec: 0,
      totalFocusPoints: 0,
      hasGoals: false,
      goalsCompletedCount: 0,
      sessions: [],
    };

    days.push(dayObj);
    daysMap.set(dateStr, dayObj);
  }

  // Monthly summary accumulators
  let totalSessions = 0;
  let totalDurationSec = 0;
  let totalFocusPoints = 0;
  let totalGoalsCompleted = 0;
  let totalTasks = 0;

  // Process sessions and populate day entries
  for (const session of sessionsList) {
    if (!session || session.status !== 'COMPLETED') continue;

    const startedAt = session.startedAt || session.createdAt;
    const dateStr = getLocalDateString(startedAt, offsetMinutes);

    if (!dateStr || !daysMap.has(dateStr)) continue;

    const dayEntry = daysMap.get(dateStr);

    const actualSec = Math.max(0, Math.round((session.actualDurationMs || 0) / 1000));
    const plannedMin = Math.max(0, Math.round((session.plannedDurationMs || 0) / 60000));
    const points = session.focusPoints || 0;
    const isGoalSession = Boolean(session.goalText || (session.goalType && session.goalType !== 'NONE'));
    const isGoalCompleted = Boolean(session.goalCompleted);

    const formattedSession = {
      id: session.id,
      activity: session.selectedActivity || 'Focus Session',
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      startTimeFormatted: formatLocalTime(session.startedAt, offsetMinutes),
      endTimeFormatted: formatLocalTime(session.endedAt, offsetMinutes),
      durationSec: actualSec,
      plannedDurationMin: plannedMin,
      focusPoints: points,
      status: session.status,
      goalText: session.goalText || null,
      goalType: session.goalType || 'NONE',
      targetValue: session.targetValue ?? null,
      targetUnit: session.targetUnit ?? null,
      goalCompleted: isGoalCompleted,
      goalProgress: session.goalProgress || 0,
      isTask: isGoalSession,
      intention: session.intention || null,
      workedWell: session.workedWell || null,
      gotInTheWay: session.gotInTheWay || null,
      notes: session.notes || null,
    };

    dayEntry.sessions.push(formattedSession);
    dayEntry.sessionCount += 1;
    dayEntry.totalDurationSec += actualSec;
    dayEntry.totalFocusPoints += points;

    if (isGoalSession) {
      dayEntry.hasGoals = true;
      totalTasks += 1;
      if (isGoalCompleted) {
        dayEntry.goalsCompletedCount += 1;
        totalGoalsCompleted += 1;
      }
    }

    totalSessions += 1;
    totalDurationSec += actualSec;
    totalFocusPoints += points;
  }

  // Count active days (days with at least 1 completed session)
  const activeDaysCount = days.filter(d => d.sessionCount > 0).length;

  return {
    month: monthStr,
    monthName,
    year,
    monthIndex,
    daysInMonth,
    days,
    monthSummary: {
      totalSessions,
      totalDurationSec,
      totalFocusPoints,
      activeDaysCount,
      totalGoalsCompleted,
      totalTasks,
    },
  };
}
