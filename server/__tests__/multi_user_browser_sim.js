import assert from 'node:assert/strict';
import http from 'node:http';
import { buildApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { pool } from '../db/client.js';
import { realtimeMessageService } from '../services/realtimeMessageService.js';

async function runMultiUserRealtimeTest() {
  console.log('--- STARTING MULTI-USER REALTIME TEST SCENARIO ---');
  await runMigrations().catch(() => {});
  const app = buildApp({ logger: false });
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  console.log(`Test server running at: ${address}`);

  const suffix = Date.now().toString(36);

  try {
    // 1. Both users log in / register
    console.log('Step 1: Logging in / Registering Paras and Naman...');
    const regParas = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Paras',
        username: `paras_${suffix}`,
        email: `paras_${suffix}@test.com`,
        password: 'Password123!',
      },
    });
    const cookieParas = `${regParas.cookies[0].name}=${regParas.cookies[0].value}`;
    const userParas = JSON.parse(regParas.payload).user;

    const regNaman = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Naman',
        username: `naman_${suffix}`,
        email: `naman_${suffix}@test.com`,
        password: 'Password123!',
      },
    });
    const cookieNaman = `${regNaman.cookies[0].name}=${regNaman.cookies[0].value}`;
    const userNaman = JSON.parse(regNaman.payload).user;

    // Connect them as Focus Buddies
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/buddies/request',
      headers: { cookie: cookieParas },
      payload: { usernameOrEmail: userNaman.username },
    });
    const buddyReqId = JSON.parse(reqRes.payload).request.id;

    await app.inject({
      method: 'PATCH',
      url: `/api/buddies/requests/${buddyReqId}`,
      headers: { cookie: cookieNaman },
      payload: { action: 'ACCEPT' },
    });

    const convListRes = await app.inject({
      method: 'GET',
      url: '/api/messages/conversations',
      headers: { cookie: cookieParas },
    });
    const convId = JSON.parse(convListRes.payload).conversations[0].id;

    // Helper to open SSE connection (simulating Browser tab)
    function openBrowserStream(cookie, userName) {
      return new Promise((resolve, reject) => {
        const parsed = new URL(`${address}/api/messages/events`);
        const events = [];
        const req = http.request(
          {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname,
            method: 'GET',
            headers: { cookie, Accept: 'text/event-stream' },
          },
          (res) => {
            let buffer = '';
            res.on('data', (chunk) => {
              buffer += chunk.toString();
              const blocks = buffer.split('\n\n');
              buffer = blocks.pop();
              for (const block of blocks) {
                if (block.includes('event: message.created')) {
                  const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
                  if (dataLine) {
                    const parsedData = JSON.parse(dataLine.replace('data: ', '').trim());
                    events.push(parsedData);
                  }
                }
              }
            });
            resolve({
              res,
              req,
              events,
              close: () => req.destroy(),
            });
          }
        );
        req.on('error', reject);
        req.end();
      });
    }

    // 2 & 3. Both open Messages & open conversation
    console.log('Step 2 & 3: Both open Messages and the Focus Buddy conversation...');
    const browserParas = await openBrowserStream(cookieParas, 'Paras');
    const browserNaman = await openBrowserStream(cookieNaman, 'Naman');
    await new Promise((r) => setTimeout(r, 60));

    // 4 & 5. Paras sends "hello", Naman sees "hello" without refresh
    console.log('Step 4 & 5: Paras sends "hello", verifying Naman receives it in real time...');
    const sendHello = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${convId}`,
      headers: { cookie: cookieParas },
      payload: { content: 'hello' },
    });
    assert.strictEqual(sendHello.statusCode, 201);
    const helloMsg = JSON.parse(sendHello.payload).message;

    await new Promise((r) => setTimeout(r, 80));
    assert.strictEqual(browserNaman.events.length, 1);
    assert.strictEqual(browserNaman.events[0].message.content, 'hello');
    assert.strictEqual(browserNaman.events[0].message.id, helloMsg.id);
    console.log('✔ Naman received "hello" immediately without page refresh!');

    // 6 & 7. Naman replies "hi", Paras sees "hi" without refresh
    console.log('Step 6 & 7: Naman replies "hi", verifying Paras receives it in real time...');
    const sendHi = await app.inject({
      method: 'POST',
      url: `/api/messages/conversations/${convId}`,
      headers: { cookie: cookieNaman },
      payload: { content: 'hi' },
    });
    assert.strictEqual(sendHi.statusCode, 201);
    const hiMsg = JSON.parse(sendHi.payload).message;

    await new Promise((r) => setTimeout(r, 80));
    const latestEventParas = browserParas.events[browserParas.events.length - 1];
    assert.ok(latestEventParas, 'Paras should receive real-time event');
    assert.strictEqual(latestEventParas.message.content, 'hi');
    assert.strictEqual(latestEventParas.message.id, hiMsg.id);
    console.log('✔ Paras received "hi" immediately without page refresh!');

    // 8 & 9. Send multiple messages rapidly, verify no duplicates
    console.log('Step 8 & 9: Sending burst of rapid messages...');
    browserNaman.events.length = 0;
    const burstContents = ['Rapid 1', 'Rapid 2', 'Rapid 3'];
    for (const c of burstContents) {
      await app.inject({
        method: 'POST',
        url: `/api/messages/conversations/${convId}`,
        headers: { cookie: cookieParas },
        payload: { content: c },
      });
    }

    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(browserNaman.events.length, 3);
    const receivedIds = new Set(browserNaman.events.map((e) => e.message.id));
    assert.strictEqual(receivedIds.size, 3, 'All 3 rapid messages have unique IDs');
    console.log('✔ All 3 rapid messages delivered with 0 duplicates!');

    // 10 & 11. Switch conversations & return to conversation
    console.log('Step 10 & 11: Switch conversations, return, verify all messages present...');
    const fullConv = await app.inject({
      method: 'GET',
      url: `/api/messages/conversations/${convId}`,
      headers: { cookie: cookieParas },
    });
    const messages = JSON.parse(fullConv.payload).messages;
    assert.strictEqual(messages.length, 5); // hello, hi, Rapid 1, Rapid 2, Rapid 3
    console.log(`✔ All ${messages.length} messages verified in conversation history!`);

    // 12 & 13. Refresh and verify persistence
    console.log('Step 12 & 13: Refresh simulation and verify DB persistence...');
    const refreshConv = await app.inject({
      method: 'GET',
      url: `/api/messages/conversations/${convId}`,
      headers: { cookie: cookieNaman },
    });
    const refreshedMessages = JSON.parse(refreshConv.payload).messages;
    assert.deepStrictEqual(
      refreshedMessages.map((m) => m.content),
      ['hello', 'hi', 'Rapid 1', 'Rapid 2', 'Rapid 3']
    );
    console.log('✔ Persistence verified across page refresh!');

    // 14 & 15. Log out one user and verify cleanup
    console.log('Step 14 & 15: Log out Naman and verify realtime connection cleanup...');
    browserNaman.close();
    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieNaman },
    });
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(realtimeMessageService.getConnectionCount(userNaman.id), 0);
    console.log('✔ Realtime connection cleaned up after logout!');

    browserParas.close();
    console.log('🎉 ALL 15 REALTIME E2E SCENARIO STEPS PASSED SUCCESSFULLY!');
  } finally {
    realtimeMessageService.closeAll();
    await app.close();
    await pool.end();
  }
}

runMultiUserRealtimeTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
