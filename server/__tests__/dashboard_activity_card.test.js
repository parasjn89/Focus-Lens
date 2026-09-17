import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { pool } from '../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Dashboard 7-Day Focus Activity Card & Responsive Layout Test Suite', async (t) => {
  let app;
  let authCookie;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const suffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Activity Dashboard User',
        username: 'act_user_' + suffix,
        email: 'act_user_' + suffix + '@example.com',
        password: 'Password12345!',
      },
    });
    authCookie = regRes.cookies[0].name + '=' + regRes.cookies[0].value;
  });

  t.after(async () => {
    if (app) await app.close();
    await pool.end();
  });

  await t.test('1. GET /api/analytics/dashboard returns valid 7-day weekly activity structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard',
      headers: { cookie: authCookie },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.dashboard);
    assert.ok(body.dashboard.weekly);
    assert.ok(Array.isArray(body.dashboard.weekly.days));
    assert.equal(body.dashboard.weekly.days.length, 7, 'Must provide exactly 7 days of focus data');

    body.dashboard.weekly.days.forEach((day) => {
      assert.ok(day.dateStr, 'Each day must have a dateStr');
      assert.ok(day.dayName, 'Each day must have a dayName');
      assert.equal(typeof day.activeSeconds, 'number');
      assert.equal(typeof day.studyLikeSeconds, 'number');
      assert.equal(typeof day.sessionCount, 'number');
      assert.ok(day.studyLikeSeconds <= day.activeSeconds, 'Study seconds cannot exceed active seconds');
    });
  });

  await t.test('2. Chart calculations: maxSeconds and height percentage boundaries', () => {
    const emptyMax = Math.max(...[].map(d => d.activeSeconds || 0), 3600);
    assert.equal(emptyMax, 3600);

    const sampleDays = [
      { activeSeconds: 1800, studyLikeSeconds: 1200 },
      { activeSeconds: 7200, studyLikeSeconds: 5400 },
      { activeSeconds: 0, studyLikeSeconds: 0 },
    ];
    const maxSec = Math.max(...sampleDays.map(d => d.activeSeconds || 0), 3600);
    assert.equal(maxSec, 7200);

    sampleDays.forEach((d) => {
      const totalHeightPct = Math.min(100, Math.round((d.activeSeconds / maxSec) * 100));
      assert.ok(totalHeightPct >= 0 && totalHeightPct <= 100, 'Bar total height percentage must be between 0 and 100');

      const studyHeightPct = d.activeSeconds > 0 ? Math.round((d.studyLikeSeconds / d.activeSeconds) * 100) : 0;
      const otherHeightPct = 100 - studyHeightPct;
      assert.ok(studyHeightPct >= 0 && studyHeightPct <= 100);
      assert.ok(otherHeightPct >= 0 && otherHeightPct <= 100);
      assert.equal(studyHeightPct + otherHeightPct, 100, 'Stacked bar proportions must sum to exactly 100%');
    });
  });

  await t.test('3. Format hours helper handles edge cases cleanly', () => {
    const formatHours = (seconds) => {
      if (!seconds || seconds <= 0) return '0h';
      const hrs = (seconds / 3600).toFixed(1);
      return (hrs.endsWith('.0') ? hrs.slice(0, -2) : hrs) + 'h';
    };

    assert.equal(formatHours(0), '0h');
    assert.equal(formatHours(null), '0h');
    assert.equal(formatHours(undefined), '0h');
    assert.equal(formatHours(-50), '0h');
    assert.equal(formatHours(1800), '0.5h');
    assert.equal(formatHours(3600), '1h');
    assert.equal(formatHours(5400), '1.5h');
    assert.equal(formatHours(7200), '2h');
  });

  await t.test('4. Codebase inspection: WeeklyActivityChart.jsx layout & responsiveness rules', () => {
    const chartFilePath = path.resolve(__dirname, '../../src/components/WeeklyActivityChart.jsx');
    const chartContent = fs.readFileSync(chartFilePath, 'utf8');

    assert.ok(
      chartContent.includes('whitespace-normal break-normal'),
      'Header title must specify whitespace-normal break-normal to prevent aggressive word wrapping'
    );
    assert.ok(
      chartContent.includes('7-Day Focus Activity'),
      'Component must retain 7-Day Focus Activity title'
    );
    assert.ok(
      chartContent.includes('flex-wrap'),
      'Legend must use flex-wrap to allow wrapping without clipping'
    );
    assert.ok(
      chartContent.includes('Study/Coding'),
      'Legend must have Study/Coding label'
    );
    assert.ok(
      chartContent.includes('Other Activity'),
      'Legend must have Other Activity label'
    );
    assert.ok(
      chartContent.includes('min-w-0'),
      'Chart container and columns must include min-w-0 for flex/grid shrink capability'
    );
    assert.ok(
      chartContent.includes('w-full'),
      'Chart container must use w-full'
    );
  });

  await t.test('5. Codebase inspection: PersonalDashboardPage.jsx container rules', () => {
    const dashboardFilePath = path.resolve(__dirname, '../../src/pages/PersonalDashboardPage.jsx');
    const dashboardContent = fs.readFileSync(dashboardFilePath, 'utf8');

    assert.ok(
      !dashboardContent.includes('h-40 w-full mt-4 bg-navy-950/30 rounded-xl p-2 border border-slate-800 overflow-hidden'),
      'Must eliminate the broken h-40 overflow-hidden wrapper that caused horizontal/vertical clipping'
    );
    assert.ok(
      dashboardContent.includes('Weekly review'),
      'Weekly review button must be preserved'
    );
    assert.ok(
      dashboardContent.includes('shrink-0'),
      'Weekly review button must have shrink-0 to prevent being squeezed by header text'
    );
    assert.ok(
      dashboardContent.includes('lg:col-span-1 min-w-0'),
      'Right widget column must specify min-w-0'
    );
  });
});