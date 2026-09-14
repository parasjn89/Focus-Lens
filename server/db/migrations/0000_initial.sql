CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
