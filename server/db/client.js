import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { config } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning]', err.message);
});

export const db = drizzle(pool, { schema });

export async function checkDbConnection() {
  try {
    const client = await pool.connect();
    try {
      await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_points INTEGER DEFAULT 0 NOT NULL;');
      await client.query(`
        CREATE TABLE IF NOT EXISTS google_calendar_connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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
      `);
    } catch (e) {
      // Ignore if table not yet created
    }
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}
