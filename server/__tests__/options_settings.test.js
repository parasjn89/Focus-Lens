import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_USER_SETTINGS,
  SETTINGS_STORAGE_KEY,
  LOCAL_SESSIONS_KEY,
  getUserSettings,
  saveUserSettings,
  resetUserSettings,
  clearLocalSessionCache,
} from '../../src/utils/userSettings.js';

describe('FocusLens Options & User Settings Hub Suite', () => {
  it('1. Default user settings schema matches all expected preferences', () => {
    assert.strictEqual(typeof DEFAULT_USER_SETTINGS, 'object');

    // 1. Focus Session defaults
    assert.strictEqual(DEFAULT_USER_SETTINGS.defaultDuration, 25);
    assert.strictEqual(DEFAULT_USER_SETTINGS.autoResumePause, true);
    assert.strictEqual(DEFAULT_USER_SETTINGS.confirmBeforePause, true);
    assert.strictEqual(DEFAULT_USER_SETTINGS.confirmBeforeEnd, false);

    // 2. Focus Monitoring defaults
    assert.strictEqual(DEFAULT_USER_SETTINGS.defaultCamera, true);
    assert.strictEqual(DEFAULT_USER_SETTINGS.defaultScreen, true);

    // 4. Dashboard Preferences defaults
    assert.strictEqual(DEFAULT_USER_SETTINGS.defaultCategory, 'ALL');
    assert.strictEqual(DEFAULT_USER_SETTINGS.showFocusScore, true);
    assert.strictEqual(DEFAULT_USER_SETTINGS.showFocusPoints, true);
    assert.strictEqual(DEFAULT_USER_SETTINGS.showFocusStreak, true);

    // 5. Notifications defaults
    assert.strictEqual(DEFAULT_USER_SETTINGS.autoResumeWarning, true);

    // 6. Appearance defaults
    assert.strictEqual(DEFAULT_USER_SETTINGS.theme, 'dark');
  });

  it('2. Privacy Invariant: Zero microphone or audio keys exist in settings', () => {
    const settingKeys = Object.keys(DEFAULT_USER_SETTINGS);
    const forbiddenAudioTerms = ['mic', 'audio', 'microphone', 'sound', 'voice', 'record'];
    
    for (const key of settingKeys) {
      const lower = key.toLowerCase();
      for (const forbidden of forbiddenAudioTerms) {
        assert.strictEqual(
          lower.includes(forbidden),
          false,
          `Settings key "${key}" contains forbidden audio reference "${forbidden}"`
        );
      }
    }
  });

  it('3. In Node environment (window undefined), fallback returns safe defaults without throwing', () => {
    const settings = getUserSettings();
    assert.deepStrictEqual(settings, DEFAULT_USER_SETTINGS);

    const saved = saveUserSettings({ defaultDuration: 45, defaultCategory: 'Coding' });
    assert.strictEqual(saved.defaultDuration, 45);
    assert.strictEqual(saved.defaultCategory, 'Coding');

    const reset = resetUserSettings();
    assert.deepStrictEqual(reset, DEFAULT_USER_SETTINGS);

    const clearRes = clearLocalSessionCache();
    assert.strictEqual(clearRes.success, true);
  });

  it('4. Mock browser localStorage simulates reactive persistence and update event emission', () => {
    // Setup mock window and localStorage
    const storage = new Map();
    let emittedEvent = null;

    global.window = {
      localStorage: {
        getItem: (k) => storage.get(k) || null,
        setItem: (k, v) => storage.set(k, String(v)),
        removeItem: (k) => storage.delete(k),
      },
      dispatchEvent: (evt) => {
        emittedEvent = evt;
      },
    };
    global.CustomEvent = class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    };

    try {
      // Initially empty -> returns defaults
      let current = getUserSettings();
      assert.strictEqual(current.defaultDuration, 25);
      assert.strictEqual(current.defaultCategory, 'ALL');

      // Update default duration to 45 and category to Study
      const updated = saveUserSettings({ defaultDuration: 45, defaultCategory: 'Study' });
      assert.strictEqual(updated.defaultDuration, 45);
      assert.strictEqual(updated.defaultCategory, 'Study');
      assert.strictEqual(emittedEvent?.type, 'focuslens_settings_updated');
      assert.strictEqual(emittedEvent?.detail?.defaultDuration, 45);

      // Verify raw storage content
      const rawStored = storage.get(SETTINGS_STORAGE_KEY);
      assert.ok(rawStored);
      const parsed = JSON.parse(rawStored);
      assert.strictEqual(parsed.defaultDuration, 45);
      assert.strictEqual(parsed.defaultCategory, 'Study');

      // Subsequent getUserSettings reads persisted values
      current = getUserSettings();
      assert.strictEqual(current.defaultDuration, 45);
      assert.strictEqual(current.defaultCategory, 'Study');
      assert.strictEqual(current.showFocusScore, true); // unmentioned defaults preserved

      // Reset restores defaults
      resetUserSettings();
      assert.strictEqual(getUserSettings().defaultDuration, 25);
      assert.strictEqual(getUserSettings().defaultCategory, 'ALL');

      // Test cache clear
      storage.set(LOCAL_SESSIONS_KEY, JSON.stringify([{ id: 'sess_1' }, { id: 'sess_2' }]));
      const clearRes = clearLocalSessionCache();
      assert.strictEqual(clearRes.count, 2);
      assert.strictEqual(clearRes.success, true);
      assert.strictEqual(storage.has(LOCAL_SESSIONS_KEY), false);
    } finally {
      delete global.window;
      delete global.CustomEvent;
    }
  });

  it('5. OptionsPage.jsx exists, exports OptionsPage, and renders Command Center layout with all sections', () => {
    const optionsPath = resolve(process.cwd(), 'src/pages/OptionsPage.jsx');
    assert.ok(existsSync(optionsPath), 'OptionsPage.jsx must exist');
    const content = readFileSync(optionsPath, 'utf-8');

    // Must export OptionsPage
    assert.ok(content.includes('export function OptionsPage'), 'Must export OptionsPage');

    // Command Center Header & Overview
    assert.ok(content.includes('Options & Settings'), 'Must have Options & Settings header');
    assert.ok(content.includes('Your Setup at a Glance'), 'Must have Overview status tiles');
    assert.ok(content.includes('Quick Settings'), 'Must have Quick Settings');
    assert.ok(content.includes('Productivity Tools'), 'Must have Productivity Tools');

    // Section 1: Focus Session
    assert.ok(content.includes('Focus Session'), 'Must have Focus Session section');
    assert.ok(content.includes('defaultDuration'), 'Must configure default duration');
    assert.ok(content.includes('confirmBeforePause'), 'Must configure confirmBeforePause');
    assert.ok(content.includes('confirmBeforeEnd'), 'Must configure confirmBeforeEnd');

    // Section 2: Focus Monitoring
    assert.ok(content.includes('Focus Monitoring'), 'Must have Focus Monitoring section');
    assert.ok(content.includes('defaultCamera'), 'Must configure defaultCamera');
    assert.ok(content.includes('defaultScreen'), 'Must configure defaultScreen');
    assert.ok(content.includes('Phone Detection'), 'Must list real Phone Detection');
    assert.ok(content.includes('Person Presence'), 'Must list Person Presence');
    assert.ok(content.includes('Head Orientation'), 'Must list Head Orientation');
    assert.ok(content.includes('Zero Audio Capture'), 'Must have zero audio capture notice');

    // Section 3: Privacy & Integrations
    assert.ok(content.includes('Privacy & Integrations'), 'Must have Privacy section');
    assert.ok(content.includes('Client-Side Machine Learning'), 'Must state client-side execution');
    assert.ok(content.includes('fetchGoogleCalendarStatus'), 'Must check Google Calendar status');
    assert.ok(content.includes('disconnectGoogleCalendar'), 'Must support calendar disconnect');
    assert.ok(content.includes('connectGoogleCalendar'), 'Must support calendar connect');
    assert.ok(content.includes('clearLocalSessionCache'), 'Must support clearing local cache');

    // Section 4: Dashboard Preferences
    assert.ok(content.includes('Dashboard Preferences'), 'Must have Dashboard Preferences section');
    assert.ok(content.includes('defaultCategory'), 'Must configure defaultCategory');
    assert.ok(content.includes('showFocusScore'), 'Must toggle showFocusScore');
    assert.ok(content.includes('showFocusPoints'), 'Must toggle showFocusPoints');
    assert.ok(content.includes('showFocusStreak'), 'Must toggle showFocusStreak');

    // Section 5: Notifications
    assert.ok(content.includes('Notifications'), 'Must have Notifications section');
    assert.ok(content.includes('autoResumeWarning'), 'Must toggle autoResumeWarning');
    assert.ok(content.includes('COMING SOON'), 'Must mark browser notifications as coming soon');

    // Section 6: Appearance & Theme
    assert.ok(content.includes('Appearance & Theme'), 'Must have Appearance section');
    assert.ok(content.includes('Dark Navy'), 'Must explain dark navy palette');

    // Section 7: Account & Data
    assert.ok(content.includes('Account & Data'), 'Must have Account section');
    assert.ok(content.includes('Edit Profile'), 'Must link to Profile');
    assert.ok(content.includes('Password'), 'Must link to Password');
    assert.ok(content.includes('Sign Out'), 'Must support Sign Out');

    // Right Sidebar requirements
    assert.ok(content.includes('Focus Streak'), 'Must have Focus Streak card');
    assert.ok(content.includes('Focus Stats'), 'Must have Focus Stats card');
    assert.ok(content.includes('The Only Easy Day Was Yesterday'), 'Must have exact required quote');
    assert.strictEqual(content.includes('A more focused you, a brighter tomorrow'), false, 'Must not include old slogan');
    assert.ok(content.includes('Need Help?'), 'Must have Need Help card');
  });

  it('5b. Topbar.jsx has no fake avatars (JD, AL) and renders clean Focus Buddies control', () => {
    const topbarPath = resolve(process.cwd(), 'src/components/Topbar.jsx');
    const content = readFileSync(topbarPath, 'utf-8');
    assert.strictEqual(content.includes('>JD<'), false, 'Topbar must not have fake JD avatar');
    assert.strictEqual(content.includes('>AL<'), false, 'Topbar must not have fake AL avatar');
    assert.ok(content.includes('Focus Buddies'), 'Topbar must have Focus Buddies control');
  });

  it('6. App.jsx routes currentView === "options" to <OptionsPage /> and separates messages placeholder', () => {
    const appPath = resolve(process.cwd(), 'src/App.jsx');
    const content = readFileSync(appPath, 'utf-8');

    assert.ok(content.includes('import { OptionsPage }'), 'App.jsx must import OptionsPage');
    assert.ok(content.includes("currentView === 'options'"), 'App.jsx must check currentView === options');
    assert.ok(content.includes('<OptionsPage'), 'App.jsx must render <OptionsPage />');
    assert.strictEqual(content.includes("['messages', 'options'].includes(currentView)"), false, 'Placeholder must no longer include options');
  });

  it('7. PersonalDashboardPage.jsx reads user settings for default category and card visibility', () => {
    const dashPath = resolve(process.cwd(), 'src/pages/PersonalDashboardPage.jsx');
    const content = readFileSync(dashPath, 'utf-8');

    assert.ok(content.includes('getUserSettings'), 'Dashboard must import getUserSettings');
    assert.ok(content.includes('defaultCategory'), 'Dashboard must initialize with defaultCategory');
    assert.ok(content.includes('showFocusScore'), 'Dashboard must check showFocusScore');
    assert.ok(content.includes('showFocusStreak'), 'Dashboard must check showFocusStreak');
    assert.ok(content.includes('showFocusPoints'), 'Dashboard must check showFocusPoints');
    assert.ok(content.includes('focuslens_settings_updated'), 'Dashboard must listen for settings updates');
  });

  it('8. SessionSetupPage.jsx reads default duration from user settings', () => {
    const setupPath = resolve(process.cwd(), 'src/pages/SessionSetupPage.jsx');
    const content = readFileSync(setupPath, 'utf-8');

    assert.ok(content.includes('getUserSettings'), 'Setup must import getUserSettings');
    assert.ok(content.includes('defaultDuration'), 'Setup must read defaultDuration');
  });
});
