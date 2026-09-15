import { getWeeklyReview, saveWeeklyReviewNotes } from '../controllers/weeklyReviewController.js';
import { requireAuth } from '../middleware/auth.js';

export async function weeklyReviewRoutes(fastify, options) {
  fastify.get('/api/weekly-review', { preHandler: [requireAuth] }, getWeeklyReview);
  fastify.put('/api/weekly-review/notes', { preHandler: [requireAuth] }, saveWeeklyReviewNotes);
}
