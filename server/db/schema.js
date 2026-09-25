import { pgTable, uuid, text, integer, bigint, real, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (supporting email + password auth & legacy anonymous identity)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').unique(),
  email: text('email'),
  name: text('name'),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  anonymousId: text('anonymous_id').unique(),
  phoneNumber: text('phone_number'),
  avatarUrl: text('avatar_url'),
  avatarPublicId: text('avatar_public_id'),
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
  focusPoints: integer('focus_points').default(0).notNull(),
  goalText: text('goal_text'),
  goalType: text('goal_type').default('NONE'), // NONE, TIME, COUNT
  targetValue: real('target_value'),
  targetUnit: text('target_unit'),
  goalCompleted: boolean('goal_completed').default(false),
  goalProgress: real('goal_progress').default(0),
  intention: text('intention'),
  workedWell: text('worked_well'),
  gotInTheWay: text('got_in_the_way'),
  notes: text('notes'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow(),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxSessionsUserStarted: index('idx_sessions_user_started').on(table.userId, table.startedAt),
  idxSessionsUserStatus: index('idx_sessions_user_status').on(table.userId, table.status),
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

// Weekly Review Notes table
export const weeklyReviewNotes = pgTable('weekly_review_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  weekStartDate: text('week_start_date').notNull(), // 'YYYY-MM-DD'
  workedWell: text('worked_well'),
  madeItHard: text('made_it_hard'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxWeeklyNotesUserWeek: index('idx_weekly_notes_user_week').on(table.userId, table.weekStartDate),
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

// Google Calendar Connections table
export const googleCalendarConnections = pgTable('google_calendar_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  provider: text('provider').default('google').notNull(),
  googleAccountEmail: text('google_account_email'),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  scope: text('scope'),
  tokenExpiry: timestamp('token_expiry'),
  calendarId: text('calendar_id').default('primary'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxGoogleCalUser: index('idx_google_cal_user').on(table.userId),
}));

// Tasks table (User tasks with categories: Study, Coding, Other)
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').default('Other').notNull(), // Study, Coding, Other
  completed: boolean('completed').default(false).notNull(),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxTasksUserCreated: index('idx_tasks_user_created').on(table.userId, table.createdAt),
}));

// Drizzle Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  sessions: many(sessions),
  tasks: many(tasks),
  passwordResets: many(passwordResets),
  weeklyReviewNotes: many(weeklyReviewNotes),
  googleCalendarConnection: one(googleCalendarConnections),
  settings: one(userSettings),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  segments: many(activitySegments),
}));

export const weeklyReviewNotesRelations = relations(weeklyReviewNotes, ({ one }) => ({
  user: one(users, {
    fields: [weeklyReviewNotes.userId],
    references: [users.id],
  }),
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

export const googleCalendarConnectionsRelations = relations(googleCalendarConnections, ({ one }) => ({
  user: one(users, {
    fields: [googleCalendarConnections.userId],
    references: [users.id],
  }),
}));

// Focus Buddies table (Accountability Buddy Requests & Connections)
export const focusBuddies = pgTable('focus_buddies', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  receiverUserId: uuid('receiver_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').default('PENDING').notNull(), // 'PENDING' | 'ACCEPTED' | 'DECLINED'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxBuddiesPair: index('idx_buddies_pair').on(table.senderUserId, table.receiverUserId),
  idxBuddiesReceiverStatus: index('idx_buddies_receiver_status').on(table.receiverUserId, table.status),
}));

// Conversations table (1-to-1 Focus Buddy Chat Channels)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  user1Id: uuid('user1_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  user2Id: uuid('user2_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lastMessageContent: text('last_message_content'),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxConversationsPair: index('idx_conversations_pair').on(table.user1Id, table.user2Id),
  idxConversationsUser1: index('idx_conversations_user1').on(table.user1Id),
  idxConversationsUser2: index('idx_conversations_user2').on(table.user2Id),
}));

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  messageType: text('message_type').default('TEXT').notNull(), // 'TEXT' | 'ACTIVITY'
  activityMetadata: jsonb('activity_metadata').default({}),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  idxMessagesConvCreated: index('idx_messages_conv_created').on(table.conversationId, table.createdAt),
  idxMessagesSender: index('idx_messages_sender').on(table.senderUserId),
}));

export const focusBuddiesRelations = relations(focusBuddies, ({ one }) => ({
  sender: one(users, {
    fields: [focusBuddies.senderUserId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [focusBuddies.receiverUserId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user1: one(users, {
    fields: [conversations.user1Id],
    references: [users.id],
  }),
  user2: one(users, {
    fields: [conversations.user2Id],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderUserId],
    references: [users.id],
  }),
}));

// Persistent Auth Sessions table
export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  idxAuthSessionsExpiresAt: index('idx_auth_sessions_expires_at').on(table.expiresAt),
}));

// Persistent User Settings table (one row per user)
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  defaultDuration: integer('default_duration').default(25).notNull(),
  autoResumePause: boolean('auto_resume_pause').default(true).notNull(),
  confirmBeforePause: boolean('confirm_before_pause').default(true).notNull(),
  confirmBeforeEnd: boolean('confirm_before_end').default(false).notNull(),
  defaultCamera: boolean('default_camera').default(true).notNull(),
  defaultScreen: boolean('default_screen').default(true).notNull(),
  defaultCategory: text('default_category').default('ALL').notNull(),
  showFocusScore: boolean('show_focus_score').default(true).notNull(),
  showFocusPoints: boolean('show_focus_points').default(true).notNull(),
  showFocusStreak: boolean('show_focus_streak').default(true).notNull(),
  autoResumeWarning: boolean('auto_resume_warning').default(true).notNull(),
  theme: text('theme').default('dark').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  idxUserSettingsUserId: index('idx_user_settings_user_id').on(table.userId),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));




