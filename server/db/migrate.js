import pg from 'pg';
import { config } from '../config/env.js';

const INITIAL_DDL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  password_hash TEXT,
  anonymous_id TEXT UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_public_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_number_key;

-- Populate null usernames for existing users deterministically
UPDATE users 
SET username = LOWER(COALESCE(
  NULLIF(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9._]', '_', 'g'), ''),
  'user_' || SUBSTRING(id::text, 1, 8)
))
WHERE username IS NULL OR username = '';

-- Case-insensitive unique index for Username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

-- Case-insensitive unique index for Email (allowing NULL/empty)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL AND email != '';

-- Unique index for Phone Number (allowing NULL/empty)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique ON users (phone_number) WHERE phone_number IS NOT NULL AND phone_number != '';

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_activity TEXT NOT NULL,
  planned_duration_ms INTEGER NOT NULL,
  actual_duration_ms INTEGER DEFAULT 0,
  paused_duration_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  start_time_ms BIGINT NOT NULL,
  end_time_ms BIGINT NOT NULL,
  duration_ms INTEGER NOT NULL,
  evidence_score REAL NOT NULL,
  confidence_type TEXT NOT NULL DEFAULT 'heuristic',
  contributing_signals JSONB DEFAULT '[]'::jsonb,
  explanation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activity_segments' AND column_name = 'confidencetype'
  ) THEN
    ALTER TABLE activity_segments RENAME COLUMN confidencetype TO confidence_type;
  END IF;
END $$;

ALTER TABLE activity_segments ADD COLUMN IF NOT EXISTS confidence_type TEXT NOT NULL DEFAULT 'heuristic';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS goal_text TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS goal_type TEXT DEFAULT 'NONE';
ALTER TABLE sessions ALTER COLUMN goal_type DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS target_unit TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS goal_completed BOOLEAN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS goal_progress NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS intention TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS worked_well TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS got_in_the_way TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS weekly_review_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date TEXT NOT NULL,
  worked_well TEXT,
  made_it_hard TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_segments_session_start ON activity_segments(session_id, start_time_ms);
CREATE INDEX IF NOT EXISTS idx_weekly_notes_user_week ON weekly_review_notes(user_id, week_start_date);

-- Safe one-time historical reconciliation: clean up any abandoned historical ACTIVE sessions
UPDATE sessions
SET status = 'COMPLETED',
    actual_duration_ms = CASE
      WHEN actual_duration_ms > 0 THEN actual_duration_ms
      ELSE LEAST(planned_duration_ms, GREATEST(1000, EXTRACT(EPOCH FROM (COALESCE(ended_at, updated_at, started_at) - started_at)) * 1000))
    END,
    ended_at = COALESCE(ended_at, started_at + (LEAST(planned_duration_ms, GREATEST(1000, EXTRACT(EPOCH FROM (COALESCE(ended_at, updated_at, started_at) - started_at)) * 1000)) || ' milliseconds')::interval),
    updated_at = NOW()
WHERE status = 'ACTIVE'
  AND (started_at < NOW() - INTERVAL '1 hour' OR ended_at IS NOT NULL);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Other',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at);

CREATE TABLE IF NOT EXISTS focus_buddies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buddies_pair ON focus_buddies(sender_user_id, receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_buddies_receiver_status ON focus_buddies(receiver_user_id, status);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_content TEXT,
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_pair ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT',
  activity_metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_user_id);

CREATE TABLE IF NOT EXISTS google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'google',
  google_account_email TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  scope TEXT,
  token_expiry TIMESTAMP,
  calendar_id TEXT DEFAULT 'primary',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_cal_user ON google_calendar_connections(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(128) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  default_duration INTEGER NOT NULL DEFAULT 25,
  auto_resume_pause BOOLEAN NOT NULL DEFAULT true,
  confirm_before_pause BOOLEAN NOT NULL DEFAULT true,
  confirm_before_end BOOLEAN NOT NULL DEFAULT false,
  default_camera BOOLEAN NOT NULL DEFAULT true,
  default_screen BOOLEAN NOT NULL DEFAULT true,
  default_category TEXT NOT NULL DEFAULT 'ALL',
  show_focus_score BOOLEAN NOT NULL DEFAULT true,
  show_focus_points BOOLEAN NOT NULL DEFAULT true,
  show_focus_streak BOOLEAN NOT NULL DEFAULT true,
  auto_resume_warning BOOLEAN NOT NULL DEFAULT true,
  theme TEXT NOT NULL DEFAULT 'dark',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
`;

export async function runMigrations() {
  console.log('[DB Migrate] Connecting to PostgreSQL at target DATABASE_URL...');

  let dbUrl;
  try {
    dbUrl = new URL(config.databaseUrl);
  } catch (err) {
    console.warn('[DB Migrate Warning] Could not parse DATABASE_URL with standard URL class, using raw connection string.');
  }

  const targetClient = new pg.Client({ connectionString: config.databaseUrl });
  try {
    await targetClient.connect();
    console.log('[DB Migrate] Successfully connected to target database. Applying DDL schema...');
    await targetClient.query(INITIAL_DDL);
    console.log('[DB Migrate] Schema migration complete! Tables ready: users, sessions, activity_segments.');
    await targetClient.end().catch(() => {});
    return;
  } catch (err) {
    await targetClient.end().catch(() => {});

    if (err.code === '3D000' && dbUrl) {
      const dbName = dbUrl.pathname.slice(1) || 'focuslens';
      dbUrl.pathname = '/postgres';
      const rootClient = new pg.Client({ connectionString: dbUrl.toString() });

      try {
        await rootClient.connect();
        console.log(`[DB Migrate] Database "${dbName}" does not exist. Creating...`);
        await rootClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`[DB Migrate] Database "${dbName}" created successfully.`);
        await rootClient.end().catch(() => {});

        const retryClient = new pg.Client({ connectionString: config.databaseUrl });
        await retryClient.connect();
        await retryClient.query(INITIAL_DDL);
        await retryClient.end().catch(() => {});
        console.log('[DB Migrate] Schema migration complete! Tables ready: users, sessions, activity_segments.');
        return;
      } catch (rootErr) {
        await rootClient.end().catch(() => {});
        console.error(`[DB Migrate Error] Root database creation attempt failed:`, rootErr.message);
        throw rootErr;
      }
    }

    console.error('[DB Migrate Error] Migration failed:', err.message);
    throw err;
  }
}

if (process.argv[1]?.includes('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('[DB Migrate] Migration task completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB Migrate] Execution failed:', err);
      process.exit(1);
    });
}
