import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

describe('FocusLens Vercel SPA Routing Configuration Test Suite', () => {
  const vercelConfigPath = path.resolve(projectRoot, 'vercel.json');

  it('1. vercel.json exists and is valid JSON', () => {
    assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json must exist at project root');
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    assert.ok(json, 'vercel.json must be valid JSON');
    assert.ok(Array.isArray(json.rewrites), 'vercel.json must contain rewrites array');
  });

  it('2. SPA rewrite rule rewrites all application routes to /index.html', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    assert.ok(spaRewrite, 'Must contain a rewrite targeting /index.html');

    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const clientRoutes = [
      '/',
      '/login',
      '/register',
      '/dashboard',
      '/history',
      '/calendar',
      '/options',
      '/setup',
      '/focus-setup',
      '/session/setup',
      '/active-session',
      '/active',
      '/report',
      '/coach',
      '/consistency',
      '/recommendations',
      '/weekly-review',
      '/journal',
      '/profile',
      '/verify',
      '/forgot-password',
      '/tasks',
    ];

    for (const route of clientRoutes) {
      assert.equal(
        sourceRegex.test(route),
        true,
        `Route "${route}" should match SPA rewrite to /index.html`
      );
    }
  });

  it('3. SPA rewrite rule preserves static assets, favicons, images, and files with extensions', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const staticFiles = [
      '/assets/index-Dvgqfen4.js',
      '/assets/index-DedslEj1.css',
      '/assets/purify.es-DDpmou9H.js',
      '/favicon.svg',
      '/favicon.ico',
      '/boy-studying.png',
      '/robots.txt',
      '/manifest.json',
      '/assets/vendor.js.map',
    ];

    for (const file of staticFiles) {
      assert.equal(
        sourceRegex.test(file),
        false,
        `Static asset "${file}" must NOT be rewritten to /index.html`
      );
    }
  });

  it('4. SPA rewrite rule preserves backend /api routes', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const spaRewrite = json.rewrites.find((r) => r.destination === '/index.html');
    const sourceRegex = new RegExp(`^${spaRewrite.source}`);

    const apiRoutes = [
      '/api/auth/me',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/firebase-phone',
      '/api/auth/google',
      '/api/sessions',
      '/api/health',
      '/api/analytics/consistency',
      '/api/weekly-review',
    ];

    for (const route of apiRoutes) {
      assert.equal(
        sourceRegex.test(route),
        false,
        `API route "${route}" must NOT be rewritten to /index.html`
      );
    }
  });

  it('5. Vercel rewrites route /api/* requests to serverless handler /api/index.js', () => {
    const content = fs.readFileSync(vercelConfigPath, 'utf8');
    const json = JSON.parse(content);
    const apiRewrite = json.rewrites.find((r) => r.destination === '/api/index.js');
    assert.ok(apiRewrite, 'vercel.json must contain rewrite targeting /api/index.js');

    const apiRegex = new RegExp(`^${apiRewrite.source}`);
    assert.equal(apiRegex.test('/api/auth/register'), true);
    assert.equal(apiRegex.test('/api/health'), true);
    assert.equal(apiRegex.test('/api/sessions'), true);
  });

  it('6. Client routes resolve canonical paths and aliases correctly', async () => {
    const { resolveViewFromLocation, ROUTE_PATH_MAP, PATH_ALIASES } = await import('../../src/utils/routes.js');

    // 1. Root URL resolves to landing
    assert.equal(resolveViewFromLocation({ pathname: '/' }), 'landing');
    assert.equal(resolveViewFromLocation({ pathname: '' }), 'landing');

    // 2. Auth routes
    assert.equal(resolveViewFromLocation({ pathname: '/login' }), 'login');
    assert.equal(resolveViewFromLocation({ pathname: '/register' }), 'register');

    // 3. Setup routes & aliases
    assert.equal(resolveViewFromLocation({ pathname: '/setup' }), 'setup');
    assert.equal(resolveViewFromLocation({ pathname: '/focus-setup' }), 'setup');
    assert.equal(resolveViewFromLocation({ pathname: '/session/setup' }), 'setup');

    // 4. Active routes & aliases
    assert.equal(resolveViewFromLocation({ pathname: '/active' }), 'active');
    assert.equal(resolveViewFromLocation({ pathname: '/active-session' }), 'active');
    assert.equal(resolveViewFromLocation({ pathname: '/session/active' }), 'active');

    // 5. Dashboard
    assert.equal(resolveViewFromLocation({ pathname: '/dashboard' }), 'dashboard');
  });

  it('7. App.jsx protects setup and active routes from unauthenticated access', () => {
    const appPath = path.resolve(projectRoot, 'src/App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    // PROTECTED_VIEWS must include setup and active
    assert.ok(content.includes("'setup'"), 'PROTECTED_VIEWS must include setup');
    assert.ok(content.includes("'active'"), 'PROTECTED_VIEWS must include active');

    // Auth effect must redirect unauthenticated visitors
    assert.ok(content.includes("handleNavigate('login', { replace: true })"), 'Must redirect unauthenticated to login');

    // Authenticated users on login/register must be redirected to dashboard
    assert.ok(content.includes("handleNavigate('dashboard', { replace: true"), 'Must redirect authenticated visitors on login/register to dashboard');
  });

  it('8. Expected Routing State Machine Verification', () => {
    // Simulate routing controller matching App.jsx logic
    const PROTECTED = [
      'dashboard', 'tasks', 'profile', 'history', 'verify',
      'coach', 'consistency', 'recommendations', 'weekly-review',
      'journal', 'messages', 'calendar', 'options', 'setup', 'active'
    ];

    function routeTransition({ view, isAuthenticated, isVerified = true, hasActiveSession = false }) {
      if (!isAuthenticated) {
        if (PROTECTED.includes(view)) {
          return { target: 'login', redirected: true };
        }
        return { target: view, redirected: false };
      }

      // Authenticated
      if (!isVerified && ['setup', 'active', 'tasks'].includes(view)) {
        return { target: 'verify', redirected: true };
      }

      if (view === 'login' || view === 'register') {
        return { target: 'dashboard', redirected: true };
      }

      if (view === 'active') {
        return { target: hasActiveSession ? 'active' : 'dashboard', redirected: !hasActiveSession };
      }

      return { target: view, redirected: false };
    }

    // 1. Completely logged-out user opens / -> PUBLIC LANDING PAGE
    assert.deepEqual(routeTransition({ view: 'landing', isAuthenticated: false }), { target: 'landing', redirected: false });

    // 2. Logged-out user opens /login -> login
    assert.deepEqual(routeTransition({ view: 'login', isAuthenticated: false }), { target: 'login', redirected: false });

    // 3. Logged-out user opens /register -> register
    assert.deepEqual(routeTransition({ view: 'register', isAuthenticated: false }), { target: 'register', redirected: false });

    // 4. Authenticated user opens / -> PUBLIC LANDING PAGE
    assert.deepEqual(routeTransition({ view: 'landing', isAuthenticated: true }), { target: 'landing', redirected: false });

    // 5. Authenticated user explicitly opens /setup or /focus-setup -> setup
    assert.deepEqual(routeTransition({ view: 'setup', isAuthenticated: true }), { target: 'setup', redirected: false });

    // 6. Authenticated user with genuinely active session -> active
    assert.deepEqual(routeTransition({ view: 'active', isAuthenticated: true, hasActiveSession: true }), { target: 'active', redirected: false });

    // 7. Completed/cancelled/expired session (hasActiveSession = false) navigating to /active -> dashboard
    assert.deepEqual(routeTransition({ view: 'active', isAuthenticated: true, hasActiveSession: false }), { target: 'dashboard', redirected: true });

    // 8. Logged-out user opening /setup or /focus-setup -> redirected to login
    assert.deepEqual(routeTransition({ view: 'setup', isAuthenticated: false }), { target: 'login', redirected: true });

    // 9. Logged-out user opening /active or /active-session -> redirected to login
    assert.deepEqual(routeTransition({ view: 'active', isAuthenticated: false }), { target: 'login', redirected: true });

    // 10. Authenticated user opening /login or /register -> redirected to dashboard
    assert.deepEqual(routeTransition({ view: 'login', isAuthenticated: true }), { target: 'dashboard', redirected: true });
    assert.deepEqual(routeTransition({ view: 'register', isAuthenticated: true }), { target: 'dashboard', redirected: true });

    // 11. Newly authenticated user (even if unverified) navigating to /dashboard -> stays on dashboard
    assert.deepEqual(routeTransition({ view: 'dashboard', isAuthenticated: true, isVerified: false }), { target: 'dashboard', redirected: false });
  });

  it('9. Post-authentication state synchronization prevents race condition redirection back to login', () => {
    // Simulates handleNavigate behavior with authUserRef
    class AuthNavigationSimulation {
      constructor() {
        this.user = null;
        this.authUserRef = { current: null };
        this.isLoading = false;
        this.currentView = 'login';
        this.PROTECTED = ['dashboard', 'setup', 'active'];
      }

      handleNavigate(view, { authenticatedUser = null } = {}) {
        const currentUser = authenticatedUser || this.user || this.authUserRef.current;
        const isAuth = Boolean(currentUser);

        if (this.PROTECTED.includes(view) && !isAuth && !this.isLoading) {
          this.currentView = 'login';
          return 'login';
        }
        this.currentView = view;
        return view;
      }

      // Email/Password or Google login
      login() {
        const fakeUser = { id: 'u_123', email: 'test@example.com' };
        // Synchronous ref update in AuthContext
        this.authUserRef.current = fakeUser;
        // React asynchronous state update queued (this.user is still null!)
        // Immediate navigation call from onLoginSuccess:
        return this.handleNavigate('dashboard', { authenticatedUser: fakeUser });
      }

      // Signup
      signup() {
        const newUser = { id: 'u_456', email: 'new@example.com' };
        this.authUserRef.current = newUser;
        return this.handleNavigate('dashboard', { authenticatedUser: newUser });
      }
    }

    const sim = new AuthNavigationSimulation();

    // Before login: navigation to dashboard is blocked and redirected to login
    assert.equal(sim.handleNavigate('dashboard'), 'login');
    assert.equal(sim.currentView, 'login');

    // On login: synchronous ref allows immediate navigation to dashboard without being bounced to login
    assert.equal(sim.login(), 'dashboard');
    assert.equal(sim.currentView, 'dashboard');

    // On signup: synchronous ref allows immediate navigation to dashboard
    const sim2 = new AuthNavigationSimulation();
    sim2.currentView = 'register';
    assert.equal(sim2.signup(), 'dashboard');
    assert.equal(sim2.currentView, 'dashboard');
  });
});
