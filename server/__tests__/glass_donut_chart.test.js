import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Glass Donut Chart - Concept #5 Visual Redesign Test Suite', async (t) => {
  const filePath = path.resolve(__dirname, '../../src/components/ActivityBreakdownChart.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  await t.test('1. Component incorporates GlassDonutChart with concept #5 architecture', () => {
    assert.ok(content.includes('function GlassDonutChart('), 'GlassDonutChart component must be defined');
    assert.ok(content.includes('<GlassDonutChart'), 'GlassDonutChart must be rendered in comparative chartMode');
    assert.ok(content.includes('const DonutChart = GlassDonutChart'), 'DonutChart alias must be preserved for compatibility');
  });

  await t.test('2. SVG definitions include glass glow filters, category gradients, and specular gradient', () => {
    assert.ok(content.includes('id="glass-glow-active"'), 'Must include glowing filter for active/hovered segments');
    assert.ok(content.includes('id="glass-segment-shadow"'), 'Must include depth drop-shadow for segments');
    assert.ok(content.includes('id="grad-CODING"'), 'Must include linear gradient for CODING');
    assert.ok(content.includes('id="grad-STUDY_LIKE"'), 'Must include linear gradient for STUDY_LIKE');
    assert.ok(content.includes('id="grad-PHONE_ACTIVITY"'), 'Must include linear gradient for PHONE_ACTIVITY');
    assert.ok(content.includes('id="grad-VIDEO_ACTIVITY"'), 'Must include linear gradient for VIDEO_ACTIVITY');
    assert.ok(content.includes('id="glass-specular"'), 'Must include specular glass sheen linear gradient');
  });

  await t.test('3. Glass translucent groove track and rim highlights are present', () => {
    // Outer subtle rim
    assert.ok(content.includes('r={radius + strokeWidth / 2}'), 'Must render outer rim highlight at outer radius');
    assert.ok(content.includes('stroke="rgba(255, 255, 255, 0.08)"'), 'Must have subtle outer white rim stroke');
    // Inner subtle rim
    assert.ok(content.includes('r={radius - strokeWidth / 2}'), 'Must render inner rim highlight at inner radius');
    assert.ok(content.includes('stroke="rgba(255, 255, 255, 0.06)"'), 'Must have subtle inner white rim stroke');
    // Dark translucent glass track
    assert.ok(content.includes('stroke="#0f172a"'), 'Must render dark translucent glass track');
    assert.ok(content.includes('strokeOpacity="0.75"'), 'Must have translucent track opacity');
  });

  await t.test('4. Ambient radial bloom glow container is present behind the donut', () => {
    assert.ok(
      content.includes('bg-gradient-to-tr from-blue-600/20 via-cyan-500/15 to-purple-600/20 blur-2xl'),
      'Must have ambient radial bloom glow behind donut ring'
    );
  });

  await t.test('5. Rounded segment edges and adaptive gap spacing logic are implemented', () => {
    assert.ok(content.includes("strokeLinecap = 'round'"), 'Must use round line caps for multi-category segments');
    assert.ok(content.includes('activeCount === 1'), 'Must handle single-category case gracefully without gaps');
    assert.ok(content.includes('capAllowance'), 'Must calculate adaptive cap allowance to avoid overlap');
  });

  await t.test('6. Top specular reflection sheen is rendered along the upper curve', () => {
    assert.ok(content.includes('M 42.7 59.8 A 70 70 0 0 1 157.3 59.8'), 'Must render top specular reflection curve arc');
    assert.ok(content.includes('stroke="url(#glass-specular)"'), 'Must use glass-specular gradient on sheen arc');
  });

  await t.test('7. Center display preserves uppercase "TOTAL" and formatted duration, with hover inspector', () => {
    assert.ok(content.includes('TOTAL'), 'Default center display must have TOTAL label');
    assert.ok(content.includes('{formatSecondsToTime(totalDisplayedDuration)}'), 'Must show formatted total duration');
    assert.ok(content.includes('hoveredCategory ?'), 'Must support dynamic details inspector when hovered');
  });

  await t.test('8. Bidirectional hover interaction connects donut segments and right-side legend items', () => {
    assert.ok(content.includes('onMouseEnter={() => setHoveredCategory(type)}'), 'Legend item must trigger hoveredCategory on mouse enter');
    assert.ok(content.includes('onMouseLeave={() => setHoveredCategory(null)}'), 'Legend item must clear hoveredCategory on mouse leave');
    assert.ok(content.includes('onHoverCategory?.(type)'), 'Donut segment must trigger onHoverCategory');
  });

  await t.test('9. All section titles, labels, tabs, and analytics integrity remain 100% intact', () => {
    assert.ok(content.includes('Activity Duration Breakdown'), 'Activity Duration Breakdown title preserved');
    assert.ok(content.includes('Distribution of session monitored time across activity categories'), 'Subtitle preserved');
    assert.ok(content.includes('Donut Chart'), 'Donut Chart tab preserved');
    assert.ok(content.includes('Distribution'), 'Distribution tab preserved');
    assert.ok(content.includes('Accessible Summary'), 'Accessible Summary tab preserved');
  });
});
