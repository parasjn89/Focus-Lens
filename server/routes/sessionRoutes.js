import {
  createSession,
  listSessions,
  getSessionById,
  saveSegments,
  updateSession,
  deleteSession,
} from '../controllers/sessionController.js';
import { requireAuth } from '../middleware/auth.js';

export async function sessionRoutes(fastify, options) {
  fastify.post('/api/sessions', { preHandler: requireAuth }, createSession);
  fastify.get('/api/sessions', { preHandler: requireAuth }, listSessions);
  fastify.get('/api/sessions/:id', { preHandler: requireAuth }, getSessionById);
  fastify.post('/api/sessions/:id/segments', { preHandler: requireAuth }, saveSegments);
  fastify.put('/api/sessions/:id', { preHandler: requireAuth }, updateSession);
  fastify.delete('/api/sessions/:id', { preHandler: requireAuth }, deleteSession);
}
