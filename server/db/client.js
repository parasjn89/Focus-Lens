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
    } catch (e) {
      // Ignore if table not yet created
    }
    client.release();
    return true;
  } catch (err) {
    return false;
  }
}
