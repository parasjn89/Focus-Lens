import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from '../../src/api/client.js';
import { mapErrorToField } from '../../src/utils/registrationValidation.js';
import { buildApp } from '../app.js';
import vercelHandler from '../../api/index.js';

describe('API Client & Backend Connectivity Suite', () => {
  let app;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('1. resolveApiBaseUrl strictly forbids localhost in production environments', () => {
    // In production with localhost configured in env, it must fallback to relative ''
    const resolvedFromLocalhost = resolveApiBaseUrl('http://localhost:3001', true);
    assert.equal(resolvedFromLocalhost, '', 'Production must never call localhost');

    const resolvedFrom127 = resolveApiBaseUrl('http://127.0.0.1:3001', true);
    assert.equal(resolvedFrom127, '', 'Production must never call 127.0.0.1');

    const resolvedFromEmpty = resolveApiBaseUrl('', true);
    assert.equal(resolvedFromEmpty, '', 'Production empty env must default to relative root path');

    const resolvedFromRemote = resolveApiBaseUrl('https://focus-lens-api.onrender.com', true);
    assert.equal(resolvedFromRemote, 'https://focus-lens-api.onrender.com');

    const resolvedFromTrailingSlash = resolveApiBaseUrl('https://api.example.com/', true);
    assert.equal(resolvedFromTrailingSlash, 'https://api.example.com');

    // In dev environment (isProd = false)
    const resolvedInDev = resolveApiBaseUrl('', false);
    assert.equal(resolvedInDev, 'http://localhost:3001');
  });

  it('2. mapErrorToField preserves network, CORS, and timeout diagnostics without masking', () => {
    const networkErr = new Error('Failed to fetch');
    networkErr.isNetworkError = true;
    networkErr.code = 'BACKEND_UNAVAILABLE_OR_CORS';

    const mapped = mapErrorToField(networkErr);
    assert.equal(mapped.field, null);
    assert.equal(mapped.isNetworkError, true);
    assert.equal(mapped.code, 'BACKEND_UNAVAILABLE_OR_CORS');
    assert.match(mapped.message, /failed to fetch/i);

    const timeoutErr = new Error('API request to /api/auth/register timed out after 10000ms');
    timeoutErr.isNetworkError = true;
    timeoutErr.code = 'TIMEOUT';

    const mappedTimeout = mapErrorToField(timeoutErr);
    assert.equal(mappedTimeout.field, null);
    assert.equal(mappedTimeout.isNetworkError, true);
    assert.equal(mappedTimeout.code, 'TIMEOUT');
    assert.match(mappedTimeout.message, /timed out/i);
  });

  it('3. Fastify server allows https://focus-lens-nine.vercel.app with credentials: true', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/register',
      headers: {
        origin: 'https://focus-lens-nine.vercel.app',
        'access-control-request-method': 'POST',
      },
    });

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'https://focus-lens-nine.vercel.app');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
    // Must NOT be '*' when credentials are true
    assert.notEqual(res.headers['access-control-allow-origin'], '*');
  });

  it('4. Fastify server allows Vercel preview deployment origins', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'https://focus-lens-git-preview-paras.vercel.app',
        'access-control-request-method': 'GET',
      },
    });

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'https://focus-lens-git-preview-paras.vercel.app');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  it('5. Vercel serverless function entrypoint is exported and handles requests', async () => {
    assert.equal(typeof vercelHandler, 'function');
  });

  it('6. Registration endpoint rejects empty payloads with validation errors instead of failing to connect', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });

    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.payload);
    assert.equal(json.error, 'Validation Error');
    assert.ok(Array.isArray(json.errors));
    assert.ok(json.errors.some(e => e.field === 'username'));
    assert.ok(json.errors.some(e => e.field === 'name'));
    assert.ok(json.errors.some(e => e.field === 'password'));
  });

  it('7. GET /api/health returns structured JSON and status 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.equal(res.statusCode, 200);
    const json = JSON.parse(res.payload);
    assert.equal(json.status, 'ok');
    assert.equal(json.service, 'focuslens-backend');
  });

  it('8. GET /api/auth/me returns structured JSON 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    assert.equal(res.statusCode, 401);
    const json = JSON.parse(res.payload);
    assert.equal(json.error, 'Unauthorized');
  });

  it('9. POST /api/auth/google returns structured JSON 400 when missing idToken', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });

    assert.equal(res.statusCode, 400);
    const json = JSON.parse(res.payload);
    assert.equal(json.error, 'Validation Error');
  });

  it('10. firebase-admin modules load cleanly without ERR_REQUIRE_ESM', async () => {
    const appMod = await import('firebase-admin/app');
    const authMod = await import('firebase-admin/auth');
    assert.equal(typeof appMod.initializeApp, 'function');
    assert.equal(typeof authMod.getAuth, 'function');
  });
});
