/**
 * FocusLens User Settings & Preferences Utility
 *
 * Provides persistent storage in localStorage with fallback defaults,
 * reactive update events across components, and helper utilities.
 */

export const SETTINGS_STORAGE_KEY = 'focuslens_user_settings';
export const LOCAL_SESSIONS_KEY = 'focuslens_local_sessions';

export const DEFAULT_USER_SETTINGS = {
  // 1. Focus Session
  defaultDuration: 25, // 15, 25, 45, 60 minutes
  autoResumePause: true, // 5-minute pause auto-resume window behavior
  confirmBeforePause: true, // Show confirmation dialog before pausing
  confirmBeforeEnd: false, // Show confirmation dialog before ending session

  // 2. Focus Monitoring
  defaultCamera: true, // Camera active by default during session setup
  defaultScreen: true, // Screen share requested by default during session setup

  // 3. Privacy & Integrations
  // Google Calendar integration is server-authenticated via OAuth tokens

  // 4. Dashboard Preferences
  defaultCategory: 'ALL', // 'ALL' | 'Study' | 'Coding' | 'Other'
  showFocusScore: true, // Show Focus Score metric in Today's Focus
  showFocusPoints: true, // Show Gamified Focus Points card
  showFocusStreak: true, // Show Focus Streak card

  // 5. Notifications
  autoResumeWarning: true, // Show in-app notice modal when 5-min pause auto-resumes

  // 6. Appearance
  theme: 'dark', // FocusLens is purpose-built with a high-contrast dark theme
};

/**
 * Retrieves the current user settings from localStorage merged with defaults.
 * @returns {typeof DEFAULT_USER_SETTINGS}
 */
export function getUserSettings() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_USER_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_USER_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_USER_SETTINGS,
      ...parsed,
    };
  } catch (err) {
    console.warn('[UserSettings] Failed to parse stored settings:', err);
    return { ...DEFAULT_USER_SETTINGS };
  }
}

/**
 * Saves partial or full user settings to localStorage and dispatches
 * a window event to notify active views of the update.
 *
 * @param {Partial<typeof DEFAULT_USER_SETTINGS>} partialSettings
 * @returns {typeof DEFAULT_USER_SETTINGS}
 */
export function saveUserSettings(partialSettings) {
  const current = getUserSettings();
  const next = {
    ...current,
    ...partialSettings,
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
      // Dispatch custom event for reactive in-app listeners
      window.dispatchEvent(new CustomEvent('focuslens_settings_updated', {
        detail: next,
      }));
    } catch (err) {
      console.error('[UserSettings] Failed to persist settings:', err);
    }
  }

  return next;
}

/**
 * Resets user settings to default values.
 * @returns {typeof DEFAULT_USER_SETTINGS}
 */
export function resetUserSettings() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_USER_SETTINGS));
      window.dispatchEvent(new CustomEvent('focuslens_settings_updated', {
        detail: DEFAULT_USER_SETTINGS,
      }));
    } catch (err) {}
  }
  return { ...DEFAULT_USER_SETTINGS };
}

/**
 * Clears the offline/local session cache from localStorage.
 * @returns {{ count: number, success: boolean }}
 */
export function clearLocalSessionCache() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { count: 0, success: true };
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    let count = 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      count = Array.isArray(parsed) ? parsed.length : 0;
    }
    window.localStorage.removeItem(LOCAL_SESSIONS_KEY);
    return { count, success: true };
  } catch (err) {
    console.warn('[UserSettings] Failed to clear local session cache:', err);
    return { count: 0, success: false };
  }
}
