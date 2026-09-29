import EventEmitter from 'events';
import { dbStore } from '../db/store.js';

class RealtimeMessageService extends EventEmitter {
  constructor() {
    super();
    // userId -> Set<http.ServerResponse>
    this.connections = new Map();
    this.heartbeatInterval = null;
    this.presenceSweepInterval = null;
    this.startHeartbeat();
    this.startPresenceSweep();
  }

  startPresenceSweep() {
    if (this.presenceSweepInterval) return;
    this.presenceSweepInterval = setInterval(async () => {
      try {
        const expired = await dbStore.getExpiredActivePresences();
        for (const p of expired) {
          await dbStore.clearPresence(p.userId);
          await this.broadcastPresenceToBuddies({
            userId: p.userId,
            eventType: 'focus.presence.expired',
            presence: { status: 'IDLE' },
          });
        }
      } catch (e) {
        // Non-blocking background sweep
      }
    }, 20000);
    if (this.presenceSweepInterval.unref) {
      this.presenceSweepInterval.unref();
    }
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
   * Broadcasts focus presence event strictly to the user and their accepted Focus Buddies.
   * @param {Object} params
   * @param {string} params.userId - Authenticated user UUID whose presence changed
   * @param {string} params.eventType - Event type: focus.presence.started | focus.presence.paused | focus.presence.resumed | focus.presence.completed | focus.presence.cancelled | focus.presence.expired
   * @param {Object} params.presence - Sanitized presence payload ({ userId, status, startedAt, endsAt })
   */
  async broadcastPresenceToBuddies({ userId, eventType, presence }) {
    if (!userId || !eventType) return;

    // Check user's privacy settings
    let shareFocusStatus = true;
    try {
      const settings = await dbStore.getUserSettings(userId);
      if (settings && settings.shareFocusStatus === false) {
        shareFocusStatus = false;
      }
    } catch (e) {}

    // Find accepted buddies
    let acceptedBuddies = [];
    try {
      acceptedBuddies = await dbStore.getAcceptedBuddies(userId);
    } catch (e) {}

    const buddyIds = acceptedBuddies.map(b => b.userId);

    // High-level sanitized presence payload
    const safePayload = {
      type: eventType,
      userId,
      status: presence?.status || 'IDLE',
      startedAt: presence?.startedAt ? (presence.startedAt instanceof Date ? presence.startedAt.toISOString() : presence.startedAt) : null,
      endsAt: presence?.endsAt ? (presence.endsAt instanceof Date ? presence.endsAt.toISOString() : presence.endsAt) : null,
    };

    const sseChunk = `event: ${eventType}\ndata: ${JSON.stringify(safePayload)}\n\n`;

    // 1. Send to user's own connected streams so all their tabs are updated
    const selfStreams = this.connections.get(userId);
    if (selfStreams) {
      for (const res of Array.from(selfStreams)) {
        try {
          if (!res.writableEnded && !res.destroyed) {
            res.write(sseChunk);
          }
        } catch (err) {
          this.unregisterConnection(userId, res);
        }
      }
    }

    // 2. Send to accepted buddies ONLY if user allows sharing (or if clearing presence)
    if (shareFocusStatus || eventType === 'focus.presence.expired' || safePayload.status === 'IDLE') {
      const buddyPayload = !shareFocusStatus
        ? { type: 'focus.presence.expired', userId, status: 'IDLE', startedAt: null, endsAt: null }
        : safePayload;
      const buddyChunk = `event: ${eventType}\ndata: ${JSON.stringify(buddyPayload)}\n\n`;

      for (const buddyId of buddyIds) {
        const buddyStreams = this.connections.get(buddyId);
        if (buddyStreams) {
          for (const res of Array.from(buddyStreams)) {
            try {
              if (!res.writableEnded && !res.destroyed) {
                res.write(buddyChunk);
              }
            } catch (err) {
              this.unregisterConnection(buddyId, res);
            }
          }
        }
      }
    }

    // Emit internally for tests and listeners
    this.emit(eventType, safePayload);
    this.emit('focus.presence', safePayload);
  }

  /**
   * Closes all active connections (for server shutdown / test tear-down).
   */
  closeAll() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.presenceSweepInterval) {
      clearInterval(this.presenceSweepInterval);
      this.presenceSweepInterval = null;
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
