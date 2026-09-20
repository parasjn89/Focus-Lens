import { getDashboard, getFocusPoints } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

export async function dashboardRoutes(fastify, options) {
  fastify.get('/api/analytics/dashboard', { preHandler: requireAuth }, getDashboard);
  fastify.get('/api/analytics/focus-points', { preHandler: requireAuth }, getFocusPoints);
}

