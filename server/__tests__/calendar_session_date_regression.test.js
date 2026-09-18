import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { generateCalendarMonthData, formatLocalTime } from '../utils/calendarEngine.js';

test('Calendar Session Date Bug Fix - Authoritative Date Regression Suite', async (t) => {
  let app;
  let testUser;
  let cookie;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Register a test user with valid fields
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Calendar Date Test User',
        username: `cal_reg_${suffix}`,
        email: `cal_reg_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    assert.equal(regRes.statusCode, 201);
    cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
    const regData = JSON.parse(regRes.payload);
    testUser = regData.user;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  let createdLiveSessionId = null;

  await t.test('1. Server overrides historical startedAt (e.g. clicked Sep 15) with authoritative current timestamp', async () => {
    const historicalClickedDate = '2026-09-15T10:00:00.000Z';
    const beforeCall = Date.now();

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie },
      payload: {
        selectedActivity: 'Deep Work Coding',
        plannedDurationMs: 25 * 60 * 1000,
        startedAt: historicalClickedDate, // Stale/historical clicked cell date
      },
    });

    assert.equal(startRes.statusCode, 201);
    const startData = JSON.parse(startRes.payload);
    assert.ok(startData.session);
    assert.ok(startData.session.id);
    createdLiveSessionId = startData.session.id;

    const sessionInDb = await dbStore.getSessionByIdAndUser(startData.session.id, testUser.id);
    assert.ok(sessionInDb);

    const startedAtVal = sessionInDb.startedAt || sessionInDb.started_at;
    const sessionStartedTime = new Date(startedAtVal).getTime();
    const afterCall = Date.now();

    // Verify session started_at is within the current time window, NOT 2026-09-15
    assert.ok(
      sessionStartedTime >= beforeCall - 2000 && sessionStartedTime <= afterCall + 2000,
      `Session started_at (${startedAtVal}) should be approximately ${new Date(beforeCall).toISOString()} and NOT ${historicalClickedDate}`
    );
    assert.notEqual(new Date(startedAtVal).toISOString().slice(0, 10), '2026-09-15');

    // Finalize the session so it is marked COMPLETED for calendar aggregations
    const finalizeRes = await app.inject({
      method: 'PUT',
      url: `/api/sessions/${createdLiveSessionId}`,
      headers: { cookie },
      payload: {
        status: 'COMPLETED',
        actualDurationMs: 25 * 60 * 1000,
      },
    });
    assert.equal(finalizeRes.statusCode, 200);
  });

  await t.test('2. Calendar month aggregation puts session on actual date, keeping clicked date at 0 sessions', async () => {
    const today = new Date();
    const currentYearMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const todayDateStr = `${currentYearMonth}-${String(today.getUTCDate()).padStart(2, '0')}`;

    // Query calendar for current month
    const calRes = await app.inject({
      method: 'GET',
      url: `/api/calendar?month=${currentYearMonth}`,
      headers: {
        cookie,
        'x-timezone-offset': '0',
      },
    });

    assert.equal(calRes.statusCode, 200);
    const calData = JSON.parse(calRes.payload);

    // Verify today's day item has at least 1 session
    const todayDayItem = calData.days.find(d => d.date === todayDateStr);
    assert.ok(todayDayItem, `Day item for today (${todayDateStr}) must exist`);
    assert.ok(todayDayItem.sessionCount >= 1, `Today (${todayDateStr}) must have at least 1 session`);

    // Verify September 15 (if in this month and today is not Sep 15) has 0 sessions
    const sep15DayItem = calData.days.find(d => d.date === '2026-09-15');
    if (sep15DayItem && todayDateStr !== '2026-09-15') {
      assert.equal(sep15DayItem.sessionCount, 0, 'September 15 sessionCount must remain 0');
    }
  });

  await t.test('3. Future dates sent as startedAt (e.g. accidental skew) are also overridden by server time', async () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 1 day in the future

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie },
      payload: {
        selectedActivity: 'Writing',
        plannedDurationMs: 15 * 60 * 1000,
        startedAt: futureDate,
      },
    });

    assert.equal(startRes.statusCode, 201);
    const startData = JSON.parse(startRes.payload);
    const sessionInDb = await dbStore.getSessionByIdAndUser(startData.session.id, testUser.id);
    assert.ok(sessionInDb);

    const startedAtVal = sessionInDb.startedAt || sessionInDb.started_at;
    const sessionStartedTime = new Date(startedAtVal).getTime();
    assert.ok(
      sessionStartedTime <= Date.now() + 1000,
      'Future startedAt must be replaced with server current timestamp'
    );
  });

  await t.test('4. Legitimate historical sessions created directly in dbStore retain their original dates', async () => {
    const legitimateHistoricalDate = '2026-09-15T14:30:00.000Z';
    const historicalSession = await dbStore.createSession({
      userId: testUser.id,
      selectedActivity: 'Historical Reading',
      plannedDurationMs: 30 * 60 * 1000,
      startedAt: legitimateHistoricalDate,
    });

    assert.ok(historicalSession);
    const retrieved = await dbStore.getSessionByIdAndUser(historicalSession.id, testUser.id);
    const startedAtVal = retrieved.startedAt || retrieved.started_at;
    assert.equal(
      new Date(startedAtVal).toISOString(),
      legitimateHistoricalDate,
      'Direct dbStore historical fixture sessions must remain untouched'
    );
  });

  await t.test('5. Calendar engine correctly aggregates across timezone boundaries without shifting day', () => {
    // 2026-09-17 01:00 UTC with UTC+5:30 (offset -330) is 2026-09-17 06:30 AM local
    const earlyMorningUtc = '2026-09-17T01:00:00.000Z';
    const mockSessions = [
      {
        id: 'tz_sess_1',
        selectedActivity: 'Morning Focus',
        plannedDurationMs: 30 * 60 * 1000,
        actualDurationMs: 30 * 60 * 1000,
        status: 'COMPLETED',
        focusPoints: 30,
        startedAt: earlyMorningUtc,
        endedAt: '2026-09-17T01:30:00.000Z',
      }
    ];

    const calData = generateCalendarMonthData(mockSessions, '2026-09', { offsetMinutes: -330 });
    const day17 = calData.days.find(d => d.date === '2026-09-17');
    assert.ok(day17);
    assert.equal(day17.sessionCount, 1);
    assert.equal(day17.sessions[0].startTimeFormatted, '6:30 AM');

    // 2026-09-17 23:30 UTC with UTC-5 (offset +300) is 2026-09-17 06:30 PM local
    const eveningUtc = '2026-09-17T23:30:00.000Z';
    const mockSessions2 = [
      {
        id: 'tz_sess_2',
        selectedActivity: 'Evening Focus',
        plannedDurationMs: 30 * 60 * 1000,
        actualDurationMs: 30 * 60 * 1000,
        status: 'COMPLETED',
        focusPoints: 30,
        startedAt: eveningUtc,
        endedAt: '2026-09-18T00:00:00.000Z',
      }
    ];

    const calData2 = generateCalendarMonthData(mockSessions2, '2026-09', { offsetMinutes: 300 });
    const day17_2 = calData2.days.find(d => d.date === '2026-09-17');
    assert.ok(day17_2);
    assert.equal(day17_2.sessionCount, 1);
    assert.equal(day17_2.sessions[0].startTimeFormatted, '6:30 PM');
  });

  await t.test('6. Session History and Report fetch correct authoritative started_at', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { cookie },
    });
    assert.equal(listRes.statusCode, 200);
    const listData = JSON.parse(listRes.payload);
    assert.ok(Array.isArray(listData.sessions));
    assert.ok(listData.sessions.length >= 2);

    const liveSession = listData.sessions.find(s => s.selectedActivity === 'Deep Work Coding');
    assert.ok(liveSession);
    assert.notEqual(liveSession.startedAt.slice(0, 10), '2026-09-15');
  });
});
