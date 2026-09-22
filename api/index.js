import { buildApp } from '../server/app.js';

let appInstance = null;

async function getApp() {
  if (!appInstance) {
    appInstance = buildApp({ logger: false });
    await appInstance.ready();
  }
  return appInstance;
}

/**
 * Vercel Serverless Function entry point for FocusLens API
 */
export default async function handler(req, res) {
  try {
    const app = await getApp();
    app.server.emit('request', req, res);
  } catch (err) {
    console.error('[Vercel Serverless Function Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message || 'Server initialization failed',
        })
      );
    }
  }
}
