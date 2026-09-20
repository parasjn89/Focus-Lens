import { dbStore } from '../db/store.js';

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
