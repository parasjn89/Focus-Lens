import { eq, desc, gte, lte, and, or, isNull } from 'drizzle-orm';
import { db, checkDbConnection } from './client.js';
import { users, sessions, activitySegments, passwordResets, weeklyReviewNotes, googleCalendarConnections, tasks, focusBuddies, conversations, messages } from './schema.js';
import crypto from 'crypto';

// In-Memory Fallback Stores (used if PostgreSQL service is offline)
const memoryUsers = new Map();
const memorySessions = new Map();
const memorySegments = [];
const memoryPasswordResets = new Map();
const memoryWeeklyNotes = new Map();
const memoryGoogleCalendarConnections = new Map();
const memoryTasks = new Map();
const memoryBuddies = new Map();
const memoryConversations = new Map();
const memoryMessages = new Map();

export const dbStore = {
  // USER OPERATIONS
  async getUserByEmail(email) {
    if (!email) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      return rows[0] || null;
    }
    // Memory fallback
    for (const u of memoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === email.toLowerCase().trim()) {
        return u;
      }
    }
    return null;
  },

  async getUserByUsername(username) {
    if (!username) return null;
    const normalizedUsername = username.toLowerCase().trim();
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.username, normalizedUsername)).limit(1);
      return rows[0] || null;
    }
    for (const u of memoryUsers.values()) {
      if (u.username && u.username.toLowerCase() === normalizedUsername) {
        return u;
      }
    }
    return null;
  },

  async getUserById(id) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] || null;
    }
    return memoryUsers.get(id) || null;
  },

  async getUserByAnonymousId(anonId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.anonymousId, anonId)).limit(1);
      return rows[0] || null;
    }
    for (const u of memoryUsers.values()) {
      if (u.anonymousId === anonId) return u;
    }
    return null;
  },

  async getUserByPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
      return rows[0] || null;
    }
    for (const u of memoryUsers.values()) {
      if (u.phoneNumber === phoneNumber) return u;
    }
    return null;
  },

  async getUserByGoogleId(googleId) {
    if (!googleId) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
      return rows[0] || null;
    }
    for (const u of memoryUsers.values()) {
      if (u.googleId === googleId) return u;
    }
    return null;
  },

  async linkGoogleAccount(userId, { googleId, avatarUrl } = {}) {
    const isConnected = await checkDbConnection();
    const updates = {
      updatedAt: new Date(),
      verificationStatus: 'VERIFIED',
      emailVerifiedAt: new Date(),
    };
    if (googleId) updates.googleId = googleId;
    if (avatarUrl) updates.avatarUrl = avatarUrl;

    if (isConnected) {
      const [updated] = await db.update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning();
      return updated || null;
    }

    const user = memoryUsers.get(userId);
    if (!user) return null;
    const updated = { ...user, ...updates };
    memoryUsers.set(userId, updated);
    return updated;
  },

  async createUser({ username, email, name, passwordHash, googleId, anonymousId, phoneNumber, preferredVerificationMethod, verificationStatus, emailVerifiedAt, avatarUrl, avatarPublicId }) {
    const isConnected = await checkDbConnection();
    const values = {
      username: username ? username.toLowerCase().trim() : null,
      email: email ? email.toLowerCase().trim() : null,
      name: name || null,
      passwordHash: passwordHash || null,
      googleId: googleId || null,
      anonymousId: anonymousId || null,
      phoneNumber: phoneNumber || null,
      preferredVerificationMethod: preferredVerificationMethod || 'EMAIL',
      verificationStatus: verificationStatus || 'UNVERIFIED',
      avatarUrl: avatarUrl || null,
      avatarPublicId: avatarPublicId || null,
      emailVerifiedAt: emailVerifiedAt || null,
    };

    if (isConnected) {
      const [newUser] = await db.insert(users).values(values).returning();
      return newUser;
    }

    if (!isConnected) {
      for (const u of memoryUsers.values()) {
        if (values.username && u.username && u.username.toLowerCase() === values.username.toLowerCase()) {
          const err = new Error('duplicate key value violates unique constraint "users_username_unique"');
          err.code = '23505';
          throw err;
        }
        if (values.email && u.email && u.email.toLowerCase() === values.email.toLowerCase()) {
          const err = new Error('duplicate key value violates unique constraint "users_email_unique"');
          err.code = '23505';
          throw err;
        }
        if (values.phoneNumber && u.phoneNumber && u.phoneNumber === values.phoneNumber) {
          const err = new Error('duplicate key value violates unique constraint "users_phone_number_unique"');
          err.code = '23505';
          throw err;
        }
      }
    }

    const newUser = {
      id: crypto.randomUUID(),
      ...values,
      emailVerifiedAt: values.emailVerifiedAt || null,
      phoneVerifiedAt: null,
      verificationTokenHash: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      verificationResendAvailableAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryUsers.set(newUser.id, newUser);
    return newUser;
  },

  async updateUserProfile(userId, { name, username }) {
    const isConnected = await checkDbConnection();
    const updates = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (username !== undefined) updates.username = username ? username.toLowerCase().trim() : null;

    if (isConnected) {
      const [updated] = await db.update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      if (username !== undefined) {
        const norm = username ? username.toLowerCase().trim() : null;
        for (const other of memoryUsers.values()) {
          if (other.id !== userId && other.username && other.username.toLowerCase() === norm) {
            const err = new Error('duplicate key value violates unique constraint "users_username_unique"');
            err.code = '23505';
            throw err;
          }
        }
        u.username = norm;
      }
      if (name !== undefined) u.name = name;
      u.updatedAt = new Date();
      return u;
    }
    return null;
  },

  async updateUserContact(userId, { email, phoneNumber, emailVerifiedAt, phoneVerifiedAt, verificationStatus }) {
    const isConnected = await checkDbConnection();
    const updates = { updatedAt: new Date() };
    if (email !== undefined) updates.email = email ? email.toLowerCase().trim() : null;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber || null;
    if (emailVerifiedAt !== undefined) updates.emailVerifiedAt = emailVerifiedAt;
    if (phoneVerifiedAt !== undefined) updates.phoneVerifiedAt = phoneVerifiedAt;
    if (verificationStatus !== undefined) updates.verificationStatus = verificationStatus;

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async updateUserAvatar(userId, { avatarUrl, avatarPublicId }) {
    const isConnected = await checkDbConnection();
    const updates = {
      avatarUrl: avatarUrl !== undefined ? avatarUrl : null,
      avatarPublicId: avatarPublicId !== undefined ? avatarPublicId : null,
      updatedAt: new Date(),
    };

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async updateUserPassword(userId, passwordHash) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const [updated] = await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      u.passwordHash = passwordHash;
      u.updatedAt = new Date();
      return u;
    }
    return null;
  },

  async setVerificationChallenge(userId, { tokenHash, expiresAt, resendAvailableAt }) {
    const isConnected = await checkDbConnection();
    const updates = {
      verificationTokenHash: tokenHash,
      verificationExpiresAt: expiresAt,
      verificationResendAvailableAt: resendAvailableAt,
      verificationAttempts: 0,
      updatedAt: new Date(),
    };

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async incrementVerificationAttempts(userId) {
    const user = await this.getUserById(userId);
    if (!user) return 0;
    const nextAttempts = (user.verificationAttempts || 0) + 1;
    const isConnected = await checkDbConnection();

    if (isConnected) {
      await db.update(users).set({ verificationAttempts: nextAttempts, updatedAt: new Date() }).where(eq(users.id, userId));
    } else {
      user.verificationAttempts = nextAttempts;
    }
    return nextAttempts;
  },

  async verifyUserEmail(userId) {
    const isConnected = await checkDbConnection();
    const updates = {
      verificationStatus: 'VERIFIED',
      emailVerifiedAt: new Date(),
      verificationTokenHash: null,
      verificationExpiresAt: null,
      verificationResendAvailableAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    };

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async verifyUserPhone(userId, phoneNumber) {
    const isConnected = await checkDbConnection();
    const updates = {
      verificationStatus: 'VERIFIED',
      phoneVerifiedAt: new Date(),
      phoneNumber: phoneNumber || undefined,
      verificationTokenHash: null,
      verificationExpiresAt: null,
      verificationResendAvailableAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    };

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async switchVerificationMethod(userId, { preferredVerificationMethod, phoneNumber, email, tokenHash, expiresAt, resendAvailableAt }) {
    const isConnected = await checkDbConnection();
    const updates = {
      preferredVerificationMethod,
      phoneNumber: phoneNumber || undefined,
      email: email || undefined,
      verificationTokenHash: tokenHash,
      verificationExpiresAt: expiresAt,
      verificationResendAvailableAt: resendAvailableAt,
      verificationAttempts: 0,
      updatedAt: new Date(),
    };

    if (isConnected) {
      const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return updated || null;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return u;
    }
    return null;
  },

  async clearVerificationChallenge(userId) {
    const isConnected = await checkDbConnection();
    const updates = {
      verificationTokenHash: null,
      verificationExpiresAt: null,
      verificationResendAvailableAt: null,
      verificationAttempts: 0,
      updatedAt: new Date(),
    };

    if (isConnected) {
      await db.update(users).set(updates).where(eq(users.id, userId));
      return true;
    }

    const u = memoryUsers.get(userId);
    if (u) {
      Object.assign(u, updates);
      return true;
    }
    return false;
  },

  async deleteUser(userId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      await db.delete(users).where(eq(users.id, userId));
      return true;
    }

    memoryUsers.delete(userId);
    // Cascade delete sessions and segments
    for (const [sId, s] of Array.from(memorySessions.entries())) {
      if (s.userId === userId) {
        memorySessions.delete(sId);
        for (let i = memorySegments.length - 1; i >= 0; i--) {
          if (memorySegments[i].sessionId === sId) {
            memorySegments.splice(i, 1);
          }
        }
      }
    }
    return true;
  },

  // SESSION OPERATIONS
  /**
   * Reconcile stale active sessions for an authenticated user.
   * Liveness Rule: A session may only be ACTIVE if:
   * 1. It is the user's single most recent session (no concurrent sessions allowed)
   * 2. It has not been explicitly ended
   * 3. It has not exceeded its planned duration + grace period
   * 4. It has sent a heartbeat signal within the HEARTBEAT_TIMEOUT window (client is alive)
   */
  async reconcileActiveSessionsForUser(userId) {
    if (!userId) return;
    const isConnected = await checkDbConnection();
    const now = Date.now();
    const HEARTBEAT_TIMEOUT_MS = 60 * 1000; // 60s without heartbeat = dead/disconnected client
    const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 min allowance for pause auto-resume & network skew

    if (isConnected) {
      const activeRows = await db.select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.status, 'ACTIVE')))
        .orderBy(desc(sessions.startedAt));

      if (!activeRows || activeRows.length === 0) return;

      // Only the most recent unexpired session with active heartbeats can possibly be genuinely active
      for (let i = 0; i < activeRows.length; i++) {
        const s = activeRows[i];
        const startedMs = new Date(s.startedAt).getTime();
        const plannedMs = Number(s.plannedDurationMs) || (25 * 60 * 1000);
        const lastPingMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startedMs;
        const timeSinceLastPing = now - lastPingMs;
        const totalElapsed = now - startedMs;

        const isExpired = totalElapsed > (plannedMs + GRACE_PERIOD_MS);
        const isEnded = s.endedAt !== null;
        const isSuperseded = i > 0; // A user can only run at most one active session at a time
        const isHeartbeatDead = timeSinceLastPing > HEARTBEAT_TIMEOUT_MS;

        if (isExpired || isEnded || isSuperseded || isHeartbeatDead) {
          const recordedDur = Number(s.actualDurationMs) || 0;
          const durFromHeartbeat = Math.max(0, lastPingMs - startedMs - (Number(s.pausedDurationMs) || 0));
          const actualDur = recordedDur > 0
            ? recordedDur
            : (durFromHeartbeat >= 1000)
              ? Math.min(plannedMs, durFromHeartbeat)
              : Math.min(plannedMs, Math.max(1000, now - startedMs));
          const endedDate = s.endedAt ? new Date(s.endedAt) : new Date(startedMs + actualDur);

          await db.update(sessions)
            .set({
              status: 'COMPLETED',
              actualDurationMs: actualDur,
              endedAt: endedDate,
              updatedAt: new Date(),
            })
            .where(eq(sessions.id, s.id));
        }
      }
      return;
    }

    // In-memory store
    const activeMemSessions = Array.from(memorySessions.values())
      .filter(s => s.userId === userId && s.status === 'ACTIVE')
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    for (let i = 0; i < activeMemSessions.length; i++) {
      const s = activeMemSessions[i];
      const startedMs = new Date(s.startedAt).getTime();
      const plannedMs = Number(s.plannedDurationMs) || (25 * 60 * 1000);
      const lastPingMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startedMs;
      const timeSinceLastPing = now - lastPingMs;
      const totalElapsed = now - startedMs;

      const isExpired = totalElapsed > (plannedMs + GRACE_PERIOD_MS);
      const isEnded = s.endedAt !== null;
      const isSuperseded = i > 0;
      const isHeartbeatDead = timeSinceLastPing > HEARTBEAT_TIMEOUT_MS;

      if (isExpired || isEnded || isSuperseded || isHeartbeatDead) {
        const recordedDur = Number(s.actualDurationMs) || 0;
        const durFromHeartbeat = Math.max(0, lastPingMs - startedMs - (Number(s.pausedDurationMs) || 0));
        const actualDur = recordedDur > 0
          ? recordedDur
          : (durFromHeartbeat >= 1000)
            ? Math.min(plannedMs, durFromHeartbeat)
            : Math.min(plannedMs, Math.max(1000, now - startedMs));
        const endedDate = s.endedAt ? new Date(s.endedAt) : new Date(startedMs + actualDur);

        s.status = 'COMPLETED';
        s.actualDurationMs = actualDur;
        s.endedAt = endedDate;
        s.updatedAt = new Date();
      }
    }
  },

  /**
   * Global reconciliation of all orphaned active sessions across all users.
   */
  async reconcileAllStaleActiveSessions() {
    const isConnected = await checkDbConnection();
    const now = Date.now();
    const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
    const GRACE_PERIOD_MS = 5 * 60 * 1000;

    if (isConnected) {
      try {
        const activeRows = await db.select()
          .from(sessions)
          .where(eq(sessions.status, 'ACTIVE'));

        for (const s of activeRows) {
          const startedMs = new Date(s.startedAt).getTime();
          const plannedMs = Number(s.plannedDurationMs) || (25 * 60 * 1000);
          const lastPingMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startedMs;
          const timeSinceLastPing = now - lastPingMs;
          const isExpired = (now - startedMs) > (plannedMs + GRACE_PERIOD_MS);
          const isEnded = s.endedAt !== null;
          const isHeartbeatDead = timeSinceLastPing > HEARTBEAT_TIMEOUT_MS;

          if (isExpired || isEnded || isHeartbeatDead) {
            const recordedDur = Number(s.actualDurationMs) || 0;
            const durFromHeartbeat = Math.max(0, lastPingMs - startedMs - (Number(s.pausedDurationMs) || 0));
            const actualDur = recordedDur > 0
              ? recordedDur
              : (durFromHeartbeat >= 1000)
                ? Math.min(plannedMs, durFromHeartbeat)
                : Math.min(plannedMs, Math.max(1000, now - startedMs));
            const endedDate = s.endedAt ? new Date(s.endedAt) : new Date(startedMs + actualDur);

            await db.update(sessions)
              .set({
                status: 'COMPLETED',
                actualDurationMs: actualDur,
                endedAt: endedDate,
                updatedAt: new Date(),
              })
              .where(eq(sessions.id, s.id));
          }
        }
      } catch (err) {
        console.error('[Store] Failed to run global active session reconciliation:', err.message);
      }
      return;
    }

    for (const s of memorySessions.values()) {
      if (s.status === 'ACTIVE') {
        const startedMs = new Date(s.startedAt).getTime();
        const plannedMs = Number(s.plannedDurationMs) || (25 * 60 * 1000);
        const lastPingMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startedMs;
        const timeSinceLastPing = now - lastPingMs;
        const isExpired = (now - startedMs) > (plannedMs + GRACE_PERIOD_MS);
        const isEnded = s.endedAt !== null;
        const isHeartbeatDead = timeSinceLastPing > HEARTBEAT_TIMEOUT_MS;

        if (isExpired || isEnded || isHeartbeatDead) {
          const recordedDur = Number(s.actualDurationMs) || 0;
          const durFromHeartbeat = Math.max(0, lastPingMs - startedMs - (Number(s.pausedDurationMs) || 0));
          const actualDur = recordedDur > 0
            ? recordedDur
            : (durFromHeartbeat >= 1000)
              ? Math.min(plannedMs, durFromHeartbeat)
              : Math.min(plannedMs, Math.max(1000, now - startedMs));
          const endedDate = s.endedAt ? new Date(s.endedAt) : new Date(startedMs + actualDur);

          s.status = 'COMPLETED';
          s.actualDurationMs = actualDur;
          s.endedAt = endedDate;
          s.updatedAt = new Date();
        }
      }
    }
  },

  /**
   * Record periodic heartbeat ping from active client to maintain session liveness.
   */
  async recordHeartbeat(sessionId, userId, { actualDurationMs, pausedDurationMs } = {}) {
    const session = await this.getSessionByIdAndUser(sessionId, userId);
    if (!session) return null;

    const now = new Date();
    const isConnected = await checkDbConnection();
    const updates = {
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    if (actualDurationMs !== undefined && Number.isInteger(actualDurationMs) && actualDurationMs >= 0) {
      updates.actualDurationMs = actualDurationMs;
    }
    if (pausedDurationMs !== undefined && Number.isInteger(pausedDurationMs) && pausedDurationMs >= 0) {
      updates.pausedDurationMs = pausedDurationMs;
    }

    // Auto-complete if actual duration has met or exceeded planned duration
    const plannedMs = Number(session.plannedDurationMs) || (25 * 60 * 1000);
    if ((updates.actualDurationMs || session.actualDurationMs) >= plannedMs) {
      updates.status = 'COMPLETED';
      updates.endedAt = now;
    }

    if (isConnected) {
      const [updated] = await db.update(sessions)
        .set(updates)
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
        .returning();
      return updated;
    }

    const updated = { ...session, ...updates };
    memorySessions.set(sessionId, updated);
    return updated;
  },

  async createSession({ id, userId, selectedActivity, plannedDurationMs, actualDurationMs = 0, startedAt, endedAt = null, status = 'ACTIVE', focusPoints = 0, goalText = null, goalType = 'NONE', targetValue = null, targetUnit = null, goalProgress = 0, goalCompleted = false, intention = null }) {
    const isConnected = await checkDbConnection();

    // When starting a new ACTIVE session, automatically reconcile any previous active sessions for this user
    if ((!status || status === 'ACTIVE') && userId) {
      if (isConnected) {
        const prevActive = await db.select()
          .from(sessions)
          .where(and(eq(sessions.userId, userId), eq(sessions.status, 'ACTIVE')));

        for (const prev of prevActive) {
          const prevStarted = new Date(prev.startedAt).getTime();
          const prevPlanned = Number(prev.plannedDurationMs) || (25 * 60 * 1000);
          const dur = Number(prev.actualDurationMs) > 0 ? Number(prev.actualDurationMs) : Math.min(prevPlanned, Math.max(1000, Date.now() - prevStarted));
          await db.update(sessions)
            .set({
              status: 'COMPLETED',
              actualDurationMs: dur,
              endedAt: prev.endedAt ? new Date(prev.endedAt) : new Date(prevStarted + dur),
              updatedAt: new Date(),
            })
            .where(eq(sessions.id, prev.id));
        }
      } else {
        for (const prev of memorySessions.values()) {
          if (prev.userId === userId && prev.status === 'ACTIVE') {
            const prevStarted = new Date(prev.startedAt).getTime();
            const prevPlanned = Number(prev.plannedDurationMs) || (25 * 60 * 1000);
            const dur = Number(prev.actualDurationMs) > 0 ? Number(prev.actualDurationMs) : Math.min(prevPlanned, Math.max(1000, Date.now() - prevStarted));
            prev.status = 'COMPLETED';
            prev.actualDurationMs = dur;
            prev.endedAt = prev.endedAt ? new Date(prev.endedAt) : new Date(prevStarted + dur);
            prev.updatedAt = new Date();
          }
        }
      }
    }

    const sessionStartDate = startedAt ? new Date(startedAt) : new Date();

    if (isConnected) {
      const [newSession] = await db.insert(sessions).values({
        ...(id ? { id } : {}),
        userId,
        selectedActivity,
        plannedDurationMs,
        actualDurationMs: actualDurationMs ?? 0,
        startedAt: sessionStartDate,
        lastHeartbeatAt: new Date(),
        endedAt: endedAt ? new Date(endedAt) : null,
        status: status || 'ACTIVE',
        focusPoints: focusPoints ?? 0,
        goalText,
        goalType,
        targetValue,
        targetUnit,
        goalProgress,
        goalCompleted,
        intention: intention || null,
        workedWell: null,
        gotInTheWay: null,
        notes: null,
      }).returning();
      return newSession;
    }

    const newSession = {
      id: id || crypto.randomUUID(),
      userId,
      selectedActivity,
      plannedDurationMs,
      actualDurationMs: actualDurationMs ?? 0,
      pausedDurationMs: 0,
      status: status || 'ACTIVE',
      focusPoints: focusPoints ?? 0,
      goalText,
      goalType,
      targetValue,
      targetUnit,
      goalProgress,
      goalCompleted,
      intention: intention || null,
      workedWell: null,
      gotInTheWay: null,
      notes: null,
      startedAt: sessionStartDate,
      lastHeartbeatAt: new Date(),
      endedAt: endedAt ? new Date(endedAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySessions.set(newSession.id, newSession);
    return newSession;
  },

  async getSessionsByUserId(userId, { limit = 20, offset = 0, from, to } = {}) {
    // Reconcile any stale active sessions for this user before returning session history
    await this.reconcileActiveSessionsForUser(userId);

    const isConnected = await checkDbConnection();
    if (isConnected) {
      let conditions = [eq(sessions.userId, userId)];
      if (from) conditions.push(gte(sessions.startedAt, new Date(from)));
      if (to) conditions.push(lte(sessions.startedAt, new Date(to)));

      return await db.select()
        .from(sessions)
        .where(and(...conditions))
        .orderBy(desc(sessions.startedAt))
        .limit(limit)
        .offset(offset);
    }

    const userSessions = Array.from(memorySessions.values())
      .filter(s => s.userId === userId)
      .filter(s => !from || new Date(s.startedAt) >= new Date(from))
      .filter(s => !to || new Date(s.startedAt) <= new Date(to))
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    return userSessions.slice(offset, offset + limit);
  },

  async getSessionByIdAndUser(id, userId) {
    const isConnected = await checkDbConnection();
    let session = null;

    if (isConnected) {
      const rows = await db.select()
        .from(sessions)
        .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
        .limit(1);
      session = rows[0] || null;
    } else {
      const s = memorySessions.get(id);
      if (s && s.userId === userId) session = s;
    }

    if (!session) return null;

    // Check if an ACTIVE session is stale and needs reconciliation
    if (session.status === 'ACTIVE') {
      const now = Date.now();
      const startedMs = new Date(session.startedAt).getTime();
      const plannedMs = Number(session.plannedDurationMs) || (25 * 60 * 1000);
      const lastPingMs = session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt).getTime() : startedMs;
      const timeSinceLastPing = now - lastPingMs;
      const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
      const GRACE_PERIOD_MS = 5 * 60 * 1000;

      const isExpired = (now - startedMs) > (plannedMs + GRACE_PERIOD_MS);
      const isEnded = session.endedAt !== null;
      const isHeartbeatDead = timeSinceLastPing > HEARTBEAT_TIMEOUT_MS;

      if (isExpired || isEnded || isHeartbeatDead) {
        const recordedDur = Number(session.actualDurationMs) || 0;
        const durFromHeartbeat = Math.max(0, lastPingMs - startedMs - (Number(session.pausedDurationMs) || 0));
        const actualDur = recordedDur > 0
          ? recordedDur
          : (durFromHeartbeat >= 1000)
            ? Math.min(plannedMs, durFromHeartbeat)
            : Math.min(plannedMs, Math.max(1000, now - startedMs));
        const endedDate = session.endedAt ? new Date(session.endedAt) : new Date(startedMs + actualDur);

        if (isConnected) {
          const [updated] = await db.update(sessions)
            .set({
              status: 'COMPLETED',
              actualDurationMs: actualDur,
              endedAt: endedDate,
              updatedAt: new Date(),
            })
            .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
            .returning();
          return updated || session;
        } else {
          session.status = 'COMPLETED';
          session.actualDurationMs = actualDur;
          session.endedAt = endedDate;
          session.updatedAt = new Date();
          return session;
        }
      }
    }

    return session;
  },

  async saveSegments(sessionId, userId, segments) {
    const session = await this.getSessionByIdAndUser(sessionId, userId);
    if (!session) return null;

    const isConnected = await checkDbConnection();
    const segmentValues = segments.map(seg => ({
      id: crypto.randomUUID(),
      sessionId,
      activityType: seg.activityType,
      startTimeMs: seg.startTimeMs,
      endTimeMs: seg.endTimeMs,
      durationMs: seg.durationMs,
      evidenceScore: seg.evidenceScore,
      confidenceType: seg.confidenceType || 'heuristic',
      contributingSignals: seg.contributingSignals || [],
      explanation: seg.explanation || {},
      createdAt: new Date(),
    }));

    let saved = [];
    if (isConnected) {
      saved = await db.insert(activitySegments).values(segmentValues).returning();
    } else {
      memorySegments.push(...segmentValues);
      saved = segmentValues;
    }

    // Recalculate focusPoints for the session based on all saved segments
    const allSegments = await this.getSegmentsBySessionId(sessionId);
    let qualifyingSec = 0;
    allSegments.forEach(seg => {
      const type = (seg.activityType || '').toUpperCase();
      if (type === 'STUDY_LIKE' || type === 'CODING' || type === 'DOCUMENT_ACTIVITY') {
        qualifyingSec += Math.max(0, Math.round((seg.durationMs || 0) / 1000));
      }
    });
    const calculatedPoints = Math.floor(qualifyingSec / 60);
    await this.updateSession(sessionId, userId, { focusPoints: calculatedPoints });

    return saved;
  },

  async getSegmentsBySessionId(sessionId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      return await db.select()
        .from(activitySegments)
        .where(eq(activitySegments.sessionId, sessionId))
        .orderBy(activitySegments.startTimeMs);
    }

    return memorySegments
      .filter(seg => seg.sessionId === sessionId)
      .sort((a, b) => a.startTimeMs - b.startTimeMs);
  },

  async updateSession(id, userId, updates) {
    const session = await this.getSessionByIdAndUser(id, userId);
    if (!session) return null;

    const isConnected = await checkDbConnection();
    const updatedFields = {
      ...updates,
      updatedAt: new Date(),
    };

    if (updatedFields.endedAt && typeof updatedFields.endedAt === 'string') {
      updatedFields.endedAt = new Date(updatedFields.endedAt);
    }
    if (updatedFields.startedAt && typeof updatedFields.startedAt === 'string') {
      updatedFields.startedAt = new Date(updatedFields.startedAt);
    }

    if (isConnected) {
      const [updated] = await db.update(sessions)
        .set(updatedFields)
        .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
        .returning();
      return updated;
    }

    const updatedSession = { ...session, ...updatedFields };
    memorySessions.set(id, updatedSession);
    return updatedSession;
  },

  async deleteSession(id, userId) {
    const session = await this.getSessionByIdAndUser(id, userId);
    if (!session) return null;

    const isConnected = await checkDbConnection();
    if (isConnected) {
      const [deleted] = await db.delete(sessions)
        .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
        .returning();
      return deleted;
    }

    memorySessions.delete(id);
    for (let i = memorySegments.length - 1; i >= 0; i--) {
      if (memorySegments[i].sessionId === id) {
        memorySegments.splice(i, 1);
      }
    }
    return session;
  },

  // PASSWORD RESET OPERATIONS
  async createPasswordReset({ userId, resetType, tokenHash, expiresAt, resendAvailableAt }) {
    const isConnected = await checkDbConnection();
    const values = {
      userId,
      resetType,
      tokenHash,
      expiresAt,
      resendAvailableAt: resendAvailableAt || new Date(Date.now() + 60 * 1000),
      usedAt: null,
      attempts: 0,
      createdAt: new Date(),
    };

    if (isConnected) {
      const [newReset] = await db.insert(passwordResets).values(values).returning();
      return newReset;
    }

    const newReset = {
      id: crypto.randomUUID(),
      ...values,
    };
    memoryPasswordResets.set(newReset.id, newReset);
    return newReset;
  },

  async getPasswordResetByTokenHash(tokenHash) {
    if (!tokenHash) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, tokenHash)).limit(1);
      return rows[0] || null;
    }

    for (const pr of memoryPasswordResets.values()) {
      if (pr.tokenHash === tokenHash) return pr;
    }
    return null;
  },

  async getActivePasswordResetByUser(userId, resetType) {
    if (!userId) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select()
        .from(passwordResets)
        .where(and(eq(passwordResets.userId, userId), eq(passwordResets.resetType, resetType)))
        .orderBy(desc(passwordResets.createdAt))
        .limit(1);
      return rows[0] || null;
    }

    const matching = Array.from(memoryPasswordResets.values())
      .filter(pr => pr.userId === userId && pr.resetType === resetType)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return matching[0] || null;
  },

  async markPasswordResetUsed(resetId) {
    const isConnected = await checkDbConnection();
    const now = new Date();
    if (isConnected) {
      const [updated] = await db.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, resetId)).returning();
      return updated || null;
    }

    const pr = memoryPasswordResets.get(resetId);
    if (pr) {
      pr.usedAt = now;
      return pr;
    }
    return null;
  },

  async incrementPasswordResetAttempts(resetId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(passwordResets).where(eq(passwordResets.id, resetId)).limit(1);
      if (!rows[0]) return 0;
      const nextAttempts = (rows[0].attempts || 0) + 1;
      await db.update(passwordResets).set({ attempts: nextAttempts }).where(eq(passwordResets.id, resetId));
      return nextAttempts;
    }

    const pr = memoryPasswordResets.get(resetId);
    if (pr) {
      pr.attempts = (pr.attempts || 0) + 1;
      return pr.attempts;
    }
    return 0;
  },

  // WEEKLY REVIEW NOTES OPERATIONS
  async getWeeklyReviewNote(userId, weekStartDate) {
    if (!userId || !weekStartDate) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select()
        .from(weeklyReviewNotes)
        .where(and(eq(weeklyReviewNotes.userId, userId), eq(weeklyReviewNotes.weekStartDate, weekStartDate)))
        .limit(1);
      return rows[0] || null;
    }

    const key = `${userId}:${weekStartDate}`;
    return memoryWeeklyNotes.get(key) || null;
  },

  async upsertWeeklyReviewNote(userId, weekStartDate, { workedWell = null, madeItHard = null }) {
    if (!userId || !weekStartDate) return null;
    const isConnected = await checkDbConnection();
    const now = new Date();

    if (isConnected) {
      const existing = await this.getWeeklyReviewNote(userId, weekStartDate);
      if (existing) {
        const [updated] = await db.update(weeklyReviewNotes)
          .set({ workedWell, madeItHard, updatedAt: now })
          .where(eq(weeklyReviewNotes.id, existing.id))
          .returning();
        return updated;
      }
      const [inserted] = await db.insert(weeklyReviewNotes)
        .values({ userId, weekStartDate, workedWell, madeItHard })
        .returning();
      return inserted;
    }

    const key = `${userId}:${weekStartDate}`;
    const existing = memoryWeeklyNotes.get(key);
    if (existing) {
      existing.workedWell = workedWell;
      existing.madeItHard = madeItHard;
      existing.updatedAt = now;
      return existing;
    }

    const newNote = {
      id: crypto.randomUUID(),
      userId,
      weekStartDate,
      workedWell,
      madeItHard,
      createdAt: now,
      updatedAt: now,
    };
    memoryWeeklyNotes.set(key, newNote);
    return newNote;
  },

  // JOURNAL OPERATIONS
  async updateSessionJournal(id, userId, { intention, workedWell, gotInTheWay, notes }) {
    const session = await this.getSessionByIdAndUser(id, userId);
    if (!session) return null;

    const updates = {};
    if (intention !== undefined) updates.intention = intention;
    if (workedWell !== undefined) updates.workedWell = workedWell;
    if (gotInTheWay !== undefined) updates.gotInTheWay = gotInTheWay;
    if (notes !== undefined) updates.notes = notes;
    updates.updatedAt = new Date();

    return await this.updateSession(id, userId, updates);
  },

  async getJournalSessions(userId, { limit = 20, offset = 0, filter = 'all' } = {}) {
    const isConnected = await checkDbConnection();
    let allUserSessions = [];

    if (isConnected) {
      allUserSessions = await db.select()
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.status, 'COMPLETED')))
        .orderBy(desc(sessions.startedAt));
    } else {
      allUserSessions = Array.from(memorySessions.values())
        .filter(s => s.userId === userId && s.status === 'COMPLETED')
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    }

    let filtered = allUserSessions;
    if (filter === 'goals') {
      filtered = allUserSessions.filter(s => s.goalType && s.goalType !== 'NONE' && s.goalText);
    } else if (filter === 'reflections') {
      filtered = allUserSessions.filter(s => s.workedWell || s.gotInTheWay || s.notes);
    }

    const totalCount = filtered.length;
    const paginatedSessions = filtered.slice(offset, offset + limit);

    return {
      sessions: paginatedSessions,
      totalCount,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(totalCount / limit) || 1,
      hasMore: offset + limit < totalCount,
    };
  },

  // GOOGLE CALENDAR CONNECTIONS
  async getGoogleCalendarConnection(userId) {
    if (!userId) return null;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId)).limit(1);
      return rows[0] || null;
    }
    return memoryGoogleCalendarConnections.get(userId) || null;
  },

  async upsertGoogleCalendarConnection(userId, {
    googleAccountEmail,
    accessTokenEncrypted,
    refreshTokenEncrypted,
    scope,
    tokenExpiry,
    calendarId = 'primary',
  }) {
    if (!userId) throw new Error('userId is required');
    const now = new Date();
    const isConnected = await checkDbConnection();

    if (isConnected) {
      const existing = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId)).limit(1);
      if (existing.length > 0) {
        const updateValues = {
          googleAccountEmail: googleAccountEmail || existing[0].googleAccountEmail,
          accessTokenEncrypted,
          refreshTokenEncrypted: refreshTokenEncrypted || existing[0].refreshTokenEncrypted,
          scope: scope || existing[0].scope,
          tokenExpiry: tokenExpiry || existing[0].tokenExpiry,
          calendarId: calendarId || existing[0].calendarId,
          updatedAt: now,
        };
        const [updated] = await db.update(googleCalendarConnections)
          .set(updateValues)
          .where(eq(googleCalendarConnections.userId, userId))
          .returning();
        return updated;
      }

      const [created] = await db.insert(googleCalendarConnections).values({
        userId,
        provider: 'google',
        googleAccountEmail: googleAccountEmail || null,
        accessTokenEncrypted,
        refreshTokenEncrypted: refreshTokenEncrypted || null,
        scope: scope || null,
        tokenExpiry: tokenExpiry || null,
        calendarId: calendarId || 'primary',
        createdAt: now,
        updatedAt: now,
      }).returning();
      return created;
    }

    // Memory fallback
    const existing = memoryGoogleCalendarConnections.get(userId);
    const connection = {
      id: existing?.id || crypto.randomUUID(),
      userId,
      provider: 'google',
      googleAccountEmail: googleAccountEmail || existing?.googleAccountEmail || null,
      accessTokenEncrypted,
      refreshTokenEncrypted: refreshTokenEncrypted || existing?.refreshTokenEncrypted || null,
      scope: scope || existing?.scope || null,
      tokenExpiry: tokenExpiry || existing?.tokenExpiry || null,
      calendarId: calendarId || existing?.calendarId || 'primary',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    memoryGoogleCalendarConnections.set(userId, connection);
    return connection;
  },

  async updateGoogleCalendarSelectedCalendar(userId, calendarId) {
    if (!userId || !calendarId) return null;
    const now = new Date();
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const [updated] = await db.update(googleCalendarConnections)
        .set({ calendarId, updatedAt: now })
        .where(eq(googleCalendarConnections.userId, userId))
        .returning();
      return updated || null;
    }

    const existing = memoryGoogleCalendarConnections.get(userId);
    if (existing) {
      existing.calendarId = calendarId;
      existing.updatedAt = now;
      memoryGoogleCalendarConnections.set(userId, existing);
      return existing;
    }
    return null;
  },

  async deleteGoogleCalendarConnection(userId) {
    if (!userId) return false;
    const isConnected = await checkDbConnection();
    if (isConnected) {
      await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
      return true;
    }
    memoryGoogleCalendarConnections.delete(userId);
    return true;
  },

  // TASK OPERATIONS
  async createTask({ id, userId, title, description = null, category = 'Other', completed = false, dueDate = null }) {
    if (!userId || !title) return null;
    const isConnected = await checkDbConnection();
    const now = new Date();
    const values = {
      id: id || crypto.randomUUID(),
      userId,
      title: title.trim(),
      description: description ? description.trim() : null,
      category: category || 'Other',
      completed: Boolean(completed),
      dueDate: dueDate ? new Date(dueDate) : null,
      createdAt: now,
      updatedAt: now,
    };

    if (isConnected) {
      const [newTask] = await db.insert(tasks).values(values).returning();
      return newTask;
    }

    memoryTasks.set(values.id, { ...values });
    return values;
  },

  async getTasksByUserId(userId, { category, search } = {}) {
    if (!userId) return [];
    const isConnected = await checkDbConnection();

    if (isConnected) {
      let queryConditions = [eq(tasks.userId, userId)];
      if (category && category !== 'All Work' && category !== 'ALL') {
        queryConditions.push(eq(tasks.category, category));
      }

      let userTasks = await db.select()
        .from(tasks)
        .where(and(...queryConditions))
        .orderBy(desc(tasks.createdAt));

      if (search && search.trim()) {
        const term = search.toLowerCase().trim();
        userTasks = userTasks.filter(t => 
          (t.title && t.title.toLowerCase().includes(term)) ||
          (t.description && t.description.toLowerCase().includes(term))
        );
      }

      return userTasks;
    }

    // Memory fallback
    let userTasks = Array.from(memoryTasks.values())
      .filter(t => t.userId === userId);

    if (category && category !== 'All Work' && category !== 'ALL') {
      userTasks = userTasks.filter(t => t.category === category);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      userTasks = userTasks.filter(t =>
        (t.title && t.title.toLowerCase().includes(term)) ||
        (t.description && t.description.toLowerCase().includes(term))
      );
    }

    return userTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getTaskByIdAndUser(id, userId) {
    if (!id || !userId) return null;
    const isConnected = await checkDbConnection();

    if (isConnected) {
      const rows = await db.select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .limit(1);
      return rows[0] || null;
    }

    const t = memoryTasks.get(id);
    if (t && t.userId === userId) return t;
    return null;
  },

  async updateTask(id, userId, updates = {}) {
    const existing = await this.getTaskByIdAndUser(id, userId);
    if (!existing) return null;

    const isConnected = await checkDbConnection();
    const now = new Date();
    const patch = { updatedAt: now };

    if (updates.title !== undefined) patch.title = updates.title.trim();
    if (updates.description !== undefined) patch.description = updates.description ? updates.description.trim() : null;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.completed !== undefined) patch.completed = Boolean(updates.completed);
    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;

    if (isConnected) {
      const [updated] = await db.update(tasks)
        .set(patch)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
        .returning();
      return updated || null;
    }

    const updated = { ...existing, ...patch };
    memoryTasks.set(id, updated);
    return updated;
  },

  async deleteTask(id, userId) {
    const existing = await this.getTaskByIdAndUser(id, userId);
    if (!existing) return false;

    const isConnected = await checkDbConnection();
    if (isConnected) {
      await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
      return true;
    }

    memoryTasks.delete(id);
    return true;
  },

  // ==========================================
  // FOCUS BUDDY & MESSAGING OPERATIONS
  // ==========================================

  async getUserByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.toLowerCase().trim().replace(/^@/, '');
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(users).where(
        or(
          eq(users.username, clean),
          eq(users.email, clean)
        )
      ).limit(1);
      return rows[0] || null;
    }

    for (const u of memoryUsers.values()) {
      if ((u.username && u.username.toLowerCase() === clean) ||
          (u.email && u.email.toLowerCase() === clean)) {
        return u;
      }
    }
    return null;
  },

  async sendBuddyRequest(senderUserId, receiverUserId) {
    if (senderUserId === receiverUserId) {
      const err = new Error('You cannot add yourself as a Focus Buddy');
      err.statusCode = 400;
      throw err;
    }

    const isConnected = await checkDbConnection();
    const existing = await this.getBuddyRelationship(senderUserId, receiverUserId);
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        const err = new Error('Already connected as Focus Buddies');
        err.statusCode = 400;
        throw err;
      }
      if (existing.status === 'PENDING') {
        if (existing.senderUserId === senderUserId) {
          const err = new Error('Buddy request already pending');
          err.statusCode = 400;
          throw err;
        } else {
          // The other user already requested us -> auto-accept
          return this.respondToBuddyRequest(existing.id, senderUserId, 'ACCEPT');
        }
      }
    }

    const now = new Date();
    const record = {
      id: crypto.randomUUID(),
      senderUserId,
      receiverUserId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    if (isConnected) {
      const [inserted] = await db.insert(focusBuddies).values(record).returning();
      return inserted;
    }

    memoryBuddies.set(record.id, record);
    return record;
  },

  async getBuddyRelationship(userAId, userBId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(focusBuddies).where(
        or(
          and(eq(focusBuddies.senderUserId, userAId), eq(focusBuddies.receiverUserId, userBId)),
          and(eq(focusBuddies.senderUserId, userBId), eq(focusBuddies.receiverUserId, userAId))
        )
      ).limit(1);
      return rows[0] || null;
    }

    for (const b of memoryBuddies.values()) {
      if ((b.senderUserId === userAId && b.receiverUserId === userBId) ||
          (b.senderUserId === userBId && b.receiverUserId === userAId)) {
        return b;
      }
    }
    return null;
  },

  async getPendingBuddyRequests(userId) {
    const isConnected = await checkDbConnection();
    let requests = [];

    if (isConnected) {
      requests = await db.select().from(focusBuddies)
        .where(and(eq(focusBuddies.receiverUserId, userId), eq(focusBuddies.status, 'PENDING')))
        .orderBy(desc(focusBuddies.createdAt));
    } else {
      requests = Array.from(memoryBuddies.values())
        .filter(b => b.receiverUserId === userId && b.status === 'PENDING')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Populate sender information
    const populated = [];
    for (const req of requests) {
      const sender = await this.getUserById(req.senderUserId);
      if (sender) {
        populated.push({
          id: req.id,
          senderId: sender.id,
          senderName: sender.name || sender.username || 'Focus Buddy',
          senderUsername: sender.username || 'user',
          senderAvatarUrl: sender.avatarUrl || null,
          createdAt: req.createdAt,
        });
      }
    }
    return populated;
  },

  async getAcceptedBuddies(userId) {
    const isConnected = await checkDbConnection();
    let records = [];

    if (isConnected) {
      records = await db.select().from(focusBuddies).where(
        and(
          eq(focusBuddies.status, 'ACCEPTED'),
          or(eq(focusBuddies.senderUserId, userId), eq(focusBuddies.receiverUserId, userId))
        )
      );
    } else {
      records = Array.from(memoryBuddies.values()).filter(
        b => b.status === 'ACCEPTED' && (b.senderUserId === userId || b.receiverUserId === userId)
      );
    }

    const buddies = [];
    for (const r of records) {
      const buddyId = r.senderUserId === userId ? r.receiverUserId : r.senderUserId;
      const u = await this.getUserById(buddyId);
      if (u) {
        buddies.push({
          id: r.id,
          userId: u.id,
          name: u.name || u.username || 'Focus Buddy',
          username: u.username || 'user',
          avatarUrl: u.avatarUrl || null,
          connectedAt: r.updatedAt || r.createdAt,
        });
      }
    }
    return buddies;
  },

  async respondToBuddyRequest(requestId, receiverUserId, action) {
    const isConnected = await checkDbConnection();
    let record = null;

    if (isConnected) {
      const rows = await db.select().from(focusBuddies).where(eq(focusBuddies.id, requestId)).limit(1);
      record = rows[0] || null;
    } else {
      record = memoryBuddies.get(requestId) || null;
    }

    if (!record || record.receiverUserId !== receiverUserId) {
      const err = new Error('Buddy request not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    const now = new Date();
    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

    if (isConnected) {
      const [updated] = await db.update(focusBuddies)
        .set({ status: newStatus, updatedAt: now })
        .where(eq(focusBuddies.id, requestId))
        .returning();
      if (newStatus === 'ACCEPTED') {
        await this.getOrCreateConversation(record.senderUserId, record.receiverUserId);
      }
      return updated;
    }

    record.status = newStatus;
    record.updatedAt = now;
    memoryBuddies.set(requestId, record);

    if (newStatus === 'ACCEPTED') {
      await this.getOrCreateConversation(record.senderUserId, record.receiverUserId);
    }
    return record;
  },

  async removeBuddy(userAId, userBId) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      await db.delete(focusBuddies).where(
        or(
          and(eq(focusBuddies.senderUserId, userAId), eq(focusBuddies.receiverUserId, userBId)),
          and(eq(focusBuddies.senderUserId, userBId), eq(focusBuddies.receiverUserId, userAId))
        )
      );
      return true;
    }

    for (const [id, b] of memoryBuddies.entries()) {
      if ((b.senderUserId === userAId && b.receiverUserId === userBId) ||
          (b.senderUserId === userBId && b.receiverUserId === userAId)) {
        memoryBuddies.delete(id);
      }
    }
    return true;
  },

  // CONVERSATION OPERATIONS

  async getOrCreateConversation(userAId, userBId) {
    const [user1Id, user2Id] = [userAId, userBId].sort();
    const isConnected = await checkDbConnection();

    if (isConnected) {
      const rows = await db.select().from(conversations).where(
        and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id))
      ).limit(1);
      if (rows[0]) return rows[0];

      const now = new Date();
      const [created] = await db.insert(conversations).values({
        id: crypto.randomUUID(),
        user1Id,
        user2Id,
        createdAt: now,
        updatedAt: now,
      }).returning();
      return created;
    }

    for (const c of memoryConversations.values()) {
      if (c.user1Id === user1Id && c.user2Id === user2Id) {
        return c;
      }
    }

    const now = new Date();
    const created = {
      id: crypto.randomUUID(),
      user1Id,
      user2Id,
      lastMessageContent: null,
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memoryConversations.set(created.id, created);
    return created;
  },

  async getConversationsForUser(userId) {
    const isConnected = await checkDbConnection();
    let convList = [];

    if (isConnected) {
      convList = await db.select().from(conversations).where(
        or(eq(conversations.user1Id, userId), eq(conversations.user2Id, userId))
      );
    } else {
      convList = Array.from(memoryConversations.values()).filter(
        c => c.user1Id === userId || c.user2Id === userId
      );
    }

    const result = [];
    for (const conv of convList) {
      const buddyId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const buddy = await this.getUserById(buddyId);
      if (!buddy) continue;

      // Count unread messages
      let unreadCount = 0;
      if (isConnected) {
        const unreadRows = await db.select().from(messages).where(
          and(
            eq(messages.conversationId, conv.id),
            eq(messages.senderUserId, buddyId),
            isNull(messages.readAt)
          )
        );
        unreadCount = unreadRows.length;
      } else {
        unreadCount = Array.from(memoryMessages.values()).filter(
          m => m.conversationId === conv.id && m.senderUserId === buddyId && !m.readAt
        ).length;
      }

      result.push({
        id: conv.id,
        buddy: {
          id: buddy.id,
          name: buddy.name || buddy.username || 'Focus Buddy',
          username: buddy.username || 'user',
          avatarUrl: buddy.avatarUrl || null,
        },
        lastMessageContent: conv.lastMessageContent || null,
        lastMessageAt: conv.lastMessageAt || conv.createdAt,
        unreadCount,
      });
    }

    result.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
    return result;
  },

  async getConversationById(conversationId, userId) {
    const isConnected = await checkDbConnection();
    let conv = null;

    if (isConnected) {
      const rows = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      conv = rows[0] || null;
    } else {
      conv = memoryConversations.get(conversationId) || null;
    }

    if (!conv) return null;
    // Strict IDOR Check: user must be user1 or user2
    if (conv.user1Id !== userId && conv.user2Id !== userId) {
      const err = new Error('Access denied: You are not a participant in this conversation');
      err.statusCode = 403;
      throw err;
    }

    const buddyId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
    const buddy = await this.getUserById(buddyId);

    return {
      ...conv,
      buddy: buddy ? {
        id: buddy.id,
        name: buddy.name || buddy.username || 'Focus Buddy',
        username: buddy.username || 'user',
        avatarUrl: buddy.avatarUrl || null,
      } : null,
    };
  },

  async getMessagesForConversation(conversationId, userId, limit = 100) {
    // Check membership authorization first
    await this.getConversationById(conversationId, userId);

    const isConnected = await checkDbConnection();
    if (isConnected) {
      const rows = await db.select().from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt)
        .limit(limit);
      return rows;
    }

    return Array.from(memoryMessages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-limit);
  },

  async createMessage({ conversationId, senderUserId, content, messageType = 'TEXT', activityMetadata = {} }) {
    // Validate authorization
    await this.getConversationById(conversationId, senderUserId);

    if (!content || typeof content !== 'string' || !content.trim()) {
      const err = new Error('Message content cannot be empty');
      err.statusCode = 400;
      throw err;
    }

    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      const err = new Error('Message exceeds maximum length of 1000 characters');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const msgRecord = {
      id: crypto.randomUUID(),
      conversationId,
      senderUserId,
      content: trimmed,
      messageType,
      activityMetadata: activityMetadata || {},
      readAt: null,
      createdAt: now,
    };

    const isConnected = await checkDbConnection();
    if (isConnected) {
      const [inserted] = await db.insert(messages).values(msgRecord).returning();
      await db.update(conversations)
        .set({
          lastMessageContent: trimmed.substring(0, 100),
          lastMessageAt: now,
          updatedAt: now,
        })
        .where(eq(conversations.id, conversationId));
      return inserted;
    }

    memoryMessages.set(msgRecord.id, msgRecord);
    const conv = memoryConversations.get(conversationId);
    if (conv) {
      conv.lastMessageContent = trimmed.substring(0, 100);
      conv.lastMessageAt = now;
      conv.updatedAt = now;
    }
    return msgRecord;
  },

  async markConversationAsRead(conversationId, userId) {
    await this.getConversationById(conversationId, userId);

    const isConnected = await checkDbConnection();
    const now = new Date();

    if (isConnected) {
      await db.update(messages)
        .set({ readAt: now })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            isNull(messages.readAt)
          )
        );
      return { success: true };
    }

    for (const m of memoryMessages.values()) {
      if (m.conversationId === conversationId && m.senderUserId !== userId && !m.readAt) {
        m.readAt = now;
      }
    }
    return { success: true };
  },

  async getUnreadMessagesCount(userId) {
    const conversations = await this.getConversationsForUser(userId);
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  },
};


