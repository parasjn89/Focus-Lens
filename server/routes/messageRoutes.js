import {
  listConversations,
  getConversation,
  sendMessage,
  markConversationRead,
  getUnreadCount,
  startConversationWithBuddy,
} from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';

export async function messageRoutes(fastify, options) {
  fastify.get('/api/messages/conversations', { preHandler: requireAuth }, listConversations);
  fastify.get('/api/messages/conversations/:conversationId', { preHandler: requireAuth }, getConversation);
  fastify.post('/api/messages/conversations/:conversationId', { preHandler: requireAuth }, sendMessage);
  fastify.patch('/api/messages/conversations/:conversationId/read', { preHandler: requireAuth }, markConversationRead);
  fastify.get('/api/messages/unread-count', { preHandler: requireAuth }, getUnreadCount);
  fastify.post('/api/messages/start-with-buddy', { preHandler: requireAuth }, startConversationWithBuddy);
}
