import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { buildApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/client.js';
import { realtimeMessageService } from '../services/realtimeMessageService.js';

test('FocusLens Real-Time Messaging & SSE Event Stream Suite', async (t) => {
  let app;
  let serverUrl;
  let cookieA, userA, userAId;
  let cookieB, userB, userBId;
  let cookieC, userC, userCId;
  let activeConversationId;
  const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  t.before(async () => {
    await runMigrations().catch(() => {});
    app = buildApp({ logger: false });
    // Bind to random ephemeral port for live HTTP streaming tests
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = address;

    // Register User A (Paras)
    const regA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Paras Realtime',
        username: `paras_rt_${suffix}`,
        email: `paras_rt_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieA = `${regA.cookies[0].name}=${regA.cookies[0].value}`;
    userA = JSON.parse(regA.payload).user;
    userAId = userA.id;

    // Register User B (Naman)
    const regB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Naman Realtime',
        username: `naman_rt_${suffix}`,
        email: `naman_rt_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieB = `${regB.cookies[0].name}=${regB.cookies[0].value}`;
    userB = JSON.parse(regB.payload).user;
    userBId = userB.id;

    // Register User C (Outsider)
    const regC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Charlie Outsider',
        username: `charlie_rt_${suffix}`,
        email: `charlie_rt_${suffix}@example.com`,
        password: 'Password12345!',
      },
    });
    cookieC = `${regC.cookies[0].name}=${regC.cookies[0].value}`;
    userC = JSON.parse(regC.payload).user;
    userCId = userC.id;

    // User A adds User B as Focus Buddy
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/buddies/request',
      headers: { cookie: cookieA },
      payload: { usernameOrEmail: userB.username },
    });
    const buddyRequestId = JSON.parse(reqRes.payload).request.id;

    // User B accepts request
    await app.inject({
      method: 'PATCH',
      url: `/api/buddies/requests/${buddyRequestId}`,
      headers: { cookie: cookieB },
      payload: { action: 'ACCEPT' },
    });

    // Obtain mutual conversation ID
    const convRes = await app.inject({
      method: 'GET',
      url: '/api/messages/conversations',
      headers: { cookie: cookieA },
    });
    const convBody = JSON.parse(convRes.payload);
    activeConversationId = convBody.conversations[0].id;
  });

  t.after(async () => {
    realtimeMessageService.closeAll();
    if (app) await app.close();
    await pool.end();
  });

  /**
   * Helper function to open an SSE connection using Node HTTP client
   */
  function openSSEStream(cookie) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(`${serverUrl}/api/messages/events`);
      const events = [];
      let isConnected = false;

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'GET',
          headers: {
            cookie,
            Accept: 'text/event-stream',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`SSE connection failed with status: ${res.statusCode}`));
          }

          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // keep remainder

            for (const block of lines) {
              if (block.includes(': connected')) {
                isConnected = true;
              }
              if (block.includes('event: message.created')) {
                const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
                if (dataLine) {
                  try {
                    const parsed = JSON.parse(dataLine.replace('data: ', '').trim());
                    events.push(parsed);
                  } catch (e) {
                    console.error('Failed to parse SSE payload:', e);
                  }
                }
              }
            }
          });

          resolve({
            res,
            req,
            getEvents: () => [...events],
            clearEvents: () => {
              events.length = 0;
            },
            close: () => {
              req.destroy();
            },
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  }

  await t.test('1. Unauthenticated request to /api/messages/events is rejected (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/messages/events',
    });
    assert.strictEqual(res.statusCode, 401);
  });

  await t.test('2. Authenticated users can open SSE streams with proper headers', async () => {
    const streamB = await openSSEStream(cookieB);
    assert.ok(streamB);
    assert.strictEqual(streamB.res.headers['content-type'], 'text/event-stream');
    assert.strictEqual(streamB.res.headers['cache-control'], 'no-cache, no-transform');

    // Verify User B is registered in realtime connection registry
    assert.strictEqual(realtimeMessageService.getConnectionCount(userBId), 1);
    streamB.close();
    // Allow small tick for close event
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(realtimeMessageService.getConnectionCount(userBId), 0);
  });

  await t.test('3. Real-Time Message Flow: Paras sends message -> Naman receives event in real time', async () => {
    // Open streams for User A (Paras), User B (Naman), and User C (Outsider)
    const streamA = await openSSEStream(cookieA);
    const streamB = await openSSEStream(cookieB);
    const streamC = await openSSEStream(cookieC);

    await new Promise((r) => setTimeout(r, 60)); // allow connection handshake

    // Paras sends "hello"
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: 'hello' },
    });
    assert.strictEqual(sendRes.statusCode, 201);
    const sentBody = JSON.parse(sendRes.payload);
    assert.strictEqual(sentBody.success, true);
    assert.strictEqual(sentBody.message.content, 'hello');

    // Wait for event delivery
    await new Promise((r) => setTimeout(r, 100));

    // User B (Naman) should have received message.created in real time
    const eventsB = streamB.getEvents();
    assert.strictEqual(eventsB.length, 1);
    assert.strictEqual(eventsB[0].conversationId, activeConversationId);
    assert.strictEqual(eventsB[0].message.content, 'hello');
    assert.strictEqual(eventsB[0].message.senderUserId, userAId);
    assert.strictEqual(eventsB[0].message.id, sentBody.message.id);

    // SECURITY CHECK: User C (Outsider) must NOT receive the message!
    const eventsC = streamC.getEvents();
    assert.strictEqual(eventsC.length, 0, 'User C must never receive events for User A & B conversation');

    // Clean up streams
    streamA.close();
    streamB.close();
    streamC.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('4. Real-Time Reply Flow: Naman replies "hi" -> Paras receives event in real time', async () => {
    const streamA = await openSSEStream(cookieA);
    const streamB = await openSSEStream(cookieB);

    await new Promise((r) => setTimeout(r, 60));

    // Naman sends "hi"
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieB },
      payload: { content: 'hi' },
    });
    assert.strictEqual(sendRes.statusCode, 201);
    const sentBody = JSON.parse(sendRes.payload);

    await new Promise((r) => setTimeout(r, 100));

    // Paras receives "hi"
    const eventsA = streamA.getEvents();
    assert.strictEqual(eventsA.length, 1);
    assert.strictEqual(eventsA[0].message.content, 'hi');
    assert.strictEqual(eventsA[0].message.senderUserId, userBId);
    assert.strictEqual(eventsA[0].message.id, sentBody.message.id);

    streamA.close();
    streamB.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('5. Safe payload inspection: zero passwords, tokens, or credentials in SSE payload', async () => {
    const streamB = await openSSEStream(cookieB);
    await new Promise((r) => setTimeout(r, 50));

    await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: 'Safe check payload' },
    });

    await new Promise((r) => setTimeout(r, 80));

    const events = streamB.getEvents();
    assert.strictEqual(events.length, 1);
    const msg = events[0].message;

    // Check prohibited fields
    assert.strictEqual(msg.password, undefined);
    assert.strictEqual(msg.passwordHash, undefined);
    assert.strictEqual(msg.token, undefined);
    assert.strictEqual(msg.email, undefined);
    assert.strictEqual(msg.cameraData, undefined);
    assert.strictEqual(msg.screenData, undefined);

    // Verify safe fields present
    assert.ok(msg.id);
    assert.ok(msg.senderUserId);
    assert.strictEqual(msg.content, 'Safe check payload');
    assert.ok(msg.createdAt);

    streamB.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('6. Rapid burst message delivery & deduplication key verification', async () => {
    const streamB = await openSSEStream(cookieB);
    await new Promise((r) => setTimeout(r, 50));

    const burstMessages = ['Message 1 🔥', 'Message 2 ⚡', 'Message 3 🚀'];
    const sentIds = [];

    for (const text of burstMessages) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/messages/conversations/${activeConversationId}`,
        headers: { cookie: cookieA },
        payload: { content: text },
      });
      sentIds.push(JSON.parse(res.payload).message.id);
    }

    await new Promise((r) => setTimeout(r, 120));

    const events = streamB.getEvents();
    assert.strictEqual(events.length, 3);
    assert.deepStrictEqual(
      events.map((e) => e.message.id),
      sentIds
    );

    // Verify client-side deduplication logic
    const clientMessages = [];
    for (const ev of events) {
      // simulate deduplicating on message.id
      if (!clientMessages.some((m) => m.id === ev.message.id)) {
        clientMessages.push(ev.message);
      }
    }
    // Simulate duplicate event arriving
    for (const ev of events) {
      if (!clientMessages.some((m) => m.id === ev.message.id)) {
        clientMessages.push(ev.message);
      }
    }
    assert.strictEqual(clientMessages.length, 3, 'Client-side deduplication must strictly prevent duplicates');

    streamB.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('7. Inactive conversation / unread count and read marking', async () => {
    // Check unread count for User B
    const unreadRes1 = await app.inject({
      method: 'GET',
      url: '/api/messages/unread-count',
      headers: { cookie: cookieB },
    });
    const count1 = JSON.parse(unreadRes1.payload).unreadCount;
    assert.ok(count1 > 0);

    // User B marks conversation as read
    const markRes = await app.inject({
      method: 'PATCH',
      url: `/api/messages/conversations/${activeConversationId}/read`,
      headers: { cookie: cookieB },
    });
    assert.strictEqual(markRes.statusCode, 200);

    // Unread count should now be 0
    const unreadRes2 = await app.inject({
      method: 'GET',
      url: '/api/messages/unread-count',
      headers: { cookie: cookieB },
    });
    assert.strictEqual(JSON.parse(unreadRes2.payload).unreadCount, 0);
  });

  await t.test('8. Reconnect & reconciliation: offline messages are retrieved without duplication', async () => {
    // User B is currently disconnected (offline)
    assert.strictEqual(realtimeMessageService.getConnectionCount(userBId), 0);

    // User A sends message while User B is offline
    const sendOffline = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieA },
      payload: { content: 'Offline message while disconnected' },
    });
    const offlineMsgId = JSON.parse(sendOffline.payload).message.id;

    // User B reconnects
    const streamB = await openSSEStream(cookieB);
    assert.strictEqual(realtimeMessageService.getConnectionCount(userBId), 1);

    // On reconnect, client reconciles by fetching latest conversation messages
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/messages/conversations/${activeConversationId}`,
      headers: { cookie: cookieB },
    });
    const history = JSON.parse(fetchRes.payload).messages;
    const foundOfflineMsg = history.find((m) => m.id === offlineMsgId);
    assert.ok(foundOfflineMsg, 'Offline message must be reconciled from server');
    assert.strictEqual(foundOfflineMsg.content, 'Offline message while disconnected');

    streamB.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('9. Heartbeat: realtimeMessageService sends keep-alive comment without error', async () => {
    const streamB = await openSSEStream(cookieB);
    // Explicitly invoke heartbeat
    realtimeMessageService.sendHeartbeat();
    assert.strictEqual(realtimeMessageService.getConnectionCount(userBId), 1);
    streamB.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await t.test('10. Clean disconnect & teardown on logout / unmount', async () => {
    const stream1 = await openSSEStream(cookieA);
    const stream2 = await openSSEStream(cookieA);
    assert.strictEqual(realtimeMessageService.getConnectionCount(userAId), 2);

    stream1.close();
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(realtimeMessageService.getConnectionCount(userAId), 1);

    stream2.close();
    await new Promise((r) => setTimeout(r, 50));
    assert.strictEqual(realtimeMessageService.getConnectionCount(userAId), 0);
  });
});
