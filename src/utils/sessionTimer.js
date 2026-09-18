/**
 * FocusLens Session Timer & Pause Management Engine
 * 
 * Provides timestamp-anchored focus calculations and a strict 5-minute
 * maximum pause duration with confirmation, auto-resume, background-tab
 * reconciliation, and event generation.
 */

export const MAX_PAUSE_DURATION_MS = 5 * 60 * 1000; // 300,000 ms (5 minutes)

export const PAUSE_CONFIRMATION_MESSAGE =
  "The timer will automatically resume after 5 minutes if you don't resume it manually.";

export const AUTO_RESUME_NOTIFICATION_MESSAGE =
  "Your 5-minute pause has ended. The focus timer has resumed automatically.";

/**
 * Format remaining pause seconds into M:SS display string
 */
export function formatPauseTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Pure calculation of remaining focus seconds.
 * Elapsed time is calculated as:
 *   now - startedAt - (totalPausedMs + currentPauseMs)
 * where currentPauseMs is capped at MAX_PAUSE_DURATION_MS.
 */
export function calculateRemainingFocusSeconds({
  plannedMinutes,
  startedAt,
  totalPausedMs = 0,
  isPaused = false,
  pauseStartedAt = null,
  now = Date.now(),
}) {
  const totalPlannedSecs = plannedMinutes * 60;
  if (!startedAt) return totalPlannedSecs;

  let currentPauseMs = 0;
  if (isPaused && pauseStartedAt) {
    currentPauseMs = Math.min(Math.max(0, now - pauseStartedAt), MAX_PAUSE_DURATION_MS);
  }

  const effectiveTotalPausedMs = totalPausedMs + currentPauseMs;
  const elapsedMs = Math.max(0, now - startedAt - effectiveTotalPausedMs);
  const elapsedSecs = Math.floor(elapsedMs / 1000);
  return Math.max(0, totalPlannedSecs - elapsedSecs);
}

/**
 * Deterministic Pause State Machine
 */
export class PauseManager {
  constructor(options = {}) {
    this.maxPauseMs = options.maxPauseMs ?? MAX_PAUSE_DURATION_MS;
    this.onAutoResume = options.onAutoResume || null;
    this.onPause = options.onPause || null;
    this.onResume = options.onResume || null;

    this.isConfirmingPause = false;
    this.isPaused = false;
    this.pauseStartedAt = null;
    this.totalPausedMs = 0;
    this.autoResumeNotification = null;
    this.isCompleted = false;
    this.isCancelled = false;
    this.autoResumeTriggeredForCurrentPause = false;
  }

  requestPause() {
    if (this.isCompleted || this.isCancelled || this.isPaused) {
      return { allowed: false };
    }
    this.isConfirmingPause = true;
    return {
      allowed: true,
      message: PAUSE_CONFIRMATION_MESSAGE,
    };
  }

  cancelPause() {
    this.isConfirmingPause = false;
    return {
      cancelled: true,
      isPaused: this.isPaused,
    };
  }

  confirmPause(now = Date.now()) {
    if (this.isCompleted || this.isCancelled || this.isPaused) {
      return { paused: false };
    }
    this.isConfirmingPause = false;
    this.isPaused = true;
    this.pauseStartedAt = now;
    this.autoResumeTriggeredForCurrentPause = false;

    if (this.onPause) {
      this.onPause(now);
    }
    return {
      paused: true,
      pauseStartedAt: this.pauseStartedAt,
      maxPauseMs: this.maxPauseMs,
    };
  }

  manualResume(now = Date.now()) {
    if (!this.isPaused || this.isCompleted || this.isCancelled) {
      return { resumed: false };
    }

    const elapsed = this.pauseStartedAt ? Math.max(0, now - this.pauseStartedAt) : 0;
    const addedPause = Math.min(elapsed, this.maxPauseMs);
    this.totalPausedMs += addedPause;
    this.pauseStartedAt = null;
    this.isPaused = false;
    this.autoResumeTriggeredForCurrentPause = false;

    if (this.onResume) {
      this.onResume({ type: 'MANUAL', addedPause, totalPausedMs: this.totalPausedMs, now });
    }

    return {
      resumed: true,
      type: 'MANUAL',
      addedPause,
      totalPausedMs: this.totalPausedMs,
    };
  }

  checkAutoResume(now = Date.now()) {
    if (
      !this.isPaused ||
      !this.pauseStartedAt ||
      this.isCompleted ||
      this.isCancelled ||
      this.autoResumeTriggeredForCurrentPause
    ) {
      return { autoResumed: false };
    }

    const elapsed = now - this.pauseStartedAt;
    if (elapsed >= this.maxPauseMs) {
      // Auto-resume triggered! Exactly maxPauseMs is credited
      this.autoResumeTriggeredForCurrentPause = true;
      this.totalPausedMs += this.maxPauseMs;
      this.pauseStartedAt = null;
      this.isPaused = false;
      this.autoResumeNotification = AUTO_RESUME_NOTIFICATION_MESSAGE;

      const payload = {
        autoResumed: true,
        type: 'AUTO',
        addedPause: this.maxPauseMs,
        totalPausedMs: this.totalPausedMs,
        notification: AUTO_RESUME_NOTIFICATION_MESSAGE,
        now,
      };

      if (this.onAutoResume) {
        this.onAutoResume(payload);
      }

      return payload;
    }

    return {
      autoResumed: false,
      remainingPauseMs: this.maxPauseMs - elapsed,
    };
  }

  reconcileOnVisibility(now = Date.now()) {
    return this.checkAutoResume(now);
  }

  dismissNotification() {
    this.autoResumeNotification = null;
  }

  completeSession() {
    this.isCompleted = true;
    this.cleanup();
  }

  cancelSession() {
    this.isCancelled = true;
    this.cleanup();
  }

  cleanup() {
    this.isPaused = false;
    this.pauseStartedAt = null;
    this.isConfirmingPause = false;
    this.autoResumeTriggeredForCurrentPause = false;
  }

  calculateRemaining(plannedMinutes, startedAt, now = Date.now()) {
    return calculateRemainingFocusSeconds({
      plannedMinutes,
      startedAt,
      totalPausedMs: this.totalPausedMs,
      isPaused: this.isPaused,
      pauseStartedAt: this.pauseStartedAt,
      now,
    });
  }
}
