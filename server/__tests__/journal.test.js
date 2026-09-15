import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';

test('Focus Journal Test Suite', async (t) => {
  let app;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  t.after(async () => {
    if (app) await app.close();
  });

  await t.test('1. Unauthenticated GET /api/journal returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/journal',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('2. Empty journal returns empty list and valid metadata', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Journal User Empty',
        username: `fj_empty_${suffix}`,
        email: `fj_empty_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/journal',
      headers: { cookie },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.deepEqual(body.entries, []);
    assert.equal(body.pagination.totalCount, 0);
  });

  await t.test('3. Update session journal fields (intention, workedWell, gotInTheWay, notes)', async () => {
    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Journal User Active',
        username: `fj_user_${suffix}`,
        email: `fj_user_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
    const user = JSON.parse(regRes.payload).user;

    const session = await dbStore.createSession({
      userId: user.id,
      selectedActivity: 'STUDY_LIKE',
      plannedDurationMs: 1800000,
      actualDurationMs: 1800000,
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${session.id}/journal`,
      headers: { cookie },
      payload: {
        intention: 'Master React state management',
        workedWell: 'Silenced notifications',
        gotInTheWay: 'Loud noise outside',
        notes: 'Review useEffect hooks tomorrow',
      },
    });

    assert.equal(patchRes.statusCode, 200);
    const patchBody = JSON.parse(patchRes.payload);
    assert.equal(patchBody.success, true);
    assert.equal(patchBody.session.intention, 'Master React state management');
    assert.equal(patchBody.session.workedWell, 'Silenced notifications');

    // Fetch journal
    const journalRes = await app.inject({
      method: 'GET',
      url: '/api/journal',
      headers: { cookie },
    });

    assert.equal(journalRes.statusCode, 200);
    const journalBody = JSON.parse(journalRes.payload);
    assert.equal(journalBody.pagination.totalCount, 1);
    assert.equal(journalBody.entries[0].intention, 'Master React state management');
  });

  await t.test('4. Strict User Isolation: User B cannot modify or read User A journal', async () => {
    const suffixA = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Journal User A',
        username: `fj_usera_${suffixA}`,
        email: `fj_usera_${suffixA}@example.com`,
        password: 'Password12345!',
      },
    });

    const suffixB = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Journal User B',
        username: `fj_userb_${suffixB}`,
        email: `fj_userb_${suffixB}@example.com`,
        password: 'Password12345!',
      },
    });
    const cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    const userA = JSON.parse(regA.payload).user;

    const sessionA = await dbStore.createSession({
      userId: userA.id,
      selectedActivity: 'STUDY_LIKE',
      plannedDurationMs: 1800000,
      actualDurationMs: 1800000,
      status: 'COMPLETED',
    });

    // User B attempts to edit User A session journal
    const patchResB = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${sessionA.id}/journal`,
      headers: { cookie: cookieB },
      payload: {
        intention: 'Malicious modification',
      },
    });

    assert.equal(patchResB.statusCode, 404);

    // User B reads journal
    const journalResB = await app.inject({
      method: 'GET',
      url: '/api/journal',
      headers: { cookie: cookieB },
    });

    assert.equal(journalResB.statusCode, 200);
    const journalBodyB = JSON.parse(journalResB.payload);
    assert.equal(journalBodyB.pagination.totalCount, 0);
  });
});
