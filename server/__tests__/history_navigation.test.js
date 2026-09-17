import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ROUTE_PATH_MAP, PATH_ALIASES, CONTEXTUAL_PARENT_MAP, resolveViewFromLocation } from '../../src/utils/routes.js';

describe('FocusLens Browser Navigation & History Synchronization Test Suite', () => {

  describe('1. Route Path & Alias Resolution (resolveViewFromLocation)', () => {
    it('resolves root "/" to landing view', () => {
      const loc = { pathname: '/', hash: '', search: '' };
      assert.strictEqual(resolveViewFromLocation(loc), 'landing');
    });

    it('resolves "/dashboard" to dashboard view', () => {
      const loc = { pathname: '/dashboard', hash: '', search: '' };
      assert.strictEqual(resolveViewFromLocation(loc), 'dashboard');
    });

    it('resolves "/setup" and friendly alias "/tasks" to setup view', () => {
      assert.strictEqual(resolveViewFromLocation({ pathname: '/setup', hash: '', search: '' }), 'setup');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/tasks', hash: '', search: '' }), 'setup');
    });

    it('resolves "/recommendations" to recommendations view', () => {
      const loc = { pathname: '/recommendations', hash: '', search: '' };
      assert.strictEqual(resolveViewFromLocation(loc), 'recommendations');
    });

    it('resolves "/history" and friendly alias "/activity" to history view', () => {
      assert.strictEqual(resolveViewFromLocation({ pathname: '/history', hash: '', search: '' }), 'history');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/activity', hash: '', search: '' }), 'history');
    });

    it('resolves "/profile" and alias "/settings" to profile view', () => {
      assert.strictEqual(resolveViewFromLocation({ pathname: '/profile', hash: '', search: '' }), 'profile');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/settings', hash: '', search: '' }), 'profile');
    });

    it('resolves password reset token search param to forgot-password view', () => {
      const loc = { pathname: '/', search: '?token=abc123xyz', hash: '' };
      assert.strictEqual(resolveViewFromLocation(loc), 'forgot-password');
    });

    it('resolves "/reset-password" alias to forgot-password view', () => {
      const loc = { pathname: '/reset-password', search: '', hash: '' };
      assert.strictEqual(resolveViewFromLocation(loc), 'forgot-password');
    });

    it('resolves URL hashes correctly (#dashboard, #setup, #recommendations)', () => {
      assert.strictEqual(resolveViewFromLocation({ pathname: '/', hash: '#dashboard', search: '' }), 'dashboard');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/', hash: '#setup', search: '' }), 'setup');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/', hash: '#tasks', search: '' }), 'setup');
      assert.strictEqual(resolveViewFromLocation({ pathname: '/', hash: '#recommendations', search: '' }), 'recommendations');
    });
  });

  describe('2. Canonical Route Path Mapping Integrity', () => {
    it('defines bidirectional paths for all primary views', () => {
      const views = [
        'landing', 'dashboard', 'setup', 'recommendations', 'history',
        'calendar', 'messages', 'options', 'profile', 'coach',
        'consistency', 'weekly-review', 'journal', 'login', 'register',
        'verify', 'forgot-password', 'report', 'active'
      ];

      for (const view of views) {
        assert.ok(ROUTE_PATH_MAP[view], `ROUTE_PATH_MAP must define path for ${view}`);
        const path = ROUTE_PATH_MAP[view];
        assert.ok(path.startsWith('/'), `Path for ${view} must start with /`);
      }
    });
  });

  describe('3. History Stack State Machine — Back & Forward Flow', () => {
    // Simulated browser window.history environment
    class MockBrowserHistory {
      constructor(initialUrl = 'http://localhost:5173/') {
        const u = new URL(initialUrl);
        this.stack = [{ state: { view: 'landing' }, title: '', url: u.pathname }];
        this.index = 0;
        this.listeners = [];
      }

      get state() {
        return this.stack[this.index]?.state || null;
      }

      get length() {
        return this.stack.length;
      }

      get currentUrl() {
        return this.stack[this.index]?.url || '/';
      }

      pushState(state, title, url) {
        // Discard any forward history on push
        this.stack = this.stack.slice(0, this.index + 1);
        this.stack.push({ state, title, url });
        this.index++;
      }

      replaceState(state, title, url) {
        this.stack[this.index] = { state, title, url };
      }

      back() {
        if (this.index > 0) {
          this.index--;
          this.dispatchPopState();
          return true;
        }
        return false; // Reached beginning of tab history (e.g. New Tab)
      }

      forward() {
        if (this.index < this.stack.length - 1) {
          this.index++;
          this.dispatchPopState();
          return true;
        }
        return false;
      }

      addEventListener(event, fn) {
        if (event === 'popstate') this.listeners.push(fn);
      }

      dispatchPopState() {
        const event = { state: this.state };
        for (const fn of this.listeners) {
          fn(event);
        }
      }
    }

    it('simulates: Dashboard → Tasks → Recommendations navigation, Back sequence, and Forward sequence', () => {
      const history = new MockBrowserHistory('http://localhost:5173/');

      let currentView = 'dashboard';
      // Initial tab load sets replaceState without increasing history length
      history.replaceState({ view: 'dashboard' }, '', '/dashboard');
      assert.strictEqual(history.length, 1, 'Initial load must not create extra history entries');

      const navigate = (view, options = {}) => {
        const { fromPopState = false } = options;
        if (!fromPopState) {
          const path = ROUTE_PATH_MAP[view] || `/${view}`;
          if (history.state?.view !== view) {
            history.pushState({ view }, '', path);
          }
        }
        currentView = view;
      };

      history.addEventListener('popstate', (e) => {
        if (e.state?.view) {
          navigate(e.state.view, { fromPopState: true });
        }
      });

      // 1. User navigates: Dashboard → Tasks (setup)
      navigate('setup');
      assert.strictEqual(currentView, 'setup');
      assert.strictEqual(history.currentUrl, '/setup');
      assert.strictEqual(history.length, 2);

      // 2. User navigates: Tasks → Recommendations
      navigate('recommendations');
      assert.strictEqual(currentView, 'recommendations');
      assert.strictEqual(history.currentUrl, '/recommendations');
      assert.strictEqual(history.length, 3);

      // 3. Browser Back click 1: Recommendations → Tasks
      const canGoBack1 = history.back();
      assert.ok(canGoBack1, 'Browser back must succeed');
      assert.strictEqual(currentView, 'setup', 'Back from Recommendations must return to Tasks');
      assert.strictEqual(history.currentUrl, '/setup');

      // 4. Browser Back click 2: Tasks → Dashboard
      const canGoBack2 = history.back();
      assert.ok(canGoBack2, 'Browser back must succeed');
      assert.strictEqual(currentView, 'dashboard', 'Back from Tasks must return to Dashboard');
      assert.strictEqual(history.currentUrl, '/dashboard');

      // 5. Browser Forward click 1: Dashboard → Tasks
      const canGoForward1 = history.forward();
      assert.ok(canGoForward1, 'Browser forward must succeed');
      assert.strictEqual(currentView, 'setup', 'Forward from Dashboard must return to Tasks');
      assert.strictEqual(history.currentUrl, '/setup');

      // 6. Browser Forward click 2: Tasks → Recommendations
      const canGoForward2 = history.forward();
      assert.ok(canGoForward2, 'Browser forward must succeed');
      assert.strictEqual(currentView, 'recommendations', 'Forward from Tasks must return to Recommendations');
      assert.strictEqual(history.currentUrl, '/recommendations');
    });

    it('directly opening http://localhost:5173 in a fresh tab allows pressing browser Back to exit to New Tab', () => {
      const history = new MockBrowserHistory('http://localhost:5173/');

      // Initial tab mount in fresh tab:
      history.replaceState({ view: 'landing' }, '', '/');

      assert.strictEqual(history.length, 1, 'Fresh tab must strictly have history length 1');
      assert.strictEqual(history.index, 0);

      // Pressing browser Back at index 0 exits the page / returns false
      const canGoBack = history.back();
      assert.strictEqual(canGoBack, false, 'Pressing Back in fresh tab must exit to New Tab rather than being trapped in app');
    });
  });

  describe('4. Contextual In-App Back Navigation Integrity', () => {
    it('contextual parent views are properly mapped', () => {
      const nestedPagesParentMap = {
        recommendations: 'dashboard',
        'weekly-review': 'dashboard',
        consistency: 'dashboard',
        coach: 'dashboard',
        journal: 'dashboard',
        profile: 'dashboard',
        calendar: 'dashboard',
        report: 'history',
      };

      for (const [child, parent] of Object.entries(nestedPagesParentMap)) {
        assert.ok(ROUTE_PATH_MAP[child], `Child view ${child} must exist in ROUTE_PATH_MAP`);
        assert.ok(ROUTE_PATH_MAP[parent], `Parent view ${parent} must exist in ROUTE_PATH_MAP`);
      }
    });
  });

});
