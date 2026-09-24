import { EventEmitter } from 'node:events';
import { pool, checkDbConnection } from '../db/client.js';

/**
 * PostgreSQL-backed Session Store for @fastify/session.
 * Persists authenticated session state in Neon/PostgreSQL across Vercel serverless functions,
 * container recycles, and cold starts, with in-memory fallback for offline test environments.
 */
export class PostgresSessionStore extends EventEmitter {
  constructor({ poolInstance = pool, checkConnectionFn = checkDbConnection } = {}) {
    super();
    this.pool = poolInstance;
    this.checkConnection = checkConnectionFn;
    this.memoryStore = new Map();
    this.tableEnsured = false;
  }

  async ensureTable() {
    if (this.tableEnsured || !this.pool) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id VARCHAR(128) PRIMARY KEY,
          data JSONB NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
      `);
      this.tableEnsured = true;
    } catch (e) {
      // Non-fatal, will retry on next operation
    }
  }

  set(sessionId, session, callback) {
    (async () => {
      try {
        const isConnected = this.checkConnection ? await this.checkConnection() : Boolean(this.pool);
        if (isConnected && this.pool) {
          await this.ensureTable();

          const expiresAt = session.cookie?.expires
            ? new Date(session.cookie.expires)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          const dataToStore = {};
          for (const [k, v] of Object.entries(session)) {
            if (typeof v !== 'function' && typeof v !== 'symbol') {
              dataToStore[k] = v;
            }
          }
          if (session.cookie && typeof session.cookie.toJSON === 'function') {
            dataToStore.cookie = session.cookie.toJSON();
          }

          await this.pool.query(
            `INSERT INTO auth_sessions (id, data, expires_at, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (id) DO UPDATE
             SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
            [sessionId, JSON.stringify(dataToStore), expiresAt]
          );

          this.memoryStore.set(sessionId, dataToStore);
          return callback ? callback(null) : undefined;
        }
      } catch (err) {
        // Fallback to volatile in-memory store
      }

      this.memoryStore.set(sessionId, session);
      if (callback) callback(null);
    })().catch((err) => {
      if (callback) callback(err);
    });
  }

  get(sessionId, callback) {
    (async () => {
      try {
        const isConnected = this.checkConnection ? await this.checkConnection() : Boolean(this.pool);
        if (isConnected && this.pool) {
          await this.ensureTable();

          const res = await this.pool.query(
            `SELECT data FROM auth_sessions WHERE id = $1 AND expires_at > NOW()`,
            [sessionId]
          );

          if (res.rows.length > 0) {
            const data = typeof res.rows[0].data === 'string'
              ? JSON.parse(res.rows[0].data)
              : res.rows[0].data;
            return callback ? callback(null, data) : undefined;
          }
          return callback ? callback(null, null) : undefined;
        }
      } catch (err) {
        // Fallback to volatile in-memory store
      }

      const mem = this.memoryStore.get(sessionId) || null;
      if (callback) callback(null, mem);
    })().catch((err) => {
      if (callback) callback(err);
    });
  }

  destroy(sessionId, callback) {
    (async () => {
      this.memoryStore.delete(sessionId);
      try {
        const isConnected = this.checkConnection ? await this.checkConnection() : Boolean(this.pool);
        if (isConnected && this.pool) {
          await this.pool.query(
            `DELETE FROM auth_sessions WHERE id = $1`,
            [sessionId]
          );
        }
      } catch (err) {
        // Non-fatal
      }

      if (callback) callback(null);
    })().catch((err) => {
      if (callback) callback(err);
    });
  }
}

export const postgresSessionStore = new PostgresSessionStore();
