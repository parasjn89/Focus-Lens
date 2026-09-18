import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PAUSE_DURATION_MS,
  PAUSE_CONFIRMATION_MESSAGE,
  AUTO_RESUME_NOTIFICATION_MESSAGE,
  formatPauseTime,
  calculateRemainingFocusSeconds,
  PauseManager,
} from '../../src/utils/sessionTimer.js';

test('FocusLens 5-Minute Pause Maximum & Auto-Resume Regression Test Suite', async (t) => {

  await t.test('1. Pause confirmation can be cancelled without pausing timer', () => {
    const manager = new PauseManager();
    const plannedMinutes = 25;
    const sessionStart = 1000000;

    // Initially running
    assert.equal(manager.isPaused, false);
    assert.equal(manager.isConfirmingPause, false);

    // User clicks Pause -> request pause confirmation
    const req = manager.requestPause();
    assert.equal(req.allowed, true);
    assert.equal(req.message, PAUSE_CONFIRMATION_MESSAGE);
    assert.equal(manager.isConfirmingPause, true);
    assert.equal(manager.isPaused, false); // Timer is NOT paused yet!

    // User clicks Cancel in confirmation popup
    const cancelRes = manager.cancelPause();
    assert.equal(cancelRes.cancelled, true);
    assert.equal(cancelRes.isPaused, false);
    assert.equal(manager.isConfirmingPause, false);
    assert.equal(manager.isPaused, false);
    assert.equal(manager.pauseStartedAt, null);

    // Verify timer continues calculating active focus time
    const now = sessionStart + 15000; // 15s elapsed
    const remaining = manager.calculateRemaining(plannedMinutes, sessionStart, now);
    assert.equal(remaining, 1500 - 15);
  });

  await t.test('2. Confirmed pause starts timestamp and freezes focus countdown', () => {
    const manager = new PauseManager();
    const plannedMinutes = 25;
    const sessionStart = 1000000;

    // Run active for 60 seconds (now = 1060000)
    let now = sessionStart + 60000;
    assert.equal(manager.calculateRemaining(plannedMinutes, sessionStart, now), 1500 - 60);

    // User requests and confirms pause
    manager.requestPause();
    const pauseStart = now;
    const confirmRes = manager.confirmPause(pauseStart);

    assert.equal(confirmRes.paused, true);
    assert.equal(confirmRes.pauseStartedAt, pauseStart);
    assert.equal(confirmRes.maxPauseMs, 300000);
    assert.equal(manager.isPaused, true);
    assert.equal(manager.pauseStartedAt, pauseStart);

    // Verify focus countdown is frozen while paused (e.g. 30s into pause)
    now = pauseStart + 30000;
    assert.equal(manager.calculateRemaining(plannedMinutes, sessionStart, now), 1500 - 60);
  });

  await t.test('3. Manual resume after 30 seconds', () => {
    let resumeEventLogged = null;
    const manager = new PauseManager({
      onResume: (event) => { resumeEventLogged = event; },
    });
    const plannedMinutes = 25;
    const sessionStart = 1000000;
    const pauseStart = sessionStart + 60000;

    manager.confirmPause(pauseStart);

    // 30 seconds later (now = pauseStart + 30000)
    const now = pauseStart + 30000;
    const resumeRes = manager.manualResume(now);

    assert.equal(resumeRes.resumed, true);
    assert.equal(resumeRes.type, 'MANUAL');
    assert.equal(resumeRes.addedPause, 30000);
    assert.equal(resumeRes.totalPausedMs, 30000);

    assert.equal(manager.isPaused, false);
    assert.equal(manager.pauseStartedAt, null);
    assert.equal(manager.autoResumeNotification, null); // No auto-resume notification

    assert.ok(resumeEventLogged);
    assert.equal(resumeEventLogged.type, 'MANUAL');
    assert.equal(resumeEventLogged.addedPause, 30000);

    // After resume, focus countdown resumes from 1500 - 60 = 1440
    const now2 = now + 10000; // 10s after resume
    assert.equal(manager.calculateRemaining(plannedMinutes, sessionStart, now2), 1500 - 70);
  });

  await t.test('4. Manual resume after 4 minutes 59 seconds', () => {
    const manager = new PauseManager();
    const pauseStart = 2000000;

    manager.confirmPause(pauseStart);

    // 4 minutes 59 seconds = 299,000 ms
    const resumeTime = pauseStart + 299000;
    const res = manager.manualResume(resumeTime);

    assert.equal(res.resumed, true);
    assert.equal(res.type, 'MANUAL');
    assert.equal(res.addedPause, 299000);
    assert.equal(manager.totalPausedMs, 299000);
    assert.equal(manager.isPaused, false);
    assert.equal(manager.pauseStartedAt, null);
    assert.equal(manager.autoResumeNotification, null);
  });

  await t.test('5. Automatic resume at/after exactly 5 minutes', () => {
    let autoResumeEvent = null;
    const manager = new PauseManager({
      onAutoResume: (evt) => { autoResumeEvent = evt; },
    });
    const pauseStart = 3000000;

    manager.confirmPause(pauseStart);

    // At 4 min 59s: checkAutoResume should NOT trigger
    const checkBefore = manager.checkAutoResume(pauseStart + 299000);
    assert.equal(checkBefore.autoResumed, false);
    assert.equal(checkBefore.remainingPauseMs, 1000);
    assert.equal(manager.isPaused, true);

    // At exact 5 minutes (300,000 ms):
    const checkExact = manager.checkAutoResume(pauseStart + 300000);
    assert.equal(checkExact.autoResumed, true);
    assert.equal(checkExact.type, 'AUTO');
    assert.equal(checkExact.addedPause, 300000);
    assert.equal(checkExact.totalPausedMs, 300000);
    assert.equal(checkExact.notification, AUTO_RESUME_NOTIFICATION_MESSAGE);

    assert.equal(manager.isPaused, false);
    assert.equal(manager.pauseStartedAt, null);
    assert.equal(manager.autoResumeNotification, AUTO_RESUME_NOTIFICATION_MESSAGE);

    assert.ok(autoResumeEvent);
    assert.equal(autoResumeEvent.type, 'AUTO');
    assert.equal(autoResumeEvent.addedPause, 300000);
  });

  await t.test('6. Browser timer delay/background-tab wake scenario (reconciles on Date.now())', () => {
    const manager = new PauseManager();
    const plannedMinutes = 25; // 1500s
    const sessionStart = 10000000;
    const pauseStart = sessionStart + 120000; // Paused after 2 minutes of focus

    manager.confirmPause(pauseStart);

    // App backgrounded / throttled for 7 minutes 30 seconds (450,000 ms)
    const wakeTime = pauseStart + 450000;

    // Immediately reconcile on visibility/wake
    const reconcileRes = manager.reconcileOnVisibility(wakeTime);
    assert.equal(reconcileRes.autoResumed, true);
    assert.equal(reconcileRes.type, 'AUTO');

    // CRITICAL: Total credited paused time must be capped at exactly MAX_PAUSE_DURATION_MS (300,000 ms)
    assert.equal(manager.totalPausedMs, 300000);
    assert.equal(manager.isPaused, false);
    assert.equal(manager.pauseStartedAt, null);

    // Active focus time elapsed:
    // Total real time elapsed = 120000 (pre-pause) + 450000 (paused + post-pause running) = 570,000 ms
    // Credited pause = 300,000 ms
    // Elapsed focus = 570,000 - 300,000 = 270,000 ms (4.5 minutes = 270s)
    // Remaining seconds = 1500 - 270 = 1230s
    const remaining = manager.calculateRemaining(plannedMinutes, sessionStart, wakeTime);
    assert.equal(remaining, 1230);
  });

  await t.test('7. Manual resume must cancel auto-resume', () => {
    const manager = new PauseManager();
    const pauseStart = 5000000;

    manager.confirmPause(pauseStart);

    // User resumes after 1 minute (60,000 ms)
    manager.manualResume(pauseStart + 60000);
    assert.equal(manager.isPaused, false);

    // Advance time beyond 5 minutes (e.g. 10 minutes)
    const checkLater = manager.checkAutoResume(pauseStart + 600000);
    assert.equal(checkLater.autoResumed, false);
    assert.equal(manager.autoResumeNotification, null);
  });

  await t.test('8. Automatic resume notification appears exactly once', () => {
    const manager = new PauseManager();
    const pauseStart = 6000000;

    manager.confirmPause(pauseStart);

    // Triggers auto resume
    const firstCheck = manager.checkAutoResume(pauseStart + 300000);
    assert.equal(firstCheck.autoResumed, true);
    assert.equal(manager.autoResumeNotification, AUTO_RESUME_NOTIFICATION_MESSAGE);

    // Next tick / render call: should NOT re-trigger or duplicate notification
    const secondCheck = manager.checkAutoResume(pauseStart + 300500);
    assert.equal(secondCheck.autoResumed, false);

    // Dismiss notification
    manager.dismissNotification();
    assert.equal(manager.autoResumeNotification, null);
  });

  await t.test('9. Completed/cancelled session never auto-resumes', () => {
    // Scenario A: Session completed while paused
    const managerA = new PauseManager();
    managerA.confirmPause(7000000);
    managerA.completeSession();

    assert.equal(managerA.isCompleted, true);
    assert.equal(managerA.isPaused, false);
    const checkA = managerA.checkAutoResume(7000000 + 400000);
    assert.equal(checkA.autoResumed, false);

    // Scenario B: Session cancelled while paused
    const managerB = new PauseManager();
    managerB.confirmPause(8000000);
    managerB.cancelSession();

    assert.equal(managerB.isCancelled, true);
    assert.equal(managerB.isPaused, false);
    const checkB = managerB.checkAutoResume(8000000 + 400000);
    assert.equal(checkB.autoResumed, false);
  });

  await t.test('10. No duplicate resume events on redundant calls', () => {
    let resumeCalls = 0;
    const manager = new PauseManager({
      onResume: () => { resumeCalls++; },
    });

    manager.confirmPause(9000000);

    // First resume call succeeds
    const res1 = manager.manualResume(9000000 + 10000);
    assert.equal(res1.resumed, true);
    assert.equal(resumeCalls, 1);

    // Redundant resume call is a no-op
    const res2 = manager.manualResume(9000000 + 15000);
    assert.equal(res2.resumed, false);
    assert.equal(resumeCalls, 1);
  });

  await t.test('11. formatPauseTime helper formats minutes and seconds accurately', () => {
    assert.equal(formatPauseTime(300), '5:00');
    assert.equal(formatPauseTime(299), '4:59');
    assert.equal(formatPauseTime(65), '1:05');
    assert.equal(formatPauseTime(9), '0:09');
    assert.equal(formatPauseTime(0), '0:00');
    assert.equal(formatPauseTime(-5), '0:00');
  });
});
