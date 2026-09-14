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
    const data = await getPersonalDashboardData(request.user.id);
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
