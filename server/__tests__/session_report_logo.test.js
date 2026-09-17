import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Session Report Award Badge Hero Logo Test Suite', async (t) => {
  const reportPagePath = path.resolve(__dirname, '../../src/pages/SessionReportPage.jsx');
  const content = fs.readFileSync(reportPagePath, 'utf8');

  await t.test('1. Old generic w-16 h-16 Award icon container is completely replaced', () => {
    assert.ok(!content.includes('w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400'), 'Old 64px generic Award container must be removed');
    assert.ok(!content.includes('<Award className="w-8 h-8 text-white" />'), 'Old 32px generic Award icon must be replaced');
  });

  await t.test('2. New award badge logo container has blue-to-teal gradient, glow, and 88-100px desktop sizing', () => {
    assert.ok(content.includes('from-blue-600 via-cyan-500 to-teal-400'), 'Container must have smooth blue to cyan to teal gradient');
    assert.ok(content.includes('shadow-cyan-500/25') || content.includes('shadow-cyan'), 'Container must have subtle glow');
    assert.ok(content.includes('sm:w-24 sm:h-24'), 'Container must scale to ~96px square on desktop (88-100px range)');
    assert.ok(content.includes('w-20 h-20'), 'Container must scale responsively on mobile');
    assert.ok(content.includes('mx-auto'), 'Container must remain centered horizontally');
  });

  await t.test('3. Custom SVG includes medal circle, center star, and two ribbon tails', () => {
    // Circle medallion
    assert.ok(content.includes('<circle') && content.includes('r="16.5"') && content.includes('stroke="white"'), 'Must contain white circle medallion outline');
    // Star in center
    assert.ok(content.includes('fill="white"') && content.includes('32 16.5'), 'Must contain centered white star');
    // Two ribbon tails
    assert.ok(content.includes('M21.5 36.5 L17 56') && content.includes('M35.5 40 L39 50.5'), 'Must contain two white ribbon tails hanging below');
  });

  await t.test('4. Preserves exact title, description, and Session Completed badge', () => {
    assert.ok(content.includes('SESSION REPORT'), 'Must preserve SESSION REPORT title unchanged');
    assert.ok(content.includes('Derived activity report for <strong>{activity}</strong> completed at {completedAt}.'), 'Must preserve exact description unchanged');
    assert.ok(content.includes('Session Completed'), 'Must preserve Session Completed badge');
  });

  await t.test('5. Focus Points Earned card uses new Focus Flame icon with blue-to-teal gradient', () => {
    // Medal icon inside Focus Points card is replaced
    assert.ok(!content.includes('<div className="p-3 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">'), 'Old Focus Points medal container must be replaced');
    
    // Flame icon is present in 64px rounded-square container
    assert.ok(content.includes('<Flame className="w-8 h-8 text-white drop-shadow-sm"'), 'Flame icon must be white with drop shadow and stroke');
    assert.ok(content.includes('w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400'), 'Focus Flame container must be 64px rounded square with blue to teal gradient');
    assert.ok(content.includes('hover:shadow-cyan-400/40'), 'Must have subtle hover glow interaction');

    // Content and calculations remain intact
    assert.ok(content.includes('Focus Points Earned'), 'Text Focus Points Earned must be preserved');
    assert.ok(content.includes('+{pointsData.focusPoints}'), 'Points value expression must be preserved');
    assert.ok(content.includes('calculateFocusPointsFromDurations(categoryDurations)'), 'Focus Points calculation must be preserved');
  });
});