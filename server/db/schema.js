import { pgTable, uuid, text, integer, bigint, real, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (supporting email + password auth & legacy anonymous identity)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  email: text('email').unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  anonymousId: text('anonymous_id').unique(),
  phoneNumber: text('phone_number').unique(),
  preferredVerificationMethod: text('preferred_verification_method').default('EMAIL'),
  verificationStatus: text('verification_status').default('UNVERIFIED'),
  emailVerifiedAt: timestamp('email_verified_at'),
  phoneVerifiedAt: timestamp('phone_verified_at'),
  verificationTokenHash: text('verification_token_hash'),
  verificationExpiresAt: timestamp('verification_expires_at'),
  verificationAttempts: integer('verification_attempts').default(0),
  verificationResendAvailableAt: timestamp('verification_resend_available_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Focus Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  selectedActivity: text('selected_activity').notNull(),
  plannedDurationMs: integer('planned_duration_ms').notNull(),
  actualDurationMs: integer('actual_duration_ms').default(0),
  pausedDurationMs: integer('paused_duration_ms').default(0),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, COMPLETED, CANCELLED
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxSessionsUserStarted: index('idx_sessions_user_started').on(table.userId, table.startedAt),
}));

// Activity Segments table
export const activitySegments = pgTable('activity_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }).notNull(),
  activityType: text('activity_type').notNull(),
  startTimeMs: bigint('start_time_ms', { mode: 'number' }).notNull(),
  endTimeMs: bigint('end_time_ms', { mode: 'number' }).notNull(),
  durationMs: integer('duration_ms').notNull(),
  evidenceScore: real('evidence_score').notNull(),
  confidenceType: text('confidence_type').default('heuristic').notNull(),
  contributingSignals: jsonb('contributing_signals').default([]),
  explanation: jsonb('explanation').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxSegmentsSessionStart: index('idx_segments_session_start').on(table.sessionId, table.startTimeMs),
}));

// Password Resets table
export const passwordResets = pgTable('password_resets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  resetType: text('reset_type').notNull(), // 'EMAIL' or 'PHONE'
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  attempts: integer('attempts').default(0),
  resendAvailableAt: timestamp('resend_available_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxPasswordResetsTokenHash: index('idx_password_resets_token_hash').on(table.tokenHash),
  idxPasswordResetsUserId: index('idx_password_resets_user_id').on(table.userId),
}));

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  passwordResets: many(passwordResets),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  segments: many(activitySegments),
}));

export const activitySegmentsRelations = relations(activitySegments, ({ one }) => ({
  session: one(sessions, {
    fields: [activitySegments.sessionId],
    references: [sessions.id],
  }),
}));

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
  user: one(users, {
    fields: [passwordResets.userId],
    references: [users.id],
  }),
}));

