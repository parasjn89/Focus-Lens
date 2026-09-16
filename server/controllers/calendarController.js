import { dbStore } from '../db/store.js';
import { generateCalendarMonthData } from '../utils/calendarEngine.js';
import { getLocalDateComponents } from '../utils/consistencyEngine.js';

/**
 * Helper to resolve user ID strictly from authenticated server-side session context.
 * NEVER trusts client-supplied user IDs or shared anonymous fallbacks.
 */
function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  const err = new Error('Authentication required. Please log in.');
  err.statusCode = 401;
  throw err;
}

/**
 * Handler: GET /api/calendar
 * Returns structured monthly calendar metrics and daily session breakdown for the authenticated user.
 */
export async function getCalendarMonth(request, reply) {
  try {
    const userId = resolveUserId(request);

    // Parse client timezone offset in minutes from header (e.g., -330 for UTC+5:30)
    let offsetMinutes = null;
    const offsetHeader = request.headers['x-timezone-offset'];
    if (offsetHeader !== undefined && offsetHeader !== null && offsetHeader !== '') {
      const parsed = parseInt(offsetHeader, 10);
      if (!isNaN(parsed)) {
        offsetMinutes = parsed;
      }
    }

    // Determine target month string ('YYYY-MM')
    let monthStr = request.query.month;
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
      const nowComp = getLocalDateComponents(new Date(), offsetMinutes);
      const monthNum = String(nowComp.month + 1).padStart(2, '0');
      monthStr = `${nowComp.year}-${monthNum}`;
    }

    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1;

    // Buffer range: 2 days before 1st of month to 2 days after end of month to absorb any timezone variance
    const fromDate = new Date(Date.UTC(year, monthIndex, 1 - 2, 0, 0, 0));
    const toDate = new Date(Date.UTC(year, monthIndex + 1, 2, 23, 59, 59));

    // Fetch user's sessions within the buffered range
    const sessionsList = await dbStore.getSessionsByUserId(userId, {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      limit: 1000,
    });

    // Generate structured calendar breakdown
    const calendarData = generateCalendarMonthData(sessionsList, monthStr, {
      offsetMinutes,
      now: new Date(),
    });

    return reply.send(calendarData);
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      message: err.message || 'Failed to retrieve calendar data.',
    });
  }
}
