import {
  listBuddies,
  sendBuddyRequest,
  respondToBuddyRequest,
  removeBuddy,
} from '../controllers/buddyController.js';
import { requireAuth } from '../middleware/auth.js';

export async function buddyRoutes(fastify, options) {
  fastify.get('/api/buddies', { preHandler: requireAuth }, listBuddies);
  fastify.post('/api/buddies/request', { preHandler: requireAuth }, sendBuddyRequest);
  fastify.patch('/api/buddies/requests/:requestId', { preHandler: requireAuth }, respondToBuddyRequest);
  fastify.delete('/api/buddies/:buddyUserId', { preHandler: requireAuth }, removeBuddy);
}
