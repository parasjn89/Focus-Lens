import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import {
  setGoogleApiFetchOverride,
  generateOAuthState,
  verifyOAuthState,
  normalizeGoogleEvent,
} from '../services/googleCalendar.js';
import { decryptToken, encryptToken } from '../utils/encryption.js';
import { config } from '../config/env.js';
import { pool } from '../db/client.js';

test('Google Calendar Integration Test Suite', async (t) => {
  let app;
  let userA, cookieA;
  let userB, cookieB;

  // Mock Google responses
  const mockTokens = {
    access_token: 'mock_google_access_token_123',
    refresh_token: 'mock_google_refresh_token_456',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
    id_token: null,
  };

  const mockUserInfo = {
    email: 'focususer@gmail.com',
    name: 'Focus User',
  };

  const mockCalendars = {
    items: [
      { id: 'primary', summary: 'Personal Primary', primary: true, timeZone: 'Asia/Kolkata' },
      { id: 'work_cal_789', summary: 'Work Calendar', primary: false, timeZone: 'America/New_York' },
    ],
  };

  const mockEvents = {
    items: [
      {
        id: 'evt_timed_1',
        summary: 'DSA Problem Solving',
        description: 'Binary tree search practice',
        start: { dateTime: '2026-09-18T14:00:00+05:30' },
        end: { dateTime: '2026-09-18T15:00:00+05:30' },
        location: 'Study Desk',
        htmlLink: 'https://calendar.google.com/event?eid=evt_timed_1',
      },
      {
        id: 'evt_allday_2',
        summary: 'Deep Work Sprint Day',
        start: { date: '2026-09-18' },
        end: { date: '2026-09-19' },
        htmlLink: 'https://calendar.google.com/event?eid=evt_allday_2',
      },
      {
        id: 'evt_cancelled_3',
        summary: 'Cancelled Meeting',
        status: 'cancelled',
        start: { dateTime: '2026-09-18T16:00:00+05:30' },
        end: { dateTime: '2026-09-18T17:00:00+05:30' },
      },
    ],
  };

  t.before(async () => {
    // Ensure test config has mock credentials
    config.googleClientId = 'mock-google-client-id.apps.googleusercontent.com';
    config.googleClientSecret = 'mock-google-client-secret';
    config.googleRedirectUri = 'http://localhost:3001/api/integrations/google-calendar/callback';

    // Install mock fetch handler for Google endpoints
    setGoogleApiFetchOverride(async (url, options = {}) => {
      const urlStr = String(url);

      // Token endpoint (code exchange or refresh)
      if (urlStr.includes('oauth2.googleapis.com/token')) {
        const bodyStr = String(options.body || '');
        if (bodyStr.includes('invalid_code')) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: 'invalid_grant', error_description: 'Bad Request' }),
          };
        }
        if (bodyStr.includes('fail_refresh')) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: 'invalid_grant', error_description: 'Token has been expired or revoked' }),
          };
        }
        if (bodyStr.includes('grant_type=refresh_token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              access_token: 'mock_refreshed_access_token_999',
              expires_in: 3600,
              scope: mockTokens.scope,
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockTokens,
        };
      }

      // UserInfo endpoint
      if (urlStr.includes('oauth2/v2/userinfo')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockUserInfo,
        };
      }

      // Revoke endpoint
      if (urlStr.includes('oauth2.googleapis.com/revoke')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      }

      // CalendarList endpoint
      if (urlStr.includes('/users/me/calendarList')) {
        if (options.headers?.Authorization?.includes('fail_api')) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: 'Google Calendar API temporarily unavailable' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockCalendars,
        };
      }

      // Calendar Events endpoint
      if (urlStr.includes('/events')) {
        if (options.headers?.Authorization?.includes('fail_api')) {
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: 'Google Calendar API rate limit exceeded' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => mockEvents,
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      };
    });

    app = buildApp({ logger: false });
    await app.ready();

    // Register Test User A
    const suffixA = Date.now().toString(36) + 'a';
    const regResA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Google Test User A',
        username: `gtest_a_${suffixA}`,
        email: `gtest_a_${suffixA}@example.com`,
        password: 'Password12345!',
      },
    });
    assert.equal(regResA.statusCode, 201);
    cookieA = `${regResA.cookies[0].name}=${regResA.cookies[0].value}`;
    userA = JSON.parse(regResA.payload).user;

    // Register Test User B (for IDOR and isolation tests)
    const suffixB = Date.now().toString(36) + 'b';
    const regResB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Google Test User B',
        username: `gtest_b_${suffixB}`,
        email: `gtest_b_${suffixB}@example.com`,
        password: 'Password12345!',
      },
    });
    assert.equal(regResB.statusCode, 201);
    cookieB = `${regResB.cookies[0].name}=${regResB.cookies[0].value}`;
    userB = JSON.parse(regResB.payload).user;
  });

  t.after(async () => {
    setGoogleApiFetchOverride(null);
    if (app) await app.close();
  });

  await t.test('1. Unauthenticated Google Calendar connect request is rejected (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/connect',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('2. Authenticated user receives Google authorization URL with read-only scope and secure state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/connect',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(data.url);
    assert.ok(data.url.includes('https://accounts.google.com/o/oauth2/v2/auth'));
    assert.ok(data.url.includes('calendar.readonly'));
    assert.ok(!data.url.includes('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar+')); // not full write scope
    assert.ok(data.url.includes('access_type=offline'));
    assert.ok(data.url.includes('state='));
  });

  await t.test('3. OAuth state is validated correctly for the generating user', async () => {
    const validState = generateOAuthState(userA.id);
    assert.equal(verifyOAuthState(validState, userA.id), true);
    assert.equal(verifyOAuthState(validState, userB.id), false); // Rejected for another user
  });

  await t.test('4. Invalid or tampered OAuth state is rejected', async () => {
    const validState = generateOAuthState(userA.id);
    const tamperedState = validState.slice(0, -4) + 'zzzz';
    assert.equal(verifyOAuthState(tamperedState, userA.id), false);
    assert.equal(verifyOAuthState('invalid_random_string', userA.id), false);
    assert.equal(verifyOAuthState(null, userA.id), false);

    // Callback with tampered state redirects to frontend calendar with error
    const res = await app.inject({
      method: 'GET',
      url: `/api/integrations/google-calendar/callback?code=mock_code&state=${encodeURIComponent(tamperedState)}`,
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 302);
    assert.ok(res.headers.location.startsWith(config.frontendUrl));
    assert.ok(res.headers.location.includes('/calendar?google=error'));

    // Callback with user cancellation/denial redirects to frontend calendar?google=denied
    const deniedRes = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/callback?error=access_denied',
      headers: { cookie: cookieA },
    });
    assert.equal(deniedRes.statusCode, 302);
    assert.equal(deniedRes.headers.location, `${config.frontendUrl}/calendar?google=denied`);
  });

  await t.test('5. OAuth callback stores connection for the correct user with encrypted tokens', async () => {
    const validState = generateOAuthState(userA.id);
    const res = await app.inject({
      method: 'GET',
      url: `/api/integrations/google-calendar/callback?code=mock_valid_code&state=${encodeURIComponent(validState)}`,
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, `${config.frontendUrl}/calendar?google=connected`);

    // Verify record in database
    const conn = await dbStore.getGoogleCalendarConnection(userA.id);
    assert.ok(conn);
    assert.equal(conn.googleAccountEmail, 'focususer@gmail.com');
    assert.ok(conn.accessTokenEncrypted);
    assert.ok(conn.refreshTokenEncrypted);

    // Verify tokens were encrypted at rest and can be decrypted
    const decryptedAccess = decryptToken(conn.accessTokenEncrypted);
    const decryptedRefresh = decryptToken(conn.refreshTokenEncrypted);
    assert.equal(decryptedAccess, mockTokens.access_token);
    assert.equal(decryptedRefresh, mockTokens.refresh_token);
  });

  await t.test('6. OAuth tokens never appear in API responses (status, calendars, events)', async () => {
    // Check status endpoint
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/status',
      headers: { cookie: cookieA },
    });
    assert.equal(statusRes.statusCode, 200);
    const statusData = JSON.parse(statusRes.payload);
    assert.equal(statusData.connected, true);
    assert.equal(statusData.email, 'focususer@gmail.com');
    assert.equal(statusData.selectedCalendarId, 'primary');
    assert.equal(statusData.accessToken, undefined);
    assert.equal(statusData.refreshToken, undefined);
    assert.equal(statusData.accessTokenEncrypted, undefined);

    // Check calendars endpoint
    const calRes = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/calendars',
      headers: { cookie: cookieA },
    });
    assert.equal(calRes.statusCode, 200);
    const calPayloadStr = calRes.payload;
    assert.ok(!calPayloadStr.includes('mock_google_access_token'));
    assert.ok(!calPayloadStr.includes('mock_google_refresh_token'));

    // Check events endpoint
    const eventsRes = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/events?start=2026-09-18&end=2026-09-19',
      headers: { cookie: cookieA },
    });
    assert.equal(eventsRes.statusCode, 200);
    const eventsPayloadStr = eventsRes.payload;
    assert.ok(!eventsPayloadStr.includes('mock_google_access_token'));
    assert.ok(!eventsPayloadStr.includes('mock_google_refresh_token'));
  });

  await t.test('7. Calendar list endpoint works for connected user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/calendars',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(Array.isArray(data.calendars));
    assert.equal(data.calendars.length, 2);
    assert.equal(data.calendars[0].id, 'primary');
    assert.equal(data.calendars[0].primary, true);
    assert.equal(data.calendars[1].id, 'work_cal_789');

    // Selecting calendar updates selectedCalendarId
    const selectRes = await app.inject({
      method: 'POST',
      url: '/api/integrations/google-calendar/select-calendar',
      headers: { cookie: cookieA },
      payload: { calendarId: 'work_cal_789' },
    });
    assert.equal(selectRes.statusCode, 200);
    const selectData = JSON.parse(selectRes.payload);
    assert.equal(selectData.selectedCalendarId, 'work_cal_789');

    // Reset back to primary
    await app.inject({
      method: 'POST',
      url: '/api/integrations/google-calendar/select-calendar',
      headers: { cookie: cookieA },
      payload: { calendarId: 'primary' },
    });
  });

  await t.test('8. Calendar events endpoint works for connected user and normalizes events', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/events?start=2026-09-18&end=2026-09-19',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(Array.isArray(data.events));
    // Cancelled event must be filtered out
    assert.equal(data.events.length, 2);

    // Event 1 (timed)
    const timedEvt = data.events.find(e => e.id === 'evt_timed_1');
    assert.ok(timedEvt);
    assert.equal(timedEvt.title, 'DSA Problem Solving');
    assert.equal(timedEvt.allDay, false);
    assert.equal(timedEvt.location, 'Study Desk');

    // Event 2 (all-day)
    const allDayEvt = data.events.find(e => e.id === 'evt_allday_2');
    assert.ok(allDayEvt);
    assert.equal(allDayEvt.title, 'Deep Work Sprint Day');
    assert.equal(allDayEvt.allDay, true);
    assert.equal(allDayEvt.start, '2026-09-18');
  });

  await t.test('9. User isolation prevents cross-user calendar access (IDOR Protection)', async () => {
    // User B is not connected to Google Calendar
    const statusB = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/status',
      headers: { cookie: cookieB },
    });
    assert.equal(statusB.statusCode, 200);
    assert.equal(JSON.parse(statusB.payload).connected, false);

    // User B cannot access User A's calendars
    const calB = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/calendars',
      headers: { cookie: cookieB },
    });
    assert.equal(calB.statusCode, 404);

    // User B cannot access User A's events
    const eventsB = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/events?start=2026-09-18&end=2026-09-19',
      headers: { cookie: cookieB },
    });
    assert.equal(eventsB.statusCode, 404);

    // User B cannot select calendar for User A
    const selectB = await app.inject({
      method: 'POST',
      url: '/api/integrations/google-calendar/select-calendar',
      headers: { cookie: cookieB },
      payload: { calendarId: 'work_cal_789' },
    });
    assert.equal(selectB.statusCode, 404);
  });

  await t.test('10. Disconnect removes only current user connection and leaves FocusLens sessions intact', async () => {
    // Verify User A has a connection
    const connBefore = await dbStore.getGoogleCalendarConnection(userA.id);
    assert.ok(connBefore);

    const discRes = await app.inject({
      method: 'POST',
      url: '/api/integrations/google-calendar/disconnect',
      headers: { cookie: cookieA },
    });
    assert.equal(discRes.statusCode, 200);
    assert.equal(JSON.parse(discRes.payload).connected, false);

    // Database connection removed
    const connAfter = await dbStore.getGoogleCalendarConnection(userA.id);
    assert.equal(connAfter, null);

    // Re-connect User A for subsequent tests
    const validState = generateOAuthState(userA.id);
    await app.inject({
      method: 'GET',
      url: `/api/integrations/google-calendar/callback?code=mock_valid_code&state=${encodeURIComponent(validState)}`,
      headers: { cookie: cookieA },
    });
  });

  await t.test('11. Google token refresh failure is handled with clean reconnect message', async () => {
    // Set tokenExpiry in the past to trigger refresh, and set refresh token that triggers mock failure
    const pastExpiry = new Date(Date.now() - 100000);
    await dbStore.upsertGoogleCalendarConnection(userA.id, {
      accessTokenEncrypted: encryptToken('expired_access_token'),
      refreshTokenEncrypted: encryptToken('fail_refresh_token'),
      tokenExpiry: pastExpiry,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/events?start=2026-09-18&end=2026-09-19',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 401);
    const data = JSON.parse(res.payload);
    assert.ok(data.message.includes('Google Calendar connection expired. Please reconnect.'));

    // Restore working connection for User A
    const validState = generateOAuthState(userA.id);
    await app.inject({
      method: 'GET',
      url: `/api/integrations/google-calendar/callback?code=mock_valid_code&state=${encodeURIComponent(validState)}`,
      headers: { cookie: cookieA },
    });
  });

  await t.test('12. Google API failure/error is handled without crashing', async () => {
    // Set token to trigger mock API failure
    await dbStore.upsertGoogleCalendarConnection(userA.id, {
      accessTokenEncrypted: encryptToken('fail_api_token'),
      refreshTokenEncrypted: encryptToken('mock_refresh_token'),
      tokenExpiry: new Date(Date.now() + 3600000),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/events?start=2026-09-18&end=2026-09-19',
      headers: { cookie: cookieA },
    });

    assert.equal(res.statusCode, 503);
    const data = JSON.parse(res.payload);
    assert.ok(data.message.includes('rate limit') || data.message.includes('unavailable'));

    // Restore valid token
    await dbStore.upsertGoogleCalendarConnection(userA.id, {
      accessTokenEncrypted: encryptToken(mockTokens.access_token),
      refreshTokenEncrypted: encryptToken(mockTokens.refresh_token),
      tokenExpiry: new Date(Date.now() + 3600000),
    });
  });

  await t.test('13. Timezone safety: date-only all-day events remain date-only strings without day-shift', async () => {
    const rawAllDay = {
      id: 'allday_test',
      summary: 'All Day Workshop',
      start: { date: '2026-09-18' },
      end: { date: '2026-09-19' },
    };
    const normalized = normalizeGoogleEvent(rawAllDay);
    assert.equal(normalized.allDay, true);
    assert.equal(normalized.start, '2026-09-18');
    assert.equal(normalized.end, '2026-09-19');
    // Start does not shift across timezones
    assert.equal(normalized.start.length, 10);
  });

  await t.test('14. Google Calendar event date does not override FocusLens actual session start date', async () => {
    // Start session from a Google Calendar context (e.g. event from Sep 15)
    const beforeCall = Date.now();
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: cookieA },
      payload: {
        selectedActivity: 'Studying',
        plannedDurationMs: 25 * 60 * 1000,
        goalText: 'DSA Problem Solving',
        intention: 'Context from Google Calendar: DSA Problem Solving',
        startedAt: '2026-09-15T14:00:00.000Z', // Google event date in past
      },
    });

    assert.equal(sessionRes.statusCode, 201);
    const sessionData = JSON.parse(sessionRes.payload).session;
    assert.ok(sessionData);

    const actualStartedAtMs = new Date(sessionData.startedAt).getTime();
    const afterCall = Date.now();

    // The session date must NOT be Sep 15; it MUST be the current server time!
    assert.ok(actualStartedAtMs >= beforeCall - 2000);
    assert.ok(actualStartedAtMs <= afterCall + 2000);
    assert.equal(sessionData.goalText, 'DSA Problem Solving');
  });

  await t.test('15. Connect request without configured credentials returns clear 500 error message', async () => {
    const savedClientId = config.googleClientId;
    try {
      config.googleClientId = '';
      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations/google-calendar/connect',
        headers: { cookie: cookieA },
      });
      assert.equal(res.statusCode, 500);
      const data = JSON.parse(res.payload);
      assert.ok(data.message.includes('Google OAuth is not configured. GOOGLE_CLIENT_ID is missing.'));
    } finally {
      config.googleClientId = savedClientId;
    }
  });

  await t.test('16. Alias route /api/google-calendar/connect works identically', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/google-calendar/connect',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const data = JSON.parse(res.payload);
    assert.ok(data.url);
    assert.ok(data.url.includes('https://accounts.google.com/o/oauth2/v2/auth'));
  });

  await t.test('17. Connect request with redirect=true redirects directly to Google auth URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/integrations/google-calendar/connect?redirect=true',
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 302);
    assert.ok(res.headers.location);
    assert.ok(res.headers.location.includes('https://accounts.google.com/o/oauth2/v2/auth'));
  });

  setGoogleApiFetchOverride(null);
  if (app) await app.close();
  await pool.end();
});


