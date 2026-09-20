import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FocusLens Session Setup (Concept #6 Productivity Dashboard) Suite', () => {
  const setupFilePath = resolve(process.cwd(), 'src/pages/SessionSetupPage.jsx');
  const sourceCode = readFileSync(setupFilePath, 'utf-8');

  it('1. Authoritative terminal status helpers and component exports remain intact', () => {
    assert.ok(sourceCode.includes('export const isTerminalCamera ='), 'Must export isTerminalCamera');
    assert.ok(sourceCode.includes('export const isTerminalScreen ='), 'Must export isTerminalScreen');
    assert.ok(sourceCode.includes('export const isPermissionsComplete ='), 'Must export isPermissionsComplete');
    assert.ok(sourceCode.includes('export function SessionSetupPage('), 'Must export SessionSetupPage');
  });

  it('2. Color palette invariants: Uses dark blue (#10232A) and deep teal / electric blue palette', () => {
    assert.ok(sourceCode.includes('#10232A'), 'Primary dominant background #10232A must be present');
    assert.ok(sourceCode.includes('#142A32'), 'Secondary background #142A32 must be present');
    assert.ok(sourceCode.includes('#18313A'), 'Card background #18313A must be present');
    assert.ok(sourceCode.includes('#203A43'), 'Elevated card surface #203A43 must be present');
    assert.ok(sourceCode.includes('#168CFF'), 'Electric blue primary accent #168CFF must be present');
    assert.ok(sourceCode.includes('#00B8E6'), 'Cyan secondary accent #00B8E6 must be present');
    assert.ok(sourceCode.includes('#F2F6F8'), 'Primary text color #F2F6F8 must be present');
    assert.ok(sourceCode.includes('#9BAFBC'), 'Secondary text color #9BAFBC must be present');
    assert.ok(sourceCode.includes('#718894'), 'Muted text color #718894 must be present');
  });

  it('3. Page Header: Features small eyebrow, main heading, subtitle, quote, and progress indicator', () => {
    assert.ok(sourceCode.includes('SESSION SETUP') || sourceCode.includes('Session Setup'), 'Header must include eyebrow');
    assert.ok(sourceCode.includes("Let's Get Focused"), 'Header must include main heading');
    assert.ok(sourceCode.includes('Configure your session and build momentum.'), 'Header must include subtitle');
    assert.ok(sourceCode.includes('The Only Easy Day Was Yesterday'), 'Header must include subtle motivational quote');

    // Progress indicator
    assert.ok(sourceCode.includes('Activity'), 'Progress indicator must include Activity');
    assert.ok(sourceCode.includes('Duration'), 'Progress indicator must include Duration');
    assert.ok(sourceCode.includes('Goal'), 'Progress indicator must include Goal');
    assert.ok(sourceCode.includes('Intention'), 'Progress indicator must include Intention');
  });

  it('4. Two-Column Dashboard Grid: Structured with left configuration and right intelligence column', () => {
    assert.ok(sourceCode.includes('lg:grid-cols-12'), 'Grid must use 12 columns for two-column desktop layout');
    assert.ok(sourceCode.includes('lg:col-span-8'), 'Left column must span 8 columns (~67%)');
    assert.ok(sourceCode.includes('lg:col-span-4'), 'Right column must span 4 columns (~33%)');
  });

  it('5. Activity section retains all 5 activities with custom input support', () => {
    assert.ok(sourceCode.includes("'Studying'"), 'Must include Studying');
    assert.ok(sourceCode.includes("'Coding'"), 'Must include Coding');
    assert.ok(sourceCode.includes("'Reading'"), 'Must include Reading');
    assert.ok(sourceCode.includes("'Watching Lecture'"), 'Must include Watching Lecture');
    assert.ok(sourceCode.includes("'Custom'"), 'Must include Custom');
    assert.ok(sourceCode.includes('customActivityInput'), 'Must include custom activity text input');
    assert.ok(sourceCode.includes('1. Choose Your Focus Activity'), 'Must have correct activity heading');
  });

  it('6. Duration section retains presets (15, 25, 45, 60, 90) and custom duration support', () => {
    assert.ok(sourceCode.includes('2. Set Focus Duration'), 'Must have duration heading');
    assert.ok(sourceCode.includes('durationPresets'), 'Must have duration presets');
    assert.ok(sourceCode.includes('customDurationInput'), 'Must have custom duration input');
    assert.ok(sourceCode.includes('isCustomDurationSelected'), 'Must support toggling custom duration');
  });

  it('7. Goal configuration supports None, Time, and Count targets with validation', () => {
    assert.ok(sourceCode.includes('3. Goal Configuration'), 'Must have goal configuration heading');
    assert.ok(sourceCode.includes('No Specific Target'), 'Must have No Specific Target option');
    assert.ok(sourceCode.includes('Time Target'), 'Must have Time Target option');
    assert.ok(sourceCode.includes('Count Target'), 'Must have Count Target option');
    assert.ok(sourceCode.includes('goalTextInput'), 'Must have goal description input');
    assert.ok(sourceCode.includes('targetFocusTimeInput'), 'Must have time target input');
    assert.ok(sourceCode.includes('targetCountInput'), 'Must have count target input');
    assert.ok(sourceCode.includes('targetUnitInput'), 'Must have count target unit input');
  });

  it('8. Session intention preserves 300 character limit and Focus Journal explanation', () => {
    assert.ok(sourceCode.includes('4. Session Intention'), 'Must have session intention heading');
    assert.ok(sourceCode.includes('sessionIntentionInput'), 'Must have intention textarea');
    assert.ok(sourceCode.includes('What do you want to accomplish in this session?'), 'Must have intention placeholder');
    assert.ok(sourceCode.includes('/ 300'), 'Must display character counter with 300 max limit');
  });

  it('9. Session Preview card renders circular timer visualization and live dynamic summaries', () => {
    assert.ok(sourceCode.includes('Session Preview'), 'Must render Session Preview card');
    assert.ok(sourceCode.includes('previewRingGradient'), 'Must render circular timer SVG progress ring');
    assert.ok(sourceCode.includes('formatPreviewTime'), 'Must compute live formatted time');
    assert.ok(sourceCode.includes('previewGoalText'), 'Must compute live goal text');
    assert.ok(sourceCode.includes('Will be monitored'), 'Must indicate distraction monitoring status');
  });

  it('10. Quick Tips card and Motivational card render required content', () => {
    assert.ok(sourceCode.includes('Quick Tips'), 'Must render Quick Tips card');
    assert.ok(sourceCode.includes('Choose a realistic duration'), 'Tip 1');
    assert.ok(sourceCode.includes('Set a clear intention'), 'Tip 2');
    assert.ok(sourceCode.includes('Keep distractions away'), 'Tip 3');
    assert.ok(sourceCode.includes('Take short breaks'), 'Tip 4');
    assert.ok(sourceCode.includes('Be consistent'), 'Tip 5');

    assert.ok(sourceCode.includes('Small Steps'), 'Motivational headline');
    assert.ok(sourceCode.includes('Big Results'), 'Motivational headline part 2');
    assert.ok(sourceCode.includes('Focus today. A better you tomorrow.'), 'Motivational subtitle');
  });

  it('11. Privacy Guarantee: Zero microphone UI or audio keys exist', () => {
    assert.ok(!sourceCode.includes('microphone'), 'Zero microphone references in SessionSetupPage');
    assert.ok(!sourceCode.includes('micStatus'), 'Zero micStatus references');
    assert.ok(sourceCode.includes('audio: false'), 'Browser media streams must have audio: false');
    assert.ok(sourceCode.includes('100% Client-Side Privacy Guarantee'), 'Displays client-side WebAssembly privacy banner');
  });

  it('12. Primary CTA: Full-width electric blue button triggers session initialization', () => {
    assert.ok(sourceCode.includes('Start Focus Session'), 'Primary CTA button text');
    assert.ok(sourceCode.includes('bg-gradient-to-r from-[#168CFF] to-[#00B8E6]'), 'Electric-blue to cyan gradient');
    assert.ok(sourceCode.includes('onCancel'), 'Cancel button available');
  });
});
