import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/client.js';

test('FocusLens Focus Buddy & Accountability Messages Test Suite', async (t) => {
  let app;
  let cookieA, userA, userAId;
  let cookieB, userB, userBId;
  let cookieC, userC, userCId;
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
        name: 'Paras Jain',
        username: `paras_${suffix}`,
        email: `paras_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
    userA = JSON.parse(regA.payload).user;
    userAId = userA.id;

    // Register User B
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Naman Dubey',
        username: `naman_${suffix}`,
        email: `naman_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userB = JSON.parse(regB.payload).user;
    userBId = userB.id;

    // Register User C (Isolated outsider)
    const regC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Charlie Outsider',
        username: `charlie_${suffix}`,
        email: `charlie_${suffix}@example.com`,
        password: 'SecurePass12345!',
      },
    });
    cookieC = `${regC.cookies[0].name}=${regC.cookies[0].value}`;
    userC = JSON.parse(regC.payload).user;
    userCId = userC.id;
  });

  t.after(async () => {
    if (app) await app.close();
    await pool.end();
  });

  let buddyRequestId = null;
  let activeConversationId = null;

  await t.test('1. Unauthenticated requests to /api/buddies and /api/messages are rejected (401)', async () => {
    const res1 = await app.inject({ method: 'GET', url: '/api/buddies' });
    assert.strictEqual(res1.statusCode, 401);

    const res2 = await app.inject({ method: 'GET', url: '/api/messages/conversations' });
    assert.strictEqual(res2.statusCode, 401);
  });

  await t.test('2. User A cannot send a Focus Buddy request to themselves', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/buddies/request',
      headers: { cookie: cookieA },
      payload: { usernameOrEmail: userA.username },
    });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.ok(body.message.includes('cannot add yourself') || body.message.includes('yourself'));
  });

  await t.test('3. Focus Buddy request lifecycle: User A invites User B via @username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/buddies/request',
      headers: { cookie: cookieA },
      payload: { usernameOrEmail: `@${userB.username}` },
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.request.status, 'PENDING');
    assert.strictEqual(body.request.senderUserId, userAId);
    assert.strictEqual(body.request.receiverUserId, userBId);
    buddyRequestId = body.request.id;
  });

  await t.test('4. User B sees pending incoming buddy request from User A; User C sees 0 requests', async () => {
    // User B checks buddies
    const resB = await app.inject({
      method: 'GET',
      url: '/api/buddies',
      headers: { cookie: cookieB },
    });
    assert.strictEqual(resB.statusCode, 200);
    const bodyB = JSON.parse(resB.payload);
    assert.strictEqual(bodyB.pendingRequests.length, 1);
    assert.strictEqual(bodyB.pendingRequests[0].id, buddyRequestId);
    assert.strictEqual(bodyB.pendingRequests[0].senderId, userAId);
    assert.strictEqual(bodyB.pendingRequests[0].senderUsername, userA.username);

    // User C checks buddies (strict user isolation)
    const resC = await app.inject({
      method: 'GET',
      url: '/api/buddies',
      headers: { cookie: cookieC },
    });
    assert.strictEqual(resC.statusCode, 200);
    const bodyC = JSON.parse(resC.payload);
    assert.strictEqual(bodyC.pendingRequests.length, 0);
  });

  await t.test('5. User C cannot accept User B\'s pending buddy request (IDOR protection)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/buddies/requests/${buddyRequestId}`,
      headers: { cookie: cookieC },
      payload: { action: 'ACCEPT' },
    });
    assert.ok([403, 404].includes(res.statusCode));
  });

  await t.test('6. User B accepts User A\'s buddy request -> creates conversation', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/buddies/requests/${buddyRequestId}`,
      headers: { cookie: cookieB },
      payload: { action: 'ACCEPT' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'ACCEPTED');

    // Verify both users now have 1 accepted buddy
    const checkA = await app.inject({ method: 'GET', url: '/api/buddies', headers: { cookie: cookieA } });
    const listA = JSON.parse(checkA.payload).buddies;
    assert.strictEqual(listA.length, 1);
    assert.strictEqual(listA[0].userId, userBId);

    const checkB = await app.inject({ method: 'GET', url: '/api/buddies', headers: { cookie: cookieB } });
    const listB = JSON.parse(checkB.payload).buddies;
    assert.strictEqual(listB.length, 1);
    assert.strictEqual(listB[0].userId, userAId);
  });

  await t.test('7. Authenticated users can list mutual conversation', async () => {
    const resA = await app.inject({
      method: 'GET',
      url: '/api/messages/conversations',
      headers: { cookie: cookieA },
    });
    assert.strictEqual(resA.statusCode, 200);
    const bodyA = JSON.parse(resA.payload);
    assert.strictEqual(bodyA.conversations.length, 1);
    activeConversationId = bodyA.conversations[0].id;
    assert.strictEqual(bodyA.conversations[0].buddy.id, userBId);
    assert.strictEqual(bodyA.conversations[0].buddy.username, userB.username);
  });

  await t.test('8. User C cannot view User A and B\'s conversation (IDOR protection -> 403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieC },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test('9. Message validation rejects empty and oversized messages', async () => {
    // Blank message
    const blankRes = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: '   ' },
    });
    assert.strictEqual(blankRes.statusCode, 400);

    // Oversized message (> 1000 chars)
    const longContent = 'x'.repeat(1001);
    const longRes = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: longContent },
    });
    assert.strictEqual(longRes.statusCode, 400);
  });

  await t.test('10. User C cannot post messages to User A and B\'s conversation (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieC },
      payload: { content: 'Unauthorized intruder message' },
    });
    assert.strictEqual(res.statusCode, 403);
  });

  await t.test('11. User A sends "Let\'s do 45 mins 🔥" to User B', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: "Let's do 45 mins 🔥" },
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message.content, "Let's do 45 mins 🔥");
    assert.strictEqual(body.message.senderUserId, userAId);
    assert.strictEqual(body.message.readAt, null);
  });

  await t.test('12. User B sees unread count of 1; User A sees unread count of 0', async () => {
    const resB = await app.inject({
      method: 'GET',
      url: '/api/messages/unread-count',
      headers: { cookie: cookieB },
    });
    assert.strictEqual(resB.statusCode, 200);
    assert.strictEqual(JSON.parse(resB.payload).unreadCount, 1);

    const resA = await app.inject({
      method: 'GET',
      url: '/api/messages/unread-count',
      headers: { cookie: cookieA },
    });
    assert.strictEqual(resA.statusCode, 200);
    assert.strictEqual(JSON.parse(resA.payload).unreadCount, 0);
  });

  await t.test('13. User B reads conversation -> marks messages as read and unread count becomes 0', async () => {
    const readRes = await app.inject({
      method: 'PATCH',
      url: `/api/messages/conversations/${activeConversationId}/read`,
      headers: { cookie: cookieB },
    });
    assert.strictEqual(readRes.statusCode, 200);

    const unreadRes = await app.inject({
      method: 'GET',
      url: '/api/messages/unread-count',
      headers: { cookie: cookieB },
    });
    assert.strictEqual(JSON.parse(unreadRes.payload).unreadCount, 0);
  });

  await t.test('14. User B sends real Focus Activity message card', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieB },
      payload: {
        content: 'Naman started a 45 minute Coding session.',
        messageType: 'ACTIVITY',
        activityMetadata: {
          type: 'SESSION_STARTED',
          title: 'Focus Session Started',
          activity: 'Coding',
          durationMinutes: 45,
        },
      },
    });
    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.message.messageType, 'ACTIVITY');
    assert.strictEqual(body.message.activityMetadata.type, 'SESSION_STARTED');
  });

  await t.test('15. Both users can load full conversation history in chronological order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.messages.length, 2);
    assert.strictEqual(body.messages[0].content, "Let's do 45 mins 🔥");
    assert.strictEqual(body.messages[1].messageType, 'ACTIVITY');
    assert.strictEqual(body.buddy.username, userB.username);
  });
});
