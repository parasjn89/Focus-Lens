import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('FocusLens Vercel SPA Routing Configuration Test Suite', () => {
  const vercelConfigPath = path.resolve(projectRoot, 'vercel.json');

  it('1. vercel.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist at project root');
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    assert.ok(json, 'vercel.json must be valid JSON');
    assert.ok(Array.isArray(json.rewrites), 'vercel.json must contain rewrites array');
  });

  it('2. SPA rewrite rule rewrites all application routes to /index.html', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    assert.ok(spaRewrite, 'Must contain a rewrite targeting /index.html');

    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const clientRoutes = [
      '/',
      '/login',
      '/register',
      '/dashboard',
      '/history',
      '/calendar',
      '/options',
      '/session/setup',
      '/active-session',
      '/active',
      '/report',
      '/coach',
      '/consistency',
      '/recommendations',
      '/weekly-review',
      '/journal',
      '/profile',
      '/verify',
      '/forgot-password',
      '/tasks',
    ];

    for (const route of clientRoutes) {
      assert.equal(
        sourceRegex.test(route),
        true,
        `Route "${route}" should match SPA rewrite to /index.html`
      );
    }
  });

  it('3. SPA rewrite rule preserves static assets, favicons, images, and files with extensions', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const staticFiles = [
      '/assets/index-Dvgqfen4.js',
      '/assets/index-DedslEj1.css',
      '/assets/purify.es-DDpmou9H.js',
      '/favicon.svg',
      '/favicon.ico',
      '/boy-studying.png',
      '/robots.txt',
      '/manifest.json',
      '/assets/vendor.js.map',
    ];

    for (const file of staticFiles) {
      assert.equal(
        sourceRegex.test(file),
        false,
        `Static asset "${file}" must NOT be rewritten to /index.html`
      );
    }
  });

  it('4. SPA rewrite rule preserves backend /api routes', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const apiRoutes = [
      '/api/auth/me',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/firebase-phone',
      '/api/auth/google',
      '/api/sessions',
      '/api/health',
      '/api/analytics/consistency',
      '/api/weekly-review',
    ];

    for (const route of apiRoutes) {
      assert.equal(
        sourceRegex.test(route),
        false,
        `API route "${route}" must NOT be rewritten to /index.html`
      );
    }
  });
});
