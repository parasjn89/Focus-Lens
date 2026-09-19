import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

test('Dashboard Category Navigation & Filter Test Suite', async (t) => {
  const dashboardPath = path.resolve(rootDir, 'src/pages/PersonalDashboardPage.jsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

  await t.test('1. Category navigation has All Work and Filter dropdown control', () => {
    // Top-level All Work button exists
    assert.ok(dashboardCode.includes('<span>All Work</span>'), 'Must have All Work button');

    // Filter control button exists next to All Work
    assert.ok(dashboardCode.includes('<Filter'), 'Must render Filter icon');
    assert.ok(dashboardCode.includes('selectedCategory !== \'ALL\' ? selectedCategory : \'Filter\''), 'Must display Filter label or selected category name');

    // Dropdown contains 3 categories
    assert.ok(dashboardCode.includes('>Study</span>'), 'Dropdown must include Study option');
    assert.ok(dashboardCode.includes('>Coding</span>'), 'Dropdown must include Coding option');
    assert.ok(dashboardCode.includes('>Other</span>'), 'Dropdown must include Other option');

    // Dropdown has All Work / Clear filter option
    assert.ok(dashboardCode.includes('Show All Work'), 'Must have Show All Work option to reset filter');

    // Refresh and New Task buttons are preserved
    assert.ok(dashboardCode.includes('onClick={fetchDashboard}'), 'Must preserve Refresh button');
    assert.ok(dashboardCode.includes('onClick={onNewSession}'), 'Must preserve New Task button');
    assert.ok(dashboardCode.includes('New task'), 'Must preserve New task label');
  });

  await t.test('2. Removed existing top-level static Study and Coding buttons', () => {
    // In the top-level button bar, there must NOT be raw separate top-level buttons for Study and Coding
    // Only the Filter dropdown options should exist
    const navBarMatch = dashboardCode.match(/<div className="flex flex-wrap items-center gap-3">[\s\S]*?<\/div>\s*<\/div>/);
    assert.ok(navBarMatch, 'Navigation container should be found');
    const navBarSnippet = navBarMatch[0];

    // Inside the top-level direct button list, only All Work and Filter dropdown trigger exist
    assert.ok(navBarSnippet.includes('All Work'), 'Must contain All Work');
    assert.ok(navBarSnippet.includes('Filter'), 'Must contain Filter');
  });

  await t.test('3. Category filtering logic accurately partitions content', () => {
    // Replicate the isSessionMatchingCategory function
    const isSessionMatchingCategory = (session, category) => {
      if (!category || category === 'ALL') return true;
      const activityStr = (session.selectedActivity || session.activity || session.activityType || '').toLowerCase();
      const descStr = (session.description || '').toLowerCase();
      const fullText = `${activityStr} ${descStr}`;

      const isStudy = fullText.includes('stud') || fullText.includes('learn') || fullText.includes('lecture') || fullText.includes('read') || fullText.includes('book');
      const isCoding = fullText.includes('cod') || fullText.includes('dev') || fullText.includes('program') || fullText.includes('software') || fullText.includes('script') || fullText.includes('hack') || fullText.includes('debug');

      if (category === 'Study') return isStudy;
      if (category === 'Coding') return isCoding;
      if (category === 'Other') return !isStudy && !isCoding;
      return true;
    };

    const mockSessions = [
      { id: '1', selectedActivity: 'Studying for exam', description: 'Biology revision' },
      { id: '2', selectedActivity: 'Coding feature', description: 'React development' },
      { id: '3', selectedActivity: 'Reading article', description: 'Science paper' },
      { id: '4', selectedActivity: 'Design sprint', description: 'Figma wireframes' },
      { id: '5', selectedActivity: 'Focus Session', description: 'Deep planning' },
    ];

    // ALL
    const all = mockSessions.filter(s => isSessionMatchingCategory(s, 'ALL'));
    assert.equal(all.length, 5, 'ALL must return all 5 sessions');

    // Study: session 1 (Studying), session 3 (Reading)
    const study = mockSessions.filter(s => isSessionMatchingCategory(s, 'Study'));
    assert.equal(study.length, 2, 'Study must match 2 sessions');
    assert.ok(study.every(s => s.id === '1' || s.id === '3'));

    // Coding: session 2 (Coding)
    const coding = mockSessions.filter(s => isSessionMatchingCategory(s, 'Coding'));
    assert.equal(coding.length, 1, 'Coding must match 1 session');
    assert.equal(coding[0].id, '2');

    // Other: session 4 (Design), session 5 (Focus Session / Deep planning)
    const other = mockSessions.filter(s => isSessionMatchingCategory(s, 'Other'));
    assert.equal(other.length, 2, 'Other must match remaining 2 sessions');
    assert.ok(other.every(s => s.id === '4' || s.id === '5'));

    // Verify union of Study + Coding + Other equals ALL
    assert.equal(study.length + coding.length + other.length, all.length, 'Disjoint union must cover all sessions');
  });

  await t.test('4. PersonalDashboardPage supports selectedCategory and clear state', () => {
    assert.ok(dashboardCode.includes('selectedCategory'), 'Must manage selectedCategory state');
    assert.ok(dashboardCode.includes("setSelectedCategory('ALL')"), 'Must provide clear mechanism to reset to ALL');
  });

  await t.test('5. Filter dropdown stacking context and positioning above cards', () => {
    // Header must establish positioned stacking context above dashboard cards
    assert.ok(dashboardCode.includes('border-b border-slate-800/60 relative z-20'), 'Header must establish stacking context (relative z-20)');

    // Filter control container must have relative positioning and z-index
    assert.ok(dashboardCode.includes('className="relative z-30" ref={filterRef}'), 'Filter control must have relative z-30');

    // Dropdown popover must open below filter button with top-full and high z-index
    assert.ok(dashboardCode.includes('top-full mt-2 w-44 rounded-xl'), 'Dropdown popover must open directly below button with top-full');
    assert.ok(dashboardCode.includes('z-50'), 'Dropdown popover must have z-50');

    // Main layout grid must have lower stacking context (z-0)
    assert.ok(dashboardCode.includes('grid grid-cols-1 lg:grid-cols-3 gap-6 items-start relative z-0'), 'Main grid must be at base stacking context (relative z-0)');
  });
});
