# ANTIGRAVITY_HANDOFF.md — FocusLens Project Handoff Document

**Project Name**: FocusLens (Gamified & Privacy-First Personal Focus & Productivity Intelligence Application)  
**Date**: September 15, 2026  
**Status**: All 11 major features implemented, audited, verified, and 100% passing automated tests. Production Vite build is clean.

---

## 1. Project Overview & Architecture

FocusLens is a full-stack, privacy-first productivity application built to help users measure, gamify, and optimize their focus sessions without scientifically unsubstantiated claims or uploading raw camera, microphone, or screen data.

### Stack
- **Frontend**: React 18, Tailwind CSS, Lucide React icons, Vite 5.
- **Backend**: Node.js, Fastify 4, Drizzle ORM, PostgreSQL (with in-memory store fallback when DB service is offline), Zod.
- **On-Device Vision & ML**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) running entirely in the user's browser.
- **Test Suite**: Native Node test runner (`node --test`).

### Architectural Principles
1. **100% On-Device Privacy Architecture**: Raw webcam frames, microphone audio, and screen pixels are processed strictly in local browser memory. Only derived numerical activity segments & session metadata are persisted.
2. **Permission-First Session Flow**: Session timer execution is strictly gated by client-side camera/mic/screen permission completion and monitoring initialization (`permissionsComplete === true && monitoringInitialized === true && sessionStarted === true`).
3. **Strict User Data Isolation**: Server endpoints enforce authentication via session cookies and scope database queries to `request.user.id`. IDOR protection is enforced across all routes.
4. **Resilient Data Store**: `dbStore` transparently seamlessly toggles between PostgreSQL (Drizzle ORM) and in-memory maps if PostgreSQL connection is unavailable.

---

## 2. Implemented Features Summary

1. **Gamified Focus Points & Level System**
   - Earning: 1 Focus Point per minute of qualifying focus activity (`STUDY_LIKE`, `CODING`, `DOCUMENT_ACTIVITY`).
   - Progression: Level calculation based on cumulative Focus Points.
   - Non-qualifying time (phone use, looking away, multiple people) awards 0 points.

2. **Focus Replay**
   - Chronological visual timeline replay of completed sessions.
   - Segment details, evidence scores, and contributing signals without raw video/audio storage.

3. **Deep Work Blocks**
   - Identification of continuous uninterrupted qualifying focus periods.
   - Calculation of longest block, median deep work duration, and total deep work time.

4. **Goal-Based Sessions**
   - Goal creation with `TIME` (e.g. 45 mins focus) or `COUNT` targets (e.g. 5 DSA problems).
   - In-session progress tracking and automatic goal completion detection upon session finalization.

5. **Personal Distraction Patterns**
   - Detection & classification of 5 distraction types: Phone Activity, Looking Away/Not Visible, Non-Study Screen, Background Speech, and Multiple People Present.

6. **Deterministic Focus Coach**
   - 12 evidence-based heuristic rules generating targeted focus recommendations without external LLM APIs.

7. **Focus Streaks & Consistency**
   - Local timezone-aware calendar day aggregation (`X-Timezone-Offset` header).
   - Daily streak counting, best streak tracking, and focus day completion badges.

8. **Weekly Review / Weekly Focus Summary**
   - Monday–Sunday weekly summary, week-over-week % comparisons, daily breakdowns, top distraction identification, and custom reflection notes (`workedWell`, `madeItHard`).

9. **Focus Journal / Session Notes**
   - Pre-session intentions (`intention`) and post-session reflection notes (`workedWell`, `gotInTheWay`, `notes`).
   - Paginated timeline feed of session journal entries with inline editing and filtering.

10. **Adaptive Session Recommendations**
    - Multi-signal deterministic engine (`adaptiveSessionEngine.js`) recommending duration, goal, and reason based on last 20 completed sessions.
    - Requires minimum 5 completed sessions before generating recommendations.
    - Adaptive change limit (±20 mins from norm) and safety bounds (10–90 mins).
    - Dedicated `/recommendations` page, compact dashboard card, and Weekly Review integration.

11. **Activity Duration Breakdown Audit & Donut Chart Upgrade**
    - Audited & corrected percentage calculation: Uses sum of non-overlapping category durations as single consistent denominator.
    - Guaranteed mathematical consistency (percentages sum to ~100%, preventing impossible distributions like 93% + 63% = 156%).
    - Zero-duration safe empty state (prevents `NaN` / `Infinity`).
    - Upgraded UI to a polished responsive SVG Donut Chart with category legend and accessible summary table view.

---

## 3. Project File Tree & Key Modules

```text
d:\Focus Lens/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── ANTIGRAVITY_HANDOFF.md
├── server/
│   ├── index.js
│   ├── app.js
│   ├── config/env.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── dashboardController.js
│   │   ├── journalController.js
│   │   ├── sessionController.js
│   │   └── weeklyReviewController.js
│   ├── db/
│   │   ├── client.js
│   │   ├── migrate.js
│   │   ├── schema.js
│   │   └── store.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── healthRoutes.js
│   │   ├── journalRoutes.js
│   │   ├── sessionRoutes.js
│   │   └── weeklyReviewRoutes.js
│   ├── utils/
│   │   ├── adaptiveSessionEngine.js
│   │   ├── analytics.js
│   │   ├── consistencyEngine.js
│   │   ├── dashboardAnalytics.js
│   │   ├── deepWorkEngine.js
│   │   ├── focusCoachEngine.js
│   │   ├── focusPoints.js
│   │   └── weeklyReviewEngine.js
│   └── __tests__/
│       ├── activity_breakdown_percentages.test.js
│       ├── adaptive_recommendations.test.js
│       ├── api.test.js
│       ├── auth_and_authorization.test.js
│       ├── consistency.test.js
│       ├── deep_work.test.js
│       ├── focus_coach.test.js
│       ├── focus_points_and_levels.test.js
│       ├── focus_replay.test.js
│       ├── forgot_password.test.js
│       ├── goal_sessions.test.js
│       ├── identity_and_uniqueness.test.js
│       ├── journal.test.js
│       ├── optional_contacts.test.js
│       ├── phone_person_spatial_filter.test.js
│       ├── profile_and_password.test.js
│       ├── verification.test.js
│       └── weekly_review.test.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── api/
    │   ├── client.js
    │   ├── sessionApi.js
    │   └── syncManager.js
    ├── components/
    │   ├── ActivityBreakdownChart.jsx
    │   ├── ActivityTimeline.jsx
    │   ├── FocusReplayView.jsx
    │   ├── Navbar.jsx
    │   └── ...
    ├── pages/
    │   ├── ActiveSessionPage.jsx
    │   ├── ConsistencyPage.jsx
    │   ├── FocusCoachPage.jsx
    │   ├── FocusJournalPage.jsx
    │   ├── PersonalDashboardPage.jsx
    │   ├── RecommendationsPage.jsx
    │   ├── SessionHistoryPage.jsx
    │   ├── SessionReportPage.jsx
    │   ├── SessionSetupPage.jsx
    │   └── WeeklyReviewPage.jsx
    ├── services/
    │   ├── activityAnalyzer.js
    │   └── ...
    └── utils/
        ├── deepWork.js
        ├── formatters.js
        └── sessionAnalytics.js
```

---

## 4. Test Results & Verification Status

### Automated Test Suite (`npm test`)
Command: `npm test`  
Result: **208 tests passing across 18 test files, 0 failures**.

```text
ℹ tests 208
ℹ pass 208
ℹ fail 0
ℹ duration_ms 69034.99
```

### Production Build (`npm run build`)
Command: `npm run build`  
Result: **Vite production bundle compiled cleanly in 4.21s with 0 errors**.

```text
✓ 1539 modules transformed.
dist/index.html                   1.05 kB
dist/assets/index-26eJWmt8.css   76.17 kB
dist/assets/index-CnBRher5.js   682.12 kB
✓ built in 4.21s
```

---

## 5. Development Commands

- **Run Dev Frontend & Server**: `npm run dev` / `npm run server`
- **Run Full Automated Tests**: `npm test`
- **Run Specific Unit Test**: `node --test server/__tests__/activity_breakdown_percentages.test.js`
- **Run Database Migrations**: `npm run db:migrate`
- **Run Production Build**: `npm run build`

---

## 6. Known Issues / Maintenance Notes
- **Resend Development Notice**: In development environment without verified domain, Resend email service logs a warning `[Resend API Error 422: Invalid 'to' field]` when sending emails to fictitious test addresses (e.g. `@example.com`). Fallback local logging allows tests to proceed smoothly.
- **Vite Chunk Size Warning**: Production JS bundle size exceeds 500kB warning threshold due to MediaPipe vision models and React icons. Manual code splitting via `build.rollupOptions.output.manualChunks` can be added if desired in future performance passes.

---

## 7. Recommended Next Steps for New Environment
1. Clone / open workspace in IDE.
2. Run `npm install` (if dependencies require fresh node_modules).
3. Ensure PostgreSQL is running or let `dbStore` run in resilient memory mode.
4. Execute `npm test` to confirm all 203 unit/integration tests pass.
5. Execute `npm run build` to verify production compilation.
