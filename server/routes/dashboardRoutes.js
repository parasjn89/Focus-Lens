import { getDashboard } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

export async function dashboardRoutes(fastify, options) {
  fastify.get('/api/analytics/dashboard', { preHandler: requireAuth }, getDashboard);
}
