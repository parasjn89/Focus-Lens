import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { getMondayOfWeek } from '../utils/weeklyReviewEngine.js';

test('Weekly Review Test Suite', async (t) => {
  let app;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Helper getMondayOfWeek returns correct Monday YYYY-MM-DD', () => {
    const monday = getMondayOfWeek('2026-09-15T12:00:00Z', 0); // Tuesday 15 Sep 2026
    assert.equal(monday, '2026-09-14');
  });

  await t.test('2. Unauthenticated GET /api/weekly-review returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/weekly-review',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('3. Empty session history returns zeros and valid structure', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Weekly User Empty',
        username: `wr_empty_${suffix}`,
        email: `wr_empty_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/weekly-review',
      headers: { cookie },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    assert.ok(body.weekStartDate);
    assert.ok(body.weekEndDate);
    assert.equal(body.overview.focusPoints, 0);
    assert.equal(body.overview.completedSessions, 0);
    assert.equal(body.overview.focusDays, 0);
    assert.equal(body.daily.length, 7);
    assert.equal(body.deepWork.blockCount, 0);
    assert.equal(body.goals.goalSessions, 0);
  });

  await t.test('4. Aggregate completed sessions for current week and save review notes', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Weekly User Active',
        username: `wr_user_${suffix}`,
        email: `wr_user_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
    const user = JSON.parse(regRes.payload).user;

    const session = await dbStore.createSession({
      userId: user.id,
      selectedActivity: 'STUDY_LIKELY',
      plannedDurationMs: 1800000,
      actualDurationMs: 1800000,
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    });

    await dbStore.saveSegments(session.id, user.id, [
      {
        activityType: 'STUDY_LIKE',
        startTimeMs: 0,
        endTimeMs: 1800000,
        durationMs: 1800000,
        evidenceScore: 0.9,
        confidenceType: 'heuristic',
        contributingSignals: ['face_detected'],
        explanation: { summary: 'Focused study' },
      },
    ]);

    await dbStore.updateSession(session.id, user.id, {
      actualDurationMs: 1800000,
      status: 'COMPLETED',
      focusPoints: 30,
    });

    // Save weekly review notes
    const monday = getMondayOfWeek(new Date(), 0);
    const noteRes = await app.inject({
      method: 'PUT',
      url: '/api/weekly-review/notes',
      headers: { cookie },
      payload: {
        weekStartDate: monday,
        workedWell: 'Morning study sessions went great',
        madeItHard: 'Noisy environment in afternoon',
      },
    });

    assert.equal(noteRes.statusCode, 200);
    const noteBody = JSON.parse(noteRes.payload);
    assert.equal(noteBody.success, true);
    assert.equal(noteBody.notes.workedWell, 'Morning study sessions went great');

    // Fetch review analysis
    const reviewRes = await app.inject({
      method: 'GET',
      url: `/api/weekly-review?week=${monday}`,
      headers: { cookie },
    });

    assert.equal(reviewRes.statusCode, 200);
    const reviewBody = JSON.parse(reviewRes.payload);
    assert.equal(reviewBody.overview.completedSessions, 1);
    assert.equal(reviewBody.overview.focusPoints, 30);
    assert.equal(reviewBody.notes.workedWell, 'Morning study sessions went great');
    assert.equal(reviewBody.notes.madeItHard, 'Noisy environment in afternoon');
  });

  await t.test('5. Strict User Isolation (IDOR Protection)', async () => {
    const suffixA = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Weekly User A',
        username: `wr_usera_${suffixA}`,
        email: `wr_usera_${suffixA}@example.com`,
        password: 'Password12345!',
      },
    });

    const suffixB = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Weekly User B',
        username: `wr_userb_${suffixB}`,
        email: `wr_userb_${suffixB}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    const userA = JSON.parse(regA.payload).user;

    const monday = getMondayOfWeek(new Date(), 0);
    await dbStore.upsertWeeklyReviewNote(userA.id, monday, {
      workedWell: 'User A Secret Note',
      madeItHard: 'User A Distractions',
    });

    const resB = await app.inject({
      method: 'GET',
      url: `/api/weekly-review?week=${monday}`,
      headers: { cookie: cookieB },
    });

    assert.equal(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    assert.equal(bodyB.notes.workedWell, '');
    assert.equal(bodyB.notes.madeItHard, '');
  });
});
