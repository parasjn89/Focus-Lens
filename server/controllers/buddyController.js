import { dbStore } from '../db/store.js';

export async function listBuddies(request, reply) {
  const userId = request.user.id;
  try {
    const buddies = await dbStore.getAcceptedBuddies(userId);
    const pendingRequests = await dbStore.getPendingBuddyRequests(userId);
    return reply.send({
      buddies,
      pendingRequests,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to retrieve focus buddies.',
    });
  }
}

export async function sendBuddyRequest(request, reply) {
  const senderUserId = request.user.id;
  const { usernameOrEmail } = request.body || {};

  if (!usernameOrEmail || typeof usernameOrEmail !== 'string' || !usernameOrEmail.trim()) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Please provide a valid username or email address.',
    });
  }

  const targetUser = await dbStore.getUserByUsernameOrEmail(usernameOrEmail);
  if (!targetUser) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: 'No FocusLens user found matching that username or email.',
    });
  }

  if (targetUser.id === senderUserId) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'You cannot send a Focus Buddy request to yourself.',
    });
  }

  try {
    const reqRecord = await dbStore.sendBuddyRequest(senderUserId, targetUser.id);
    return reply.status(201).send({
      success: true,
      request: reqRecord,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name || targetUser.username,
        username: targetUser.username,
        avatarUrl: targetUser.avatarUrl || null,
      },
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: err.message || 'Failed to send buddy request.',
    });
  }
}

export async function respondToBuddyRequest(request, reply) {
  const receiverUserId = request.user.id;
  const { requestId } = request.params;
  const { action } = request.body || {};

  if (!['ACCEPT', 'DECLINE'].includes(action)) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Action must be either "ACCEPT" or "DECLINE".',
    });
  }

  try {
    const updated = await dbStore.respondToBuddyRequest(requestId, receiverUserId, action);
    return reply.send({
      success: true,
      status: updated.status,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return reply.status(status).send({
      statusCode: status,
      error: err.name || 'Error',
      message: err.message || 'Failed to respond to buddy request.',
    });
  }
}

export async function removeBuddy(request, reply) {
  const userId = request.user.id;
  const { buddyUserId } = request.params;

  try {
    await dbStore.removeBuddy(userId, buddyUserId);
    return reply.send({
      success: true,
      message: 'Focus Buddy removed successfully.',
    });
  } catch (err) {
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to remove focus buddy.',
    });
  }
}
