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
  const app = await getApp();
  app.server.emit('request', req, res);
}
