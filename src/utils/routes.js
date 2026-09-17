/**
 * FocusLens Route Path Mapping & Location Resolver
 *
 * Provides bidirectional mapping between application views and canonical browser URL paths,
 * supporting HTML5 History API (pushState, popstate, replaceState) and URL hash navigation.
 */

// Canonical route path mappings for browser history & URLs
export const ROUTE_PATH_MAP = {
  landing: '/',
  dashboard: '/dashboard',
  setup: '/setup',
  recommendations: '/recommendations',
  history: '/history',
  calendar: '/calendar',
  messages: '/messages',
  options: '/options',
  profile: '/profile',
  coach: '/coach',
  consistency: '/consistency',
  'weekly-review': '/weekly-review',
  journal: '/journal',
  login: '/login',
  register: '/register',
  verify: '/verify',
  'forgot-password': '/forgot-password',
  report: '/report',
  active: '/active',
};

// Friendly aliases mapped to canonical view names
export const PATH_ALIASES = {
  tasks: 'setup',
  activity: 'history',
  settings: 'profile',
  'reset-password': 'forgot-password',
};

// Map child views to their contextual parent in-app back destinations
export const CONTEXTUAL_PARENT_MAP = {
  recommendations: 'dashboard',
  'weekly-review': 'dashboard',
  consistency: 'dashboard',
  coach: 'dashboard',
  journal: 'dashboard',
  profile: 'dashboard',
  calendar: 'dashboard',
  report: 'history',
};

/**
 * Resolves the view name from window.location (pathname, hash, search).
 *
 * @param {Location|Object} loc - window.location or mock location object
 * @returns {string} resolved view name
 */
export function resolveViewFromLocation(loc) {
  if (typeof window === 'undefined' && !loc) return 'landing';
  const location = loc || (typeof window !== 'undefined' ? window.location : null);
  if (!location) return 'landing';

  // Search parameters (e.g., password reset token)
  if (location.search && location.search.includes('token=')) {
    return 'forgot-password';
  }

  // Hash support (e.g., #dashboard, #setup, #recommendations)
  if (location.hash) {
    const rawHash = location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase().trim();
    if (PATH_ALIASES[rawHash]) return PATH_ALIASES[rawHash];
    if (ROUTE_PATH_MAP[rawHash]) return rawHash;
  }

  // Pathname support (e.g., /dashboard, /setup, /recommendations)
  const cleanPath = (location.pathname || '/').replace(/^\/+|\/+$/g, '').toLowerCase().trim();
  if (!cleanPath) return 'landing';

  if (PATH_ALIASES[cleanPath]) return PATH_ALIASES[cleanPath];
  if (ROUTE_PATH_MAP[cleanPath]) return cleanPath;

  return 'landing';
}
