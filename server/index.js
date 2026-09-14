import { buildApp } from './app.js';
import { config } from './config/env.js';
import { runMigrations } from './db/migrate.js';

const app = buildApp();

async function start() {
  try {
    // Run database migrations on startup if possible
    try {
      await runMigrations();
    } catch (dbErr) {
      console.warn('[Server Startup Warning] Database migration failed or database unreachable:', dbErr.message);
      console.warn('[Server Startup Warning] Server will start, but database endpoints will respond with DB status errors until PostgreSQL is connected.');
    }

    await app.listen({ port: config.port, host: config.host });
    console.log(`[FocusLens Backend] Fastify server running at http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
