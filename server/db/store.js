import { eq, desc, gte, lte, and } from 'drizzle-orm';
import { db, checkDbConnection } from './client.js';
import { users, sessions, activitySegments, passwordResets, weeklyReviewNotes, googleCalendarConnections } from './schema.js';
import crypto from 'crypto';

// In-Memory Fallback Stores (used if PostgreSQL service is offline)
const memoryUsers = new Map();
const memorySessions = new Map();
const memorySegments = [];
const memoryPasswordResets = new Map();
const memoryWeeklyNotes = new Map();
const memoryGoogleCalendarConnections = new Map();

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

  async createUser({ username, email, name, passwordHash, anonymousId, phoneNumber, preferredVerificationMethod, verificationStatus, avatarUrl, avatarPublicId }) {
    const isConnected = await checkDbConnection();
    const values = {
      username: username ? username.toLowerCase().trim() : null,
      email: email ? email.toLowerCase().trim() : null,
      name: name || null,
      passwordHash: passwordHash || null,
      anonymousId: anonymousId || null,
      phoneNumber: phoneNumber || null,
      preferredVerificationMethod: preferredVerificationMethod || 'EMAIL',
      verificationStatus: verificationStatus || 'UNVERIFIED',
      avatarUrl: avatarUrl || null,
      avatarPublicId: avatarPublicId || null,
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
      emailVerifiedAt: null,
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
  async createSession({ id, userId, selectedActivity, plannedDurationMs, actualDurationMs = 0, startedAt, endedAt = null, status = 'ACTIVE', focusPoints = 0, goalText = null, goalType = 'NONE', targetValue = null, targetUnit = null, goalProgress = 0, goalCompleted = false, intention = null }) {
    const isConnected = await checkDbConnection();
    if (isConnected) {
      const [newSession] = await db.insert(sessions).values({
        ...(id ? { id } : {}),
        userId,
        selectedActivity,
        plannedDurationMs,
        actualDurationMs: actualDurationMs ?? 0,
        startedAt: startedAt ? new Date(startedAt) : new Date(),
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
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memorySessions.set(newSession.id, newSession);
    return newSession;
  },

  async getSessionsByUserId(userId, { limit = 20, offset = 0, from, to } = {}) {
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
    if (isConnected) {
      const rows = await db.select()
        .from(sessions)
        .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
        .limit(1);
      return rows[0] || null;
    }

    const s = memorySessions.get(id);
    if (s && s.userId === userId) return s;
    return null;
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
};


