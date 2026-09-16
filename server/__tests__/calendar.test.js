import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { generateCalendarMonthData, formatLocalTime } from '../utils/calendarEngine.js';

test('Calendar Page & API Functionality Test Suite', async (t) => {
  let app;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Helper formatLocalTime converts timestamp accurately with timezone offset', () => {
    // 2026-09-16T05:00:00Z -> with offset -330 (UTC+5:30) is 10:30 AM
    const formatted = formatLocalTime('2026-09-16T05:00:00Z', -330);
    assert.equal(formatted, '10:30 AM');

    // 2026-09-16T18:45:00Z -> with offset -330 is 12:15 AM next day
    const formattedEvening = formatLocalTime('2026-09-16T18:45:00Z', -330);
    assert.equal(formattedEvening, '12:15 AM');
  });

  await t.test('2. generateCalendarMonthData handles empty sessions list cleanly', () => {
    const data = generateCalendarMonthData([], '2026-09', { offsetMinutes: 0 });
    assert.equal(data.month, '2026-09');
    assert.equal(data.monthName, 'September 2026');
    assert.equal(data.daysInMonth, 30);
    assert.equal(data.days.length, 30);
    assert.equal(data.monthSummary.totalSessions, 0);
    assert.equal(data.monthSummary.totalDurationSec, 0);
    assert.equal(data.monthSummary.activeDaysCount, 0);
    assert.equal(data.monthSummary.totalGoalsCompleted, 0);

    // Verify each day is initialized
    assert.equal(data.days[0].date, '2026-09-01');
    assert.equal(data.days[0].sessionCount, 0);
    assert.equal(data.days[29].date, '2026-09-30');
  });

  await t.test('3. generateCalendarMonthData accurately categorizes sessions and tasks', () => {
    const mockSessions = [
      {
        id: 'sess_1',
        selectedActivity: 'Studying',
        plannedDurationMs: 25 * 60 * 1000,
        actualDurationMs: 25 * 60 * 1000,
        status: 'COMPLETED',
        focusPoints: 25,
        goalText: null,
        goalType: 'NONE',
        startedAt: '2026-09-15T09:00:00Z',
        endedAt: '2026-09-15T09:25:00Z',
      },
      {
        id: 'sess_2',
        selectedActivity: 'Coding',
        plannedDurationMs: 50 * 60 * 1000,
        actualDurationMs: 50 * 60 * 1000,
        status: 'COMPLETED',
        focusPoints: 50,
        goalText: 'Complete 3 algorithms',
        goalType: 'COUNT',
        targetValue: 3,
        targetUnit: 'problems',
        goalCompleted: true,
        goalProgress: 3,
        startedAt: '2026-09-15T14:00:00Z',
        endedAt: '2026-09-15T14:50:00Z',
      },
      {
        id: 'sess_3',
        selectedActivity: 'Reading',
        plannedDurationMs: 30 * 60 * 1000,
        actualDurationMs: 30 * 60 * 1000,
        status: 'COMPLETED',
        focusPoints: 30,
        goalText: null,
        goalType: 'NONE',
        startedAt: '2026-09-16T10:00:00Z',
        endedAt: '2026-09-16T10:30:00Z',
      },
    ];

    const result = generateCalendarMonthData(mockSessions, '2026-09', { offsetMinutes: 0 });
    assert.equal(result.monthSummary.totalSessions, 3);
    assert.equal(result.monthSummary.totalDurationSec, 105 * 60);
    assert.equal(result.monthSummary.totalFocusPoints, 105);
    assert.equal(result.monthSummary.activeDaysCount, 2);
    assert.equal(result.monthSummary.totalGoalsCompleted, 1);
    assert.equal(result.monthSummary.totalTasks, 1);

    // Check Day 15
    const day15 = result.days.find(d => d.date === '2026-09-15');
    assert.ok(day15);
    assert.equal(day15.sessionCount, 2);
    assert.equal(day15.hasGoals, true);
    assert.equal(day15.goalsCompletedCount, 1);
    assert.equal(day15.sessions[0].isTask, false);
    assert.equal(day15.sessions[1].isTask, true);
    assert.equal(day15.sessions[1].goalCompleted, true);
    assert.equal(day15.sessions[1].targetValue, 3);

    // Check Day 16
    const day16 = result.days.find(d => d.date === '2026-09-16');
    assert.ok(day16);
    assert.equal(day16.sessionCount, 1);
    assert.equal(day16.hasGoals, false);
  });

  await t.test('4. Unauthenticated GET /api/calendar returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar?month=2026-09',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('5. Authenticated GET /api/calendar returns structured monthly data for user', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Calendar User Test',
        username: `cal_user_${suffix}`,
        email: `cal_user_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
    const userRes = JSON.parse(regRes.payload);
    const userId = userRes.user.id;

    // Create 2 sessions directly in dbStore for this user
    await dbStore.createSession({
      userId,
      selectedActivity: 'Studying',
      plannedDurationMs: 30 * 60 * 1000,
      actualDurationMs: 30 * 60 * 1000,
      status: 'COMPLETED',
      focusPoints: 30,
      startedAt: new Date('2026-09-10T10:00:00Z'),
    });

    await dbStore.createSession({
      userId,
      selectedActivity: 'Coding',
      plannedDurationMs: 45 * 60 * 1000,
      actualDurationMs: 45 * 60 * 1000,
      status: 'COMPLETED',
      focusPoints: 45,
      goalText: 'Build Calendar Feature',
      goalType: 'COUNT',
      targetValue: 1,
      targetUnit: 'feature',
      goalCompleted: true,
      goalProgress: 1,
      startedAt: new Date('2026-09-10T14:00:00Z'),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar?month=2026-09',
      headers: {
        cookie,
        'x-timezone-offset': '0',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.month, '2026-09');
    assert.equal(body.monthSummary.totalSessions, 2);
    assert.equal(body.monthSummary.totalFocusPoints, 75);
    assert.equal(body.monthSummary.activeDaysCount, 1);
    assert.equal(body.monthSummary.totalGoalsCompleted, 1);

    const day10 = body.days.find(d => d.date === '2026-09-10');
    assert.ok(day10);
    assert.equal(day10.sessionCount, 2);
    assert.equal(day10.hasGoals, true);
    assert.equal(day10.sessions.length, 2);

    // Non-goal session
    const studySession = day10.sessions.find(s => s.activity === 'Studying');
    assert.ok(studySession);
    assert.equal(studySession.isTask, false);
    assert.equal(studySession.durationSec, 1800);

    // Task session
    const codeSession = day10.sessions.find(s => s.activity === 'Coding');
    assert.ok(codeSession);
    assert.equal(codeSession.isTask, true);
    assert.equal(codeSession.goalText, 'Build Calendar Feature');
    assert.equal(codeSession.goalCompleted, true);
  });

  await t.test('6. User Data Isolation (IDOR Protection): User B cannot see User A calendar events', async () => {
    const suffixA = Date.now().toString(36) + 'a' + Math.random().toString(36).substring(2, 5);
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User A Calendar',
        username: `cal_a_${suffixA}`,
        email: `cal_a_${suffixA}@example.com`,
        password: 'Password12345!',
      },
    });
    const userAId = JSON.parse(regA.payload).user.id;

    // Create session for User A
    await dbStore.createSession({
      userId: userAId,
      selectedActivity: 'Private Activity A',
      plannedDurationMs: 60 * 60 * 1000,
      actualDurationMs: 60 * 60 * 1000,
      status: 'COMPLETED',
      focusPoints: 60,
      startedAt: new Date('2026-09-20T10:00:00Z'),
    });

    // Register User B
    const suffixB = Date.now().toString(36) + 'b' + Math.random().toString(36).substring(2, 5);
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User B Calendar',
        username: `cal_b_${suffixB}`,
        email: `cal_b_${suffixB}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;

    // Request calendar as User B
    const resB = await app.inject({
      method: 'GET',
      url: '/api/calendar?month=2026-09',
      headers: { cookie: cookieB },
    });

    assert.equal(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    // User B should see 0 sessions across all days
    assert.equal(bodyB.monthSummary.totalSessions, 0);
    assert.equal(bodyB.monthSummary.totalFocusPoints, 0);
    assert.equal(bodyB.monthSummary.activeDaysCount, 0);

    const day20B = bodyB.days.find(d => d.date === '2026-09-20');
    assert.ok(day20B);
    assert.equal(day20B.sessionCount, 0);
    assert.equal(day20B.sessions.length, 0);
  });

  await t.test('7. Timezone boundary test: late night session maps to correct local date', async () => {
    const suffix = Date.now().toString(36) + 'tz' + Math.random().toString(36).substring(2, 5);
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Timezone User',
        username: `cal_tz_${suffix}`,
        email: `cal_tz_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${reg.cookies[0].name}=${reg.cookies[0].value}`;
    const userId = JSON.parse(reg.payload).user.id;

    // Session started at 2026-09-15T22:30:00Z
    // In UTC+5:30 (offset = -330), local time is 2026-09-16 04:00 AM!
    await dbStore.createSession({
      userId,
      selectedActivity: 'Late Night Session',
      plannedDurationMs: 25 * 60 * 1000,
      actualDurationMs: 25 * 60 * 1000,
      status: 'COMPLETED',
      focusPoints: 25,
      startedAt: new Date('2026-09-15T22:30:00Z'),
    });

    // Query with UTC+5:30 offset
    const res = await app.inject({
      method: 'GET',
      url: '/api/calendar?month=2026-09',
      headers: {
        cookie,
        'x-timezone-offset': '-330',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    // Should be on Sep 16 in local time, NOT Sep 15!
    const day15 = body.days.find(d => d.date === '2026-09-15');
    const day16 = body.days.find(d => d.date === '2026-09-16');

    assert.equal(day15.sessionCount, 0);
    assert.equal(day16.sessionCount, 1);
    assert.equal(day16.sessions[0].activity, 'Late Night Session');
    assert.equal(day16.sessions[0].startTimeFormatted, '4:00 AM');
  });
});
