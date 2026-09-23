-- Migration: 0001_google_calendar_connections
-- Creates per-user Google Calendar OAuth connection and encrypted token storage

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
