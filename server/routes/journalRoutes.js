import { updateSessionJournal, getJournalEntries } from '../controllers/journalController.js';
import { requireAuth } from '../middleware/auth.js';

export async function journalRoutes(fastify, options) {
  fastify.get('/api/journal', { preHandler: [requireAuth] }, getJournalEntries);
  fastify.patch('/api/sessions/:sessionId/journal', { preHandler: [requireAuth] }, updateSessionJournal);
}
