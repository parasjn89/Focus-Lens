import EventEmitter from 'events';

class RealtimeMessageService extends EventEmitter {
  constructor() {
    super();
    // userId -> Set<http.ServerResponse>
    this.connections = new Map();
    this.heartbeatInterval = null;
    this.startHeartbeat();
  }

  startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15000);
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  sendHeartbeat() {
    for (const [userId, streamSet] of this.connections.entries()) {
      for (const res of streamSet) {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(': ping\n\n');
          }
        } catch (err) {
          this.unregisterConnection(userId, res);
        }
      }
    }
  }

  /**
   * Registers an active SSE client stream for an authenticated user.
   * @param {string} userId - Authenticated user UUID
   * @param {import('http').ServerResponse} res - Fastify raw ServerResponse
   */
  registerConnection(userId, res) {
    if (!userId || !res) return;

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(res);

    const cleanup = () => {
      this.unregisterConnection(userId, res);
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
  }

  /**
   * Unregisters an SSE client stream.
   * @param {string} userId
   * @param {import('http').ServerResponse} res
   */
  unregisterConnection(userId, res) {
    if (!userId || !res) return;

    const streamSet = this.connections.get(userId);
    if (streamSet) {
      streamSet.delete(res);
      if (streamSet.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  /**
   * Returns count of active connections for a user.
   * @param {string} userId
   * @returns {number}
   */
  getConnectionCount(userId) {
    return this.connections.get(userId)?.size || 0;
  }

  /**
   * Returns total count of all active SSE connections across all users.
   * @returns {number}
   */
  getTotalConnectionCount() {
    let total = 0;
    for (const set of this.connections.values()) {
      total += set.size;
    }
    return total;
  }

  /**
   * Broadcasts a newly created message strictly to the conversation's authorized participants.
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {Object} params.message - Canonical database message record
   * @param {string[]} params.participantUserIds - Exactly [user1Id, user2Id]
   */
  broadcastMessageCreated({ conversationId, message, participantUserIds }) {
    if (!conversationId || !message || !Array.isArray(participantUserIds)) {
      return;
    }

    const safeMessage = {
      id: message.id,
      conversationId,
      senderUserId: message.senderUserId,
      senderId: message.senderUserId, // compatibility alias
      content: message.content,
      messageType: message.messageType || 'TEXT',
      activityMetadata: message.activityMetadata || {},
      readAt: message.readAt || null,
      createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    };

    const payload = JSON.stringify({
      conversationId,
      message: safeMessage,
    });

    const sseChunk = `event: message.created\ndata: ${payload}\n\n`;

    // Strict IDOR protection: send ONLY to verified participants
    for (const userId of participantUserIds) {
      const streamSet = this.connections.get(userId);
      if (streamSet) {
        for (const res of Array.from(streamSet)) {
          try {
            if (!res.writableEnded && !res.destroyed) {
              res.write(sseChunk);
            }
          } catch (err) {
            this.unregisterConnection(userId, res);
          }
        }
      }
    }

    // Also emit internally for server tests or telemetry
    this.emit('message.created', { conversationId, message: safeMessage, participantUserIds });
  }

  /**
   * Closes all active connections (for server shutdown / test tear-down).
   */
  closeAll() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const [userId, streamSet] of this.connections.entries()) {
      for (const res of streamSet) {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.end();
          }
        } catch (_) {}
      }
    }
    this.connections.clear();
  }
}

export const realtimeMessageService = new RealtimeMessageService();
