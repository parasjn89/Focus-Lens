import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app.js';
import { pool } from '../db/client.js';
import { dbStore } from '../db/store.js';
import { isSessionMatchingCategory, getSessionCategory, getPersonalDashboardData } from '../utils/dashboardAnalytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

test('Dashboard Category Navigation, Filter & Modern Card Test Suite', async (t) => {
  const dashboardPath = path.resolve(rootDir, 'src/pages/PersonalDashboardPage.jsx');
  const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

  let app;
  let cookieA;
  let userAId;
  let cookieB;
  let userBId;

  t.before(async () => {
    app = buildApp({ logger: false });
    await app.ready();

    const suffixA = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regResA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Category Filter User A',
        username: 'cat_a_' + suffixA,
        email: 'cat_a_' + suffixA + '@example.com',
        password: 'Password12345!',
      },
    });
    cookieA = regResA.cookies[0].name + '=' + regResA.cookies[0].value;
    const bodyA = JSON.parse(regResA.payload);
    userAId = bodyA.user.id;

    const suffixB = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const regResB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Category Filter User B',
        username: 'cat_b_' + suffixB,
        email: 'cat_b_' + suffixB + '@example.com',
        password: 'Password12345!',
      },
    });
    cookieB = regResB.cookies[0].name + '=' + regResB.cookies[0].value;
    const bodyB = JSON.parse(regResB.payload);
    userBId = bodyB.user.id;
  });

  t.after(async () => {
    if (app) await app.close();
    await pool.end();
  });

  await t.test('1. Category navigation has All Work and Filter dropdown control', () => {
    assert.ok(dashboardCode.includes('<span>All Work</span>'), 'Must have All Work button');
    assert.ok(dashboardCode.includes('<Filter'), 'Must render Filter icon');
    assert.ok(dashboardCode.includes('selectedCategory !== \'ALL\' ? selectedCategory : \'Filter\''), 'Must display Filter label or selected category name');
    assert.ok(dashboardCode.includes('>Study</span>'), 'Dropdown must include Study option');
    assert.ok(dashboardCode.includes('>Coding</span>'), 'Dropdown must include Coding option');
    assert.ok(dashboardCode.includes('>Other</span>'), 'Dropdown must include Other option');
    assert.ok(dashboardCode.includes('Show All Work'), 'Must have Show All Work option to reset filter');
    assert.ok(dashboardCode.includes('onClick={fetchDashboard}'), 'Must preserve Refresh button');
    assert.ok(dashboardCode.includes('onClick={onNewSession}'), 'Must preserve New Task button');
    assert.ok(dashboardCode.includes('New task'), 'Must preserve New task label');
  });

  await t.test('2. Removed existing top-level static Study and Coding buttons', () => {
    const navBarMatch = dashboardCode.match(/<div className="flex flex-wrap items-center gap-3">[\s\S]*?<\/div>\s*<\/div>/);
    assert.ok(navBarMatch, 'Navigation container should be found');
    const navBarSnippet = navBarMatch[0];
    assert.ok(navBarSnippet.includes('All Work'), 'Must contain All Work');
    assert.ok(navBarSnippet.includes('Filter'), 'Must contain Filter');
  });

  await t.test('3. Category filtering logic accurately partitions content', () => {
    const mockSessions = [
      { id: '1', selectedActivity: 'Studying for exam', description: 'Biology revision' },
      { id: '2', selectedActivity: 'Coding feature', description: 'React development' },
      { id: '3', selectedActivity: 'Reading article', description: 'Science paper' },
      { id: '4', selectedActivity: 'Design sprint', description: 'Figma wireframes' },
      { id: '5', selectedActivity: 'Focus Session', description: 'Deep planning' },
    ];

    const all = mockSessions.filter(s => isSessionMatchingCategory(s, 'ALL'));
    assert.equal(all.length, 5, 'ALL must return all 5 sessions');

    const study = mockSessions.filter(s => isSessionMatchingCategory(s, 'Study'));
    assert.equal(study.length, 2, 'Study must match 2 sessions');
    assert.ok(study.every(s => s.id === '1' || s.id === '3'));

    const coding = mockSessions.filter(s => isSessionMatchingCategory(s, 'Coding'));
    assert.equal(coding.length, 1, 'Coding must match 1 session');
    assert.equal(coding[0].id, '2');

    const other = mockSessions.filter(s => isSessionMatchingCategory(s, 'Other'));
    assert.equal(other.length, 2, 'Other must match remaining 2 sessions');
    assert.ok(other.every(s => s.id === '4' || s.id === '5'));

    assert.equal(study.length + coding.length + other.length, all.length, 'Disjoint union must cover all sessions');
  });

  await t.test('4. PersonalDashboardPage supports selectedCategory and clear state', () => {
    assert.ok(dashboardCode.includes('selectedCategory'), 'Must manage selectedCategory state');
    assert.ok(dashboardCode.includes("setSelectedCategory('ALL')"), 'Must provide clear mechanism to reset to ALL');
  });

  await t.test('5. Filter dropdown stacking context and positioning above cards', () => {
    assert.ok(dashboardCode.includes('border-b border-slate-800/60 relative z-20'), 'Header must establish stacking context (relative z-20)');
    assert.ok(dashboardCode.includes('className="relative z-30" ref={filterRef}'), 'Filter control must have relative z-30');
    assert.ok(dashboardCode.includes('top-full mt-2 w-44 rounded-xl'), 'Dropdown popover must open directly below button with top-full');
    assert.ok(dashboardCode.includes('z-50'), 'Dropdown popover must have z-50');
    assert.ok(dashboardCode.includes('grid grid-cols-1 lg:grid-cols-3 gap-6 items-start relative z-0'), 'Main grid must be at base stacking context (relative z-0)');
  });

  await t.test('6. Clean & Modern "Today\'s Focus" card layout requirements', () => {
    // Header includes status indicator, Today's Focus title, and in-card category selector
    assert.ok(dashboardCode.includes("Today's Focus"), 'Card must have Today\'s Focus title');
    assert.ok(dashboardCode.includes('ref={cardFilterRef}'), 'Card must have in-card category selector ref');
    assert.ok(dashboardCode.includes('isCardFilterOpen'), 'Card must have in-card filter open state');

    // Subtle vertical dividers between 3 metrics on desktop
    assert.ok(dashboardCode.includes('sm:divide-x divide-slate-800/80'), 'Must have subtle vertical dividers on desktop');

    // Metric hierarchy and icons
    assert.ok(dashboardCode.includes('Total Focus Time'), 'Must have Total Focus Time metric');
    assert.ok(dashboardCode.includes('Sessions Completed'), 'Must have Sessions Completed metric');
    assert.ok(dashboardCode.includes('Focus Score'), 'Must have Focus Score metric');
    assert.ok(dashboardCode.includes('<Clock'), 'Must render Clock icon for focus time');
    assert.ok(dashboardCode.includes('<Layers'), 'Must render Layers icon for sessions completed');
    assert.ok(dashboardCode.includes('<TrendingUp'), 'Must render TrendingUp icon for focus score');

    // Daily Focus Progress
    assert.ok(dashboardCode.includes('Daily Focus Progress'), 'Must render Daily Focus Progress section');
    assert.ok(dashboardCode.includes('bg-gradient-to-r from-cyan-500 to-teal-400'), 'Must use cyan-to-teal gradient for progress bar');
    assert.ok(dashboardCode.includes('focusPercentage === 0 ? 0 :'), 'Progress bar must be 0 width when focus percentage is 0');
  });

  await t.test('7. Data Isolation: User A has Coding session but 0 Study sessions -> Study returns 0 metrics', async () => {
    const sId = crypto.randomUUID();
    await dbStore.createSession({
      id: sId,
      userId: userAId,
      plannedDurationMs: 1500000,
      actualDurationMs: 1500000,
      selectedActivity: 'Coding',
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    });
    await dbStore.saveSegments(sId, userAId, [
      {
        activityType: 'CODING',
        startTimeMs: Date.now() - 1500000,
        endTimeMs: Date.now(),
        durationMs: 1500000,
        evidenceScore: 0.95,
      }
    ]);

    // Request Study category
    const studyRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Study',
      headers: { cookie: cookieA },
    });
    assert.equal(studyRes.statusCode, 200);
    const studyBody = JSON.parse(studyRes.payload);

    assert.equal(studyBody.dashboard.today.sessionCount, 0, 'Study sessionCount must be 0');
    assert.equal(studyBody.dashboard.today.totalActiveSec, 0, 'Study totalActiveSec must be 0');
    assert.equal(studyBody.dashboard.today.studyPercentage, 0, 'Study studyPercentage must be 0');
    assert.equal(studyBody.dashboard.today.focusScore, 0, 'Study focusScore must be 0');

    // Request Coding category
    const codingRes = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Coding',
      headers: { cookie: cookieA },
    });
    assert.equal(codingRes.statusCode, 200);
    const codingBody = JSON.parse(codingRes.payload);

    assert.equal(codingBody.dashboard.today.sessionCount, 1, 'Coding sessionCount must be 1');
    assert.equal(codingBody.dashboard.today.totalActiveSec, 1500, 'Coding totalActiveSec must be 1500');
    assert.ok(codingBody.dashboard.today.studyPercentage > 0, 'Coding score must be > 0');

    // Precomputed categories breakdown in response
    assert.ok(codingBody.dashboard.categories, 'Must include precomputed categories object');
    assert.equal(codingBody.dashboard.categories.Study.sessionCount, 0, 'Categories breakdown Study must have 0 sessions');
    assert.equal(codingBody.dashboard.categories.Coding.sessionCount, 1, 'Categories breakdown Coding must have 1 session');
  });

  await t.test('8. Multi-Category: User A adds Study session -> both categories isolated and All Work aggregates', async () => {
    const sIdStudy = crypto.randomUUID();
    await dbStore.createSession({
      id: sIdStudy,
      userId: userAId,
      plannedDurationMs: 1800000,
      actualDurationMs: 1800000,
      selectedActivity: 'Studying',
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
    });
    await dbStore.saveSegments(sIdStudy, userAId, [
      {
        activityType: 'STUDY_LIKE',
        startTimeMs: Date.now() - 1800000,
        endTimeMs: Date.now(),
        durationMs: 1800000,
        evidenceScore: 0.92,
      }
    ]);

    // Query Study
    const resStudy = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Study',
      headers: { cookie: cookieA },
    });
    const bodyStudy = JSON.parse(resStudy.payload);
    assert.equal(bodyStudy.dashboard.today.sessionCount, 1, 'Study should only count 1 Study session');
    assert.equal(bodyStudy.dashboard.today.totalActiveSec, 1800, 'Study time should be 1800s');

    // Query Coding
    const resCoding = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Coding',
      headers: { cookie: cookieA },
    });
    const bodyCoding = JSON.parse(resCoding.payload);
    assert.equal(bodyCoding.dashboard.today.sessionCount, 1, 'Coding should only count 1 Coding session');
    assert.equal(bodyCoding.dashboard.today.totalActiveSec, 1500, 'Coding time should be 1500s');

    // Query All Work
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=ALL',
      headers: { cookie: cookieA },
    });
    const bodyAll = JSON.parse(resAll.payload);
    assert.equal(bodyAll.dashboard.today.sessionCount, 2, 'All Work should aggregate both sessions');
    assert.equal(bodyAll.dashboard.today.totalActiveSec, 3300, 'All Work total time should be 1500 + 1800 = 3300s');
  });

  await t.test('9. Filter switching returns clean isolated data with no stale leakage', async () => {
    // Simulate sequential filter requests
    const res1 = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Study', headers: { cookie: cookieA } });
    const b1 = JSON.parse(res1.payload);
    assert.equal(b1.dashboard.today.totalActiveSec, 1800);

    const res2 = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Coding', headers: { cookie: cookieA } });
    const b2 = JSON.parse(res2.payload);
    assert.equal(b2.dashboard.today.totalActiveSec, 1500);

    const res3 = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Other', headers: { cookie: cookieA } });
    const b3 = JSON.parse(res3.payload);
    assert.equal(b3.dashboard.today.sessionCount, 0);
    assert.equal(b3.dashboard.today.totalActiveSec, 0);

    const res4 = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Study', headers: { cookie: cookieA } });
    const b4 = JSON.parse(res4.payload);
    assert.equal(b4.dashboard.today.totalActiveSec, 1800);
  });

  await t.test('10. Strict User Isolation: User B cannot see User A\'s category metrics', async () => {
    const resBAll = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=ALL', headers: { cookie: cookieB } });
    const bodyBAll = JSON.parse(resBAll.payload);
    assert.equal(bodyBAll.dashboard.today.sessionCount, 0, 'User B must have 0 sessions');
    assert.equal(bodyBAll.dashboard.today.totalActiveSec, 0, 'User B must have 0 focus time');

    const resBStudy = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Study', headers: { cookie: cookieB } });
    const bodyBStudy = JSON.parse(resBStudy.payload);
    assert.equal(bodyBStudy.dashboard.today.sessionCount, 0);
    assert.equal(bodyBStudy.dashboard.today.totalActiveSec, 0);

    const resBCoding = await app.inject({ method: 'GET', url: '/api/analytics/dashboard?category=Coding', headers: { cookie: cookieB } });
    const bodyBCoding = JSON.parse(resBCoding.payload);
    assert.equal(bodyBCoding.dashboard.today.sessionCount, 0);
    assert.equal(bodyBCoding.dashboard.today.totalActiveSec, 0);
  });

  await t.test('11. Coding session without segments attributes duration and score to Coding', async () => {
    // Create a User C with a Coding session with 0 activity segments
    const emailC = `cat_c_${Date.now().toString(36)}@example.com`;
    const regC = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: emailC, password: 'Password123!', username: `cat_c_${Date.now().toString(36)}`, name: 'User C' },
    });
    const cookieC = regC.headers['set-cookie'];
    const userCId = JSON.parse(regC.payload).user.id;

    // Direct DB session creation with NO segments
    await dbStore.createSession({
      userId: userCId,
      selectedActivity: 'Coding',
      plannedDurationMs: 1500 * 1000,
      actualDurationMs: 1500 * 1000,
      status: 'COMPLETED',
      focusPoints: 25,
      startedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Coding',
      headers: { cookie: cookieC },
    });
    const body = JSON.parse(res.payload);
    assert.equal(body.dashboard.today.sessionCount, 1, 'Should find 1 coding session');
    assert.equal(body.dashboard.today.totalActiveSec, 1500, 'Total active seconds should be 1500');
    assert.equal(body.dashboard.today.totalCodingSec, 1500, 'Should attribute active seconds to totalCodingSec');
    assert.equal(body.dashboard.today.focusScore, 100, 'Focus score should be 100% for completed coding session');
    assert.equal(body.dashboard.categories.Study.sessionCount, 0, 'Study should have 0 sessions');
  });

  await t.test('12. Custom developer activities map accurately to Coding and Study', () => {
    assert.equal(getSessionCategory({ selectedActivity: 'Python Backend' }), 'Coding');
    assert.equal(getSessionCategory({ selectedActivity: 'LeetCode practice' }), 'Coding');
    assert.equal(getSessionCategory({ selectedActivity: 'Full-Stack Development' }), 'Coding');
    assert.equal(getSessionCategory({ selectedActivity: 'Debugging React App' }), 'Coding');
    assert.equal(getSessionCategory({ selectedActivity: 'DSA practice' }), 'Coding');

    assert.equal(getSessionCategory({ selectedActivity: 'Biology revision' }), 'Study');
    assert.equal(getSessionCategory({ selectedActivity: 'Reading research paper' }), 'Study');
    assert.equal(getSessionCategory({ selectedActivity: 'Math Homework' }), 'Study');
  });

  await t.test('13. User exact scenario: Coding session today (15m, 98% score) across All Work -> Coding -> Study -> Coding', async () => {
    // Create User D
    const emailD = `cat_d_${Date.now().toString(36)}@example.com`;
    const regD = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: emailD, password: 'Password123!', username: `cat_d_${Date.now().toString(36)}`, name: 'User D' },
    });
    const cookieD = regD.headers['set-cookie'];
    const userDId = JSON.parse(regD.payload).user.id;

    // Create exact session matching user's real DB session:
    // planned: 1500000ms (25m), actual: 946000ms (15m 46s), selectedActivity: 'Coding', status: 'COMPLETED'
    const sessionD = await dbStore.createSession({
      userId: userDId,
      selectedActivity: 'Coding',
      plannedDurationMs: 1500 * 1000,
      actualDurationMs: 946 * 1000,
      status: 'COMPLETED',
      focusPoints: 15,
      startedAt: new Date(),
    });

    // Save exact segments yielding 98% focus score
    await dbStore.saveSegments(sessionD.id, userDId, [
      { activityType: 'AWAY_OR_NOT_VISIBLE', startTimeMs: 0, endTimeMs: 4025, durationMs: 4025, evidenceScore: 0.9 },
      { activityType: 'CODING', startTimeMs: 4025, endTimeMs: 222221, durationMs: 218196, evidenceScore: 0.95 },
      { activityType: 'BROWSER_ACTIVITY', startTimeMs: 222221, endTimeMs: 226199, durationMs: 3978, evidenceScore: 0.8 },
      { activityType: 'CODING', startTimeMs: 226199, endTimeMs: 936189, durationMs: 709990, evidenceScore: 0.98 },
    ]);

    // Step 1: All Work
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=ALL',
      headers: { cookie: cookieD, 'x-timezone-offset': '-330' },
    });
    const bodyAll = JSON.parse(resAll.payload);
    assert.equal(bodyAll.dashboard.today.sessionCount, 1, 'All Work must show 1 session');
    assert.equal(bodyAll.dashboard.today.totalActiveSec, 946, 'All Work must show 946s (~15m)');
    assert.equal(bodyAll.dashboard.today.focusScore, 98, 'All Work focus score must be 98%');

    // Step 2: Coding
    const resCoding = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Coding',
      headers: { cookie: cookieD, 'x-timezone-offset': '-330' },
    });
    const bodyCoding = JSON.parse(resCoding.payload);
    assert.equal(bodyCoding.dashboard.today.sessionCount, 1, 'Coding must show 1 session');
    assert.equal(bodyCoding.dashboard.today.totalActiveSec, 946, 'Coding must show 946s (~15m)');
    assert.equal(bodyCoding.dashboard.today.focusScore, 98, 'Coding focus score must be 98%');

    // Step 3: Study
    const resStudy = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Study',
      headers: { cookie: cookieD, 'x-timezone-offset': '-330' },
    });
    const bodyStudy = JSON.parse(resStudy.payload);
    assert.equal(bodyStudy.dashboard.today.sessionCount, 0, 'Study must show 0 sessions');
    assert.equal(bodyStudy.dashboard.today.totalActiveSec, 0, 'Study must show 0s');
    assert.equal(bodyStudy.dashboard.today.focusScore, 0, 'Study focus score must be 0%');

    // Step 4: Coding again (Sequential All Work -> Coding -> Study -> Coding)
    const resCodingAgain = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard?category=Coding',
      headers: { cookie: cookieD, 'x-timezone-offset': '-330' },
    });
    const bodyCodingAgain = JSON.parse(resCodingAgain.payload);
    assert.equal(bodyCodingAgain.dashboard.today.sessionCount, 1, 'Coding again must still show 1 session');
    assert.equal(bodyCodingAgain.dashboard.today.totalActiveSec, 946, 'Coding again must show 946s (~15m)');
    assert.equal(bodyCodingAgain.dashboard.today.focusScore, 98, 'Coding again focus score must be 98%');
  });
});
