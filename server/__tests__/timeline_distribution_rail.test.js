import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Activity Duration Breakdown - Concept #5 Timeline Rail Test Suite', async (t) => {
  const filePath = path.resolve(__dirname, '../../src/components/ActivityBreakdownChart.jsx');
  const content = fs.readFileSync(filePath, 'utf8');

  await t.test('1. ActivityTimelineRail is defined and rendered in chartMode === "stacked" (Distribution tab)', () => {
    assert.ok(content.includes('function ActivityTimelineRail('), 'ActivityTimelineRail component must be defined');
    assert.ok(content.includes("{chartMode === 'stacked' && ("), 'chartMode === stacked must guard the timeline rail');
    assert.ok(content.includes('<ActivityTimelineRail'), 'ActivityTimelineRail must be rendered in stacked chartMode');
  });

  await t.test('2. Mode 1 (Donut Chart) and Mode 3 (Accessible Summary) remain intact', () => {
    assert.ok(content.includes('function GlassDonutChart('), 'GlassDonutChart is preserved in the file');
    assert.ok(content.includes("{chartMode === 'comparative' && ("), 'chartMode === comparative renders GlassDonutChart');
    assert.ok(content.includes('<GlassDonutChart'), 'GlassDonutChart is rendered');
    assert.ok(content.includes("{chartMode === 'table' && ("), 'chartMode === table renders accessible table');
  });

  await t.test('3. Horizontal capsule rail uses dark translucent glass styling, ambient glow, and specular sheen', () => {
    assert.ok(content.includes('rounded-full bg-slate-900/90 border border-slate-700/60'), 'Must have rounded-full capsule rail frame');
    assert.ok(content.includes('bg-gradient-to-r from-blue-600/15 via-cyan-500/15 to-purple-600/15 rounded-full blur-xl'), 'Must have ambient glow behind rail');
    assert.ok(content.includes('bg-gradient-to-r from-white/0 via-white/25 to-white/0'), 'Must have top specular highlight sheen');
  });

  await t.test('4. Proportional segments are rendered with real category percentages and gradients', () => {
    assert.ok(content.includes('style={{ width: `${pct}%` }}'), 'Must render segment width based on real percentage');
    assert.ok(content.includes('categoryRanges.map'), 'Must map over precomputed proportional category ranges');
    assert.ok(content.includes('CATEGORY_COLORS[type]'), 'Must map category styles from CATEGORY_COLORS');
  });

  await t.test('5. Small glowing transition markers correspond to real activity transitions', () => {
    assert.ok(content.includes('key={`marker-${type}`}'), 'Must render marker for each category transition');
    assert.ok(content.includes('rounded-full border-2 border-slate-950'), 'Marker must be small circular dot with dark border');
    assert.ok(content.includes('style={{ left: `${Math.max(1.5, Math.min(98.5, start))}%` }}'), 'Marker must be placed at category transition start %');
  });

  await t.test('6. Summary header displays "TOTAL MONITORED" with dynamic duration', () => {
    assert.ok(content.includes('TOTAL MONITORED'), 'Must display "TOTAL MONITORED" uppercase label');
    assert.ok(content.includes('{formatSecondsToTime(totalDisplayedDuration)}'), 'Must display dynamic formatted total duration');
  });

  await t.test('7. Dynamic time scale ruler is generated dynamically from monitored duration', () => {
    assert.ok(content.includes('timeTicks'), 'Must calculate timeTicks array');
    assert.ok(content.includes('Math.round(totalDisplayedDuration * fraction)'), 'Must dynamically calculate time from totalDisplayedDuration');
    assert.ok(content.includes('tick.formatted'), 'Must render formatted time string for each tick');
  });

  await t.test('8. Compact hover tooltip displays real category, duration, and percentage', () => {
    assert.ok(content.includes('hoveredCategory && hoveredRange'), 'Must display tooltip on hover');
    assert.ok(content.includes('{formatSecondsToTime(durations[hoveredCategory] || 0)}'), 'Tooltip must show real category duration');
    assert.ok(content.includes('{percentages[hoveredCategory] || 0}%'), 'Tooltip must show real category percentage');
  });

  await t.test('9. Activity legend is rendered below the timeline with bidirectional hover support', () => {
    assert.ok(content.includes('Category Distribution Legend'), 'Must include legend section below timeline');
    assert.ok(content.includes('onMouseEnter={() => onHoverCategory?.(type)}'), 'Legend item must trigger onHoverCategory on mouse enter');
    assert.ok(content.includes('onMouseLeave={() => onHoverCategory?.(null)}'), 'Legend item must clear onHoverCategory on mouse leave');
  });

  await t.test('10. All section titles, labels, tabs, and analytics integrity remain 100% intact', () => {
    assert.ok(content.includes('Activity Duration Breakdown'), 'Activity Duration Breakdown title preserved');
    assert.ok(content.includes('Distribution of session monitored time across activity categories'), 'Subtitle preserved');
    assert.ok(content.includes('Donut Chart'), 'Donut Chart tab preserved');
    assert.ok(content.includes('Distribution'), 'Distribution tab preserved');
    assert.ok(content.includes('Accessible Summary'), 'Accessible Summary tab preserved');
  });
});
