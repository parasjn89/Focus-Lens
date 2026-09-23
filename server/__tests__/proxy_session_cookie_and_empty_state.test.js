import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';

describe('Production Fastify Proxy, Session Cookie & Empty Account State Test Suite', () => {
  let app;
  let testUserId = null;
  let authCookie = null;

  before(async () => {
    app = buildApp({ logger: false });

    // Register a test route before calling app.ready()
    app.get('/api/test-proxy-protocol', async (req) => {
      return {
        protocol: req.protocol,
        isHttps: req.protocol === 'https',
        ip: req.ip,
      };
    });

    await app.ready();
  });

  after(async () => {
    if (testUserId) {
      await dbStore.deleteUser(testUserId).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('1. Fastify respects X-Forwarded-Proto header for HTTPS detection with trustProxy enabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/test-proxy-protocol',
      headers: {
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.protocol, 'https', 'Request protocol must evaluate to https when X-Forwarded-Proto is https');
    assert.equal(body.isHttps, true, 'isHttps must evaluate to true');
  });

  it('2. Without trustProxy, Fastify ignores X-Forwarded-Proto header', async () => {
    const noProxyApp = buildApp({ logger: false, trustProxy: false });
    noProxyApp.get('/api/test-no-proxy', async (req) => {
      return { protocol: req.protocol };
    });
    await noProxyApp.ready();

    const res = await noProxyApp.inject({
      method: 'GET',
      url: '/api/test-no-proxy',
      headers: {
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.protocol, 'http', 'Without trustProxy, protocol defaults to http even with x-forwarded-proto');
    await noProxyApp.close();
  });

  it('3. Registration sets focuslens_session cookie with HttpOnly, SameSite=Lax and Path=/', async () => {
    const unique = `cookie_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: {
        'x-forwarded-proto': 'https',
      },
      payload: {
        name: 'Cookie Test User',
        username: unique,
        email: `${unique}@example.com`,
        password: 'SecurePass12345!',
      },
    });

    assert.equal(regRes.statusCode, 201);
    const body = JSON.parse(regRes.payload);
    testUserId = body.user.id;

    const cookies = regRes.cookies;
    assert.ok(cookies && cookies.length > 0, 'Must return at least one cookie');
    const sessionCookie = cookies.find((c) => c.name === 'focuslens_session');
    assert.ok(sessionCookie, 'Must set focuslens_session cookie');
    assert.equal(sessionCookie.httpOnly, true, 'Session cookie must have HttpOnly: true');
    assert.equal(sessionCookie.path, '/', 'Session cookie must have Path: /');
    assert.equal(sessionCookie.sameSite?.toLowerCase(), 'lax', 'Session cookie must have SameSite: Lax');

    // Store for subsequent authenticated calls
    authCookie = `${sessionCookie.name}=${sessionCookie.value}`;
  });

  it('4. Authenticated GET /api/analytics/dashboard returns valid 200 structure with zero metrics for empty accounts', async () => {
    assert.ok(authCookie, 'Authentication cookie must be present');

    const dashRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard',
      headers: {
        cookie: authCookie,
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(dashRes.statusCode, 200, 'Dashboard must return 200 for empty account');
    const dashBody = JSON.parse(dashRes.payload);
    assert.ok(dashBody.dashboard, 'Dashboard payload must contain dashboard object');
    assert.equal(dashBody.dashboard.today.totalActiveSec, 0, 'today active seconds must be 0 for empty account');
    assert.equal(dashBody.dashboard.focusPoints.total, 0, 'totalFocusPoints must be 0 for empty account');
    assert.ok(Array.isArray(dashBody.dashboard.recentSessions), 'recentSessions must be an array');
    assert.equal(dashBody.dashboard.recentSessions.length, 0);
  });

  it('5. Authenticated GET /api/calendar returns valid 200 calendar structure for empty accounts', async () => {
    assert.ok(authCookie, 'Authentication cookie must be present');

    const calRes = await app.inject({
      method: 'GET',
      url: '/api/calendar?month=2026-09',
      headers: {
        cookie: authCookie,
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(calRes.statusCode, 200, 'Calendar must return 200 for empty account');
    const calBody = JSON.parse(calRes.payload);
    assert.ok(calBody.days, 'Calendar payload must contain days array');
    assert.equal(calBody.monthSummary.totalSessions, 0);
    assert.equal(calBody.monthSummary.totalDurationSec, 0);
  });

  it('6. Authenticated GET /api/messages/conversations returns { conversations: [] } for empty accounts', async () => {
    assert.ok(authCookie, 'Authentication cookie must be present');

    const msgRes = await app.inject({
      method: 'GET',
      url: '/api/messages/conversations',
      headers: {
        cookie: authCookie,
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(msgRes.statusCode, 200, 'Messages must return 200');
    const msgBody = JSON.parse(msgRes.payload);
    assert.ok(Array.isArray(msgBody.conversations), 'conversations must be an array');
    assert.equal(msgBody.conversations.length, 0);
  });

  it('7. Authenticated GET /api/buddies returns valid empty structures for empty accounts', async () => {
    assert.ok(authCookie, 'Authentication cookie must be present');

    const budRes = await app.inject({
      method: 'GET',
      url: '/api/buddies',
      headers: {
        cookie: authCookie,
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(budRes.statusCode, 200, 'Buddies must return 200');
    const budBody = JSON.parse(budRes.payload);
    assert.deepEqual(budBody.buddies, []);
    assert.deepEqual(budBody.pendingRequests, []);
  });

  it('8. Authenticated GET /api/sessions returns { sessions: [] } for empty accounts', async () => {
    assert.ok(authCookie, 'Authentication cookie must be present');

    const sessRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: {
        cookie: authCookie,
        'x-forwarded-proto': 'https',
      },
    });

    assert.equal(sessRes.statusCode, 200, 'Sessions must return 200');
    const sessBody = JSON.parse(sessRes.payload);
    assert.deepEqual(sessBody.sessions, []);
  });

  it('9. Unauthenticated requests return 401 with structured JSON, not 500 or crash', async () => {
    const unauthDash = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard',
    });
    assert.equal(unauthDash.statusCode, 401);
    const unauthBody = JSON.parse(unauthDash.payload);
    assert.equal(unauthBody.statusCode, 401);
    assert.equal(unauthBody.error, 'Unauthorized');

    const unauthCal = await app.inject({
      method: 'GET',
      url: '/api/calendar',
    });
    assert.equal(unauthCal.statusCode, 401);

    const unauthMsg = await app.inject({
      method: 'GET',
      url: '/api/messages/conversations',
    });
    assert.equal(unauthMsg.statusCode, 401);
  });

  it('10. apiFetch formats 401 Unauthorized responses with isAuthError and UNAUTHORIZED code without marking as network error', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: (h) => (h === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required to view dashboard.',
        }),
      });

      const { apiFetch } = await import('../../src/api/client.js');
      await assert.rejects(
        async () => {
          await apiFetch('/api/analytics/dashboard');
        },
        (err) => {
          assert.equal(err.status, 401);
          assert.equal(err.isAuthError, true);
          assert.equal(err.code, 'Unauthorized');
          assert.equal(err.isNetworkError, undefined);
          return true;
        }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('11. fetchSessionsHistory handles 401 without falsely flagging the backend as offline', async () => {
    const originalFetch = global.fetch;
    const originalLocalStorage = global.localStorage;
    try {
      global.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          get: (h) => (h === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required.',
        }),
      });

      global.localStorage = {
        getItem: () => '[]',
        setItem: () => {},
      };

      const { fetchSessionsHistory } = await import('../../src/api/sessionApi.js');
      const res = await fetchSessionsHistory();
      assert.equal(res.isBackendAvailable, true, 'Backend must be marked available when 401 is returned');
      assert.equal(res.isAuthError, true, 'isAuthError must be true when 401 is returned');
      assert.deepEqual(res.sessions, []);
    } finally {
      global.fetch = originalFetch;
      global.localStorage = originalLocalStorage;
    }
  });
});
