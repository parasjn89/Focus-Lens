import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { dbStore } from '../db/store.js';
import { runMigrations } from '../db/migrate.js';

test('Task Manager API, CRUD & User Isolation Test Suite', async (t) => {
  let app;
  let cookieA, userAId;
  let cookieB, userBId;
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  t.before(async () => {
    await runMigrations().catch(() => {});
    app = buildApp({ logger: false });
    await app.ready();

    // Register User A
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Task User A',
        username: `task_usera_${suffix}`,
        email: `task_usera_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
    userAId = JSON.parse(regA.payload).user.id;

    // Register User B
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Task User B',
        username: `task_userb_${suffix}`,
        email: `task_userb_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userBId = JSON.parse(regB.payload).user.id;
  });

  t.after(async () => {
    if (app) await app.close();
  });

  let task1Id = null;
  let task2Id = null;
  let task3Id = null;

  await t.test('1. Unauthenticated request to /api/tasks returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });
    assert.equal(res.statusCode, 401);
  });

  await t.test('2. Create tasks with categories Study, Coding, and Other', async () => {
    // Task 1: Study
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: cookieA },
      payload: {
        title: 'Read Operating Systems Chapter 3',
        category: 'Study',
        description: 'Focus on virtual memory and page tables',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert.equal(res1.statusCode, 201);
    const body1 = JSON.parse(res1.payload);
    assert.ok(body1.task.id);
    assert.equal(body1.task.title, 'Read Operating Systems Chapter 3');
    assert.equal(body1.task.category, 'Study');
    assert.equal(body1.task.completed, false);
    task1Id = body1.task.id;

    // Task 2: Coding
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: cookieA },
      payload: {
        title: 'Refactor Auth middleware pipeline',
        category: 'Coding',
        description: 'Implement token rotation and rate limiting',
      },
    });
    assert.equal(res2.statusCode, 201);
    const body2 = JSON.parse(res2.payload);
    assert.equal(body2.task.category, 'Coding');
    task2Id = body2.task.id;

    // Task 3: Other
    const res3 = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: cookieA },
      payload: {
        title: 'Organize desk workspace',
        category: 'Other',
      },
    });
    assert.equal(res3.statusCode, 201);
    const body3 = JSON.parse(res3.payload);
    assert.equal(body3.task.category, 'Other');
    task3Id = body3.task.id;
  });

  await t.test('3. Create task validation rejects empty title and invalid category', async () => {
    const resEmpty = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: cookieA },
      payload: {
        title: '   ',
        category: 'Study',
      },
    });
    assert.equal(resEmpty.statusCode, 400);

    const resBadCat = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      headers: { cookie: cookieA },
      payload: {
        title: 'Valid title',
        category: 'InvalidCategory',
      },
    });
    assert.equal(resBadCat.statusCode, 400);
  });

  await t.test('4. List tasks with Category and Search filtering', async () => {
    // All tasks for User A
    const allRes = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { cookie: cookieA },
    });
    assert.equal(allRes.statusCode, 200);
    const allBody = JSON.parse(allRes.payload);
    assert.equal(allBody.tasks.length, 3);

    // Filter by Study category
    const studyRes = await app.inject({
      method: 'GET',
      url: '/api/tasks?category=Study',
      headers: { cookie: cookieA },
    });
    assert.equal(studyRes.statusCode, 200);
    const studyBody = JSON.parse(studyRes.payload);
    assert.equal(studyBody.tasks.length, 1);
    assert.equal(studyBody.tasks[0].id, task1Id);

    // Filter by Coding category
    const codingRes = await app.inject({
      method: 'GET',
      url: '/api/tasks?category=Coding',
      headers: { cookie: cookieA },
    });
    assert.equal(codingRes.statusCode, 200);
    const codingBody = JSON.parse(codingRes.payload);
    assert.equal(codingBody.tasks.length, 1);
    assert.equal(codingBody.tasks[0].id, task2Id);

    // Search filter
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/tasks?search=Operating',
      headers: { cookie: cookieA },
    });
    assert.equal(searchRes.statusCode, 200);
    const searchBody = JSON.parse(searchRes.payload);
    assert.equal(searchBody.tasks.length, 1);
    assert.equal(searchBody.tasks[0].id, task1Id);
  });

  await t.test('5. Get task by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieA },
    });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.task.id, task1Id);
    assert.equal(body.task.title, 'Read Operating Systems Chapter 3');
  });

  await t.test('6. Update task (toggle completion, edit details)', async () => {
    // Complete task 1
    const resComplete = await app.inject({
      method: 'PUT',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieA },
      payload: {
        completed: true,
      },
    });
    assert.equal(resComplete.statusCode, 200);
    const body1 = JSON.parse(resComplete.payload);
    assert.equal(body1.task.completed, true);

    // Edit task 2 title and description
    const resEdit = await app.inject({
      method: 'PUT',
      url: `/api/tasks/${task2Id}`,
      headers: { cookie: cookieA },
      payload: {
        title: 'Refactor Auth middleware pipeline v2',
        description: 'Completed token rotation, adding OAuth fallback',
      },
    });
    assert.equal(resEdit.statusCode, 200);
    const body2 = JSON.parse(resEdit.payload);
    assert.equal(body2.task.title, 'Refactor Auth middleware pipeline v2');
    assert.equal(body2.task.description, 'Completed token rotation, adding OAuth fallback');
  });

  await t.test('7. Delete task', async () => {
    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task3Id}`,
      headers: { cookie: cookieA },
    });
    assert.equal(resDelete.statusCode, 200);
    const body = JSON.parse(resDelete.payload);
    assert.equal(body.success, true);

    // Verify task 3 no longer exists
    const resGet = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task3Id}`,
      headers: { cookie: cookieA },
    });
    assert.equal(resGet.statusCode, 404);
  });

  await t.test('8. Strict User Isolation (IDOR Protection): User B cannot access User A tasks', async () => {
    // User B list should have 0 tasks
    const resListB = await app.inject({
      method: 'GET',
      url: '/api/tasks',
      headers: { cookie: cookieB },
    });
    assert.equal(resListB.statusCode, 200);
    const bodyB = JSON.parse(resListB.payload);
    assert.equal(bodyB.tasks.length, 0);

    // User B attempts to read User A task
    const resGetB = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieB },
    });
    assert.equal(resGetB.statusCode, 404);

    // User B attempts to update User A task
    const resPutB = await app.inject({
      method: 'PUT',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieB },
      payload: {
        title: 'Hacked Title',
      },
    });
    assert.equal(resPutB.statusCode, 404);

    // User B attempts to delete User A task
    const resDelB = await app.inject({
      method: 'DELETE',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieB },
    });
    assert.equal(resDelB.statusCode, 404);

    // Verify User A task remained unchanged
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/tasks/${task1Id}`,
      headers: { cookie: cookieA },
    });
    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.task.title, 'Read Operating Systems Chapter 3');
  });
});
