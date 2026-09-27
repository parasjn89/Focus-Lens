import { dbStore } from '../db/store.js';
import { realtimeMessageService } from '../services/realtimeMessageService.js';

export async function listConversations(request, reply) {
  const userId = request.user.id;
  try {
    const conversations = await dbStore.getConversationsForUser(userId);
    return reply.send({ conversations });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to retrieve conversations.',
    });
  }
}

export async function getConversation(request, reply) {
  const userId = request.user.id;
  const { conversationId } = request.params;

  try {
    const conv = await dbStore.getConversationById(conversationId, userId);
    if (!conv) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Conversation not found.',
      });
    }

    const messages = await dbStore.getMessagesForConversation(conversationId, userId);
    return reply.send({
      conversation: conv,
      messages,
      buddy: conv.buddy,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: err.message || 'Failed to retrieve conversation.',
    });
  }
}

export async function sendMessage(request, reply) {
  const senderUserId = request.user.id;
  const { conversationId } = request.params;
  const { content, messageType = 'TEXT', activityMetadata = {} } = request.body || {};

  if (!content || typeof content !== 'string' || !content.trim()) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Message content cannot be blank.',
    });
  }

  const trimmed = content.trim();
  if (trimmed.length > 1000) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Message exceeds maximum length of 1000 characters.',
    });
  }

  try {
    const message = await dbStore.createMessage({
      conversationId,
      senderUserId,
      content: trimmed,
      messageType,
      activityMetadata,
    });

    try {
      const conv = await dbStore.getConversationById(conversationId, senderUserId);
      if (conv) {
        realtimeMessageService.broadcastMessageCreated({
          conversationId,
          message,
          participantUserIds: [conv.user1Id, conv.user2Id],
        });
      }
    } catch (broadcastErr) {
      request.log?.warn?.(`[Realtime] Failed to broadcast message: ${broadcastErr.message}`);
    }

    return reply.status(201).send({
      success: true,
      message,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: err.message || 'Failed to send message.',
    });
  }
}

export async function markConversationRead(request, reply) {
  const userId = request.user.id;
  const { conversationId } = request.params;

  try {
    await dbStore.markConversationAsRead(conversationId, userId);
    return reply.send({ success: true });
  } catch (err) {
    const status = err.statusCode || 500;
    return reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: err.message || 'Failed to mark conversation as read.',
    });
  }
}

export async function getUnreadCount(request, reply) {
  const userId = request.user.id;
  try {
    const count = await dbStore.getUnreadMessagesCount(userId);
    return reply.send({ unreadCount: count });
  } catch (err) {
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to retrieve unread message count.',
    });
  }
}

export async function startConversationWithBuddy(request, reply) {
  const userId = request.user.id;
  const { buddyUserId } = request.body || {};

  if (!buddyUserId) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'buddyUserId is required.',
    });
  }

  try {
    const relationship = await dbStore.getBuddyRelationship(userId, buddyUserId);
    if (!relationship || relationship.status !== 'ACCEPTED') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'You can only message accepted Focus Buddies.',
      });
    }

    const conversation = await dbStore.getOrCreateConversation(userId, buddyUserId);
    return reply.send({
      success: true,
      conversation,
    });
  } catch (err) {
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to start conversation.',
    });
  }
}

/**
 * Server-Sent Events (SSE) streaming endpoint for real-time messaging updates.
 * Handled via GET /api/messages/events with requireAuth preHandler.
 */
export async function streamMessageEvents(request, reply) {
  const userId = request.user.id;

  // Set SSE response headers
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');

  const origin = request.headers.origin;
  if (origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (typeof reply.raw.flushHeaders === 'function') {
    reply.raw.flushHeaders();
  }

  // Initial connection acknowledgement
  reply.raw.write(': connected\n\n');

  realtimeMessageService.registerConnection(userId, reply.raw);

  // In serverless environments (e.g. Vercel with 15-60s limit), gracefully end before timeout
  const isServerless = Boolean(process.env.VERCEL);
  let serverlessTimer = null;
  if (isServerless) {
    serverlessTimer = setTimeout(() => {
      try {
        if (!reply.raw.writableEnded && !reply.raw.destroyed) {
          reply.raw.write(': reconnect\n\n');
          reply.raw.end();
        }
      } catch (_) {}
    }, 45000);
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      if (serverlessTimer) clearTimeout(serverlessTimer);
      realtimeMessageService.unregisterConnection(userId, reply.raw);
      resolve();
    };

    request.raw.on('close', cleanup);
    request.raw.on('error', cleanup);
  });
}

