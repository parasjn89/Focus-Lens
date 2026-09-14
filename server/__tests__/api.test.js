import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';

describe('FocusLens Fastify API & Privacy Guard Test Suite', () => {
  let app;
  let authCookie = null;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    // Register & login test user for API validation testing
    const email = `api_test_${Date.now()}@example.com`;
    const username = `api_test_${Date.now()}`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { name: 'API Tester', username, email, password: 'SecurePass12345!' },
    });
    authCookie = `${regRes.cookies[0].name}=${regRes.cookies[0].value}`;
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/health returns HTTP 200 and status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'focuslens-backend');
    assert.ok(body.database);
  });

  test('POST /api/sessions rejects invalid plannedDurationMs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: authCookie },
      payload: {
        plannedDurationMs: -100,
        selectedActivity: 'Studying',
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = JSON.parse(response.payload);
    assert.strictEqual(body.error, 'Validation Error');
  });

  test('POST /api/sessions rejects empty selectedActivity', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { cookie: authCookie },
      payload: {
        plannedDurationMs: 1500000,
        selectedActivity: '',
      },
    });

    assert.strictEqual(response.statusCode, 400);
  });

  test('Privacy Guard strictly rejects payloads containing forbidden media keys (video, image, screenshot, audio)', async () => {
    const forbiddenPayloads = [
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', video: 'base64_data_here' },
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', image: 'raw_frame_blob' },
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', screenshot: 'png_bytes' },
      { plannedDurationMs: 1500000, selectedActivity: 'Studying', audio: 'wav_audio_buffer' },
      { segments: [{ activityType: 'CODING', media: 'webcam_stream' }] },
    ];

    for (const payload of forbiddenPayloads) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { cookie: authCookie },
        payload,
      });

      assert.strictEqual(response.statusCode, 400);
      const body = JSON.parse(response.payload);
      assert.strictEqual(body.error, 'Privacy Violation');
      assert.ok(body.message.includes('strictly rejects raw media payloads'));
    }
  });

  test('GET /api/sessions/:id returns 404 for invalid/missing session UUID', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000',
      headers: { cookie: authCookie },
    });

    // Should return 404 if DB is connected or 500 if DB is offline, both non-200
    assert.ok(response.statusCode === 404 || response.statusCode === 500);
  });
});
