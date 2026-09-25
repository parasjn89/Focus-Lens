import { getSettings, updateSettings, resetSettings } from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/auth.js';

export async function settingsRoutes(fastify, options) {
  fastify.get('/api/settings', { preHandler: requireAuth }, getSettings);
  fastify.patch('/api/settings', { preHandler: requireAuth }, updateSettings);
  fastify.put('/api/settings', { preHandler: requireAuth }, updateSettings);
  fastify.post('/api/settings/reset', { preHandler: requireAuth }, resetSettings);
}
