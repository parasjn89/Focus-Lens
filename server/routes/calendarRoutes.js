import { getCalendarMonth } from '../controllers/calendarController.js';
import { requireAuth } from '../middleware/auth.js';

export async function calendarRoutes(fastify, options) {
  fastify.get('/api/calendar', { preHandler: requireAuth }, getCalendarMonth);
}
