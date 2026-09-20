import { getPersonalDashboardData } from '../utils/dashboardAnalytics.js';

// Handler: GET /api/analytics/dashboard
export async function getDashboard(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required to view dashboard.',
    });
  }

  try {
    const offsetHeader = request.headers['x-timezone-offset'];
    const offsetMinutes = offsetHeader ? parseInt(offsetHeader, 10) : null;
    const category = request.query?.category || null;

    const data = await getPersonalDashboardData(request.user.id, {
      timezoneOffsetMinutes: isNaN(offsetMinutes) ? null : offsetMinutes,
      category,
    });
    return reply.send({
      user: request.user,
      dashboard: data,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to calculate personal dashboard analytics.',
    });
  }
}

// Handler: GET /api/analytics/focus-points
export async function getFocusPoints(request, reply) {
  if (!request.user || !request.user.id) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required to view focus points.',
    });
  }

  try {
    const offsetHeader = request.headers['x-timezone-offset'];
    const offsetMinutes = offsetHeader ? parseInt(offsetHeader, 10) : null;

    const data = await getPersonalDashboardData(request.user.id, {
      timezoneOffsetMinutes: isNaN(offsetMinutes) ? null : offsetMinutes,
    });
    return reply.send(data.focusPoints);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to calculate Focus Points analytics.',
    });
  }
}

