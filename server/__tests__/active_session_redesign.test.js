import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

test('Active Session Page Productivity Dashboard Redesign Suite', async (t) => {
  const activePagePath = path.resolve(rootDir, 'src/pages/ActiveSessionPage.jsx');
  const timerPath = path.resolve(rootDir, 'src/components/CircularGlassTimer.jsx');
  const appPath = path.resolve(rootDir, 'src/App.jsx');

  const activePageCode = fs.readFileSync(activePagePath, 'utf8');
  const timerCode = fs.readFileSync(timerPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  await t.test('1. CircularGlassTimer: Glassmorphic styling and circular progress ring present', () => {
    // Translucent dark glass surface & backdrop blur
    assert.ok(timerCode.includes('backdrop-blur-2xl'), 'Must have backdrop-blur-2xl');
    assert.ok(timerCode.includes('border-white/10') || timerCode.includes('border-white/'), 'Must have subtle semi-transparent border');
    assert.ok(timerCode.includes('rounded-full'), 'Must be a circular container');

    // Inner highlight reflection & depth shadow
    assert.ok(timerCode.includes('shadow-[inset_0_2px_4px'), 'Must have soft inner reflection shadow');

    // Cyan/teal SVG progress ring
    assert.ok(timerCode.includes('glassTimerGradient'), 'Must define cyan/teal gradient for progress ring');
    assert.ok(timerCode.includes('#22d3ee') || timerCode.includes('cyan'), 'Must have cyan accent');
    assert.ok(timerCode.includes('#14b8a6') || timerCode.includes('teal'), 'Must have teal accent');
    assert.ok(timerCode.includes('strokeDasharray'), 'Must compute SVG circumference strokeDasharray');
    assert.ok(timerCode.includes('strokeDashoffset'), 'Must compute SVG strokeDashoffset');

    // Dynamic timer typography and labels
    assert.ok(timerCode.includes('formatSecondsToTime(remainingSeconds)'), 'Must format remainingSeconds dynamically');
    assert.ok(!timerCode.includes('"24:52"'), 'Must NOT hardcode 24:52');
    assert.ok(timerCode.includes('Focus Session'), 'Must display "Focus Session" underneath');

    // Required control buttons: Pause/Resume and End Session (Restart removed per specs)
    assert.ok(timerCode.includes('onPause'), 'Must handle onPause');
    assert.ok(timerCode.includes('onResume'), 'Must handle onResume');
    assert.ok(timerCode.includes('onEndSession'), 'Must handle onEndSession');
    assert.ok(!timerCode.includes('RotateCcw'), 'Must NOT have RotateCcw icon');
    assert.ok(!timerCode.includes('>Restart<'), 'Must NOT have Restart button UI');
  });

  await t.test('2. ActiveSessionPage: Page header contains status indicator, heading & subtitle', () => {
    // Status indicator
    assert.ok(activePageCode.includes('Session Active'), 'Must show Session Active status');
    assert.ok(activePageCode.includes('Session Paused'), 'Must show Session Paused status');

    // Main Heading & subtitle
    assert.ok(activePageCode.includes('Focus Session'), 'Must include "Focus Session" main heading');
    assert.ok(activePageCode.includes('Stay focused. Make it count.'), 'Must include "Stay focused. Make it count." subtitle');
  });

  await t.test('3. ActiveSessionPage: Three-column productivity layout restored with Restart removed', () => {
    // 3-column responsive grid
    assert.ok(activePageCode.includes('lg:grid-cols-12'), 'Must use responsive 12-column or 3-column grid');

    // LEFT column features
    assert.ok(activePageCode.includes("Today's Focus"), 'Must have "Today\'s Focus" card');
    assert.ok(activePageCode.includes('Distractions Blocked'), 'Must have Distractions Blocked card');
    assert.ok(activePageCode.includes('distractionCount'), 'Must compute real distraction count from session segments');

    // CENTER column features
    assert.ok(activePageCode.includes('<CircularGlassTimer'), 'Must render CircularGlassTimer in center column');
    assert.ok(activePageCode.includes('remainingSeconds={remainingSeconds}'), 'Must pass remainingSeconds to CircularGlassTimer');
    assert.ok(activePageCode.includes('progressPercent={progressPercent}'), 'Must pass progressPercent to CircularGlassTimer');
    assert.ok(activePageCode.includes('onPause={onPause}'), 'Must pass onPause to CircularGlassTimer');
    assert.ok(activePageCode.includes('onResume={onResume}'), 'Must pass onResume to CircularGlassTimer');
    assert.ok(activePageCode.includes('onEndSession={handleManualEndSession}'), 'Must pass onEndSession to CircularGlassTimer');
    assert.ok(!activePageCode.includes('handleRestart'), 'Must NOT have handleRestart helper');

    // RIGHT column features
    assert.ok(activePageCode.includes('Mindful Focus'), 'Must have motivational Mindful Focus card');
    assert.ok(activePageCode.includes('Session Stats'), 'Must have Session Stats card');
    assert.ok(activePageCode.includes('Focus Status'), 'Must have Focus Status checklist');
    assert.ok(activePageCode.includes('Head Orientation'), 'Must show Head Orientation status');
  });

  await t.test('4. ActiveSessionPage: Preserves monitoring cards and modal workflows intact', () => {
    assert.ok(activePageCode.includes('<CameraMonitoringCard'), 'Must preserve CameraMonitoringCard');
    assert.ok(activePageCode.includes('<ScreenMonitorCard'), 'Must preserve ScreenMonitorCard');
    assert.ok(activePageCode.includes('<AIMonitoringCard'), 'Must preserve AIMonitoringCard');
    assert.ok(activePageCode.includes('<PauseConfirmModal'), 'Must preserve PauseConfirmModal');
    assert.ok(activePageCode.includes('<AutoResumeNoticeModal'), 'Must preserve AutoResumeNoticeModal');
  });
});
