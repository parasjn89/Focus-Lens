import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Activity Duration Breakdown Segmented Donut Icon Test Suite', async (t) => {
  const filePath = path.resolve(__dirname, '../../src/components/ActivityBreakdownChart.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  await t.test('1. Generic pie-chart icon in header is replaced', () => {
    assert.ok(!content.includes('<PieChart className="w-5 h-5" />'), 'Old generic 20px pie-chart icon in header must be replaced');
    assert.ok(!content.includes('bg-brand-500/10 text-brand-400 border border-brand-500/20'), 'Old plain brand-500 container must be replaced');
  });

  await t.test('2. New icon has rounded gradient container matching FocusLens visual family', () => {
    assert.ok(content.includes('bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400'), 'Must use smooth blue to cyan to teal gradient');
    assert.ok(content.includes('shadow-cyan-500/25'), 'Must have subtle cyan glow');
    assert.ok(content.includes('border-white/20'), 'Must have subtle highlight border');
    assert.ok(content.includes('rounded-xl sm:rounded-2xl'), 'Must have rounded square container');
  });

  await t.test('3. Segmented Donut SVG contains 4 clean segments with modern color tones', () => {
    // Segment 1: White
    assert.ok(content.includes('13.94 4.76 A 7.5 7.5') && content.includes('stroke="white"'), 'Segment 1 must be crisp white');
    // Segment 2: Cyan-white
    assert.ok(content.includes('19.24 13.94 A 7.5 7.5') && content.includes('stroke="#A5F3FC"'), 'Segment 2 must be glowing cyan-white');
    // Segment 3: Soft teal-white
    assert.ok(content.includes('10.06 19.24 A 7.5 7.5') && content.includes('strokeOpacity="0.75"'), 'Segment 3 must be soft teal-white');
    // Segment 4: Lavender/purple tint
    assert.ok(content.includes('4.76 10.06 A 7.5 7.5') && content.includes('stroke="#DDD6FE"'), 'Segment 4 must have subtle lavender/purple tint');
  });

  await t.test('4. All titles, subtitles, and tab names remain 100% unchanged', () => {
    assert.ok(content.includes('Activity Duration Breakdown'), 'Activity Duration Breakdown title must remain unchanged');
    assert.ok(content.includes('Distribution of session monitored time across activity categories'), 'Subtitle must remain unchanged');
    assert.ok(content.includes('Donut Chart'), 'Donut Chart tab must remain unchanged');
    assert.ok(content.includes('Distribution'), 'Distribution tab must remain unchanged');
    assert.ok(content.includes('Accessible Summary'), 'Accessible Summary tab must remain unchanged');
  });
});