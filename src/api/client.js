/**
 * Resolves the appropriate backend API base URL safely across environments.
 * - In local development: defaults to VITE_API_BASE_URL or http://localhost:3001
 * - In production: strictly forbids localhost/127.0.0.1. Uses explicit remote URL if configured,
 *   or defaults to relative '' so requests stay on the same origin (/api/...)
 */
export function resolveApiBaseUrl(rawEnvUrl = import.meta.env?.VITE_API_BASE_URL, isProdOverride = null) {
  const envUrl = (rawEnvUrl || '').trim();
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isProd = isProdOverride !== null ? isProdOverride : (Boolean(import.meta.env?.PROD) || (isBrowser && !isLocalHost));

  if (isProd) {
    // If an explicit remote backend URL is provided (not localhost), use it
    if (envUrl && !/localhost|127\.0\.0\.1/i.test(envUrl)) {
      return envUrl.replace(/\/$/, '');
    }
    // In production without a valid remote backend URL, use relative root path ''
    // NEVER call localhost in production
    return '';
  }

  // Development environment
  return envUrl || 'http://localhost:3001';
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

/**
 * Returns safe client-side API diagnostic information without exposing secrets
 */
export function getApiDiagnostics() {
  const resolved = resolveApiBaseUrl();
  const rawEnv = (import.meta.env?.VITE_API_BASE_URL || '').trim();
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  return {
    resolvedApiBaseUrl: resolved || '(same-origin / relative)',
    rawEnvConfigured: Boolean(rawEnv),
    rawEnvValue: rawEnv ? (rawEnv.includes('localhost') ? 'http://localhost:3001' : rawEnv) : '(empty)',
    isProduction: Boolean(import.meta.env?.PROD) || (isBrowser && !isLocalHost),
    currentOrigin: isBrowser ? window.location.origin : '',
  };
}

if (typeof window !== 'undefined') {
  window.__FOCUSLENS_API_DIAGNOSTICS__ = getApiDiagnostics;
}

/**
 * Gets or initializes an anonymous user identity for browser sessions
 */
export function getAnonymousUserId() {
  let anonId = localStorage.getItem('focuslens_anonymous_id');
  if (!anonId) {
    anonId = `anon_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    localStorage.setItem('focuslens_anonymous_id', anonId);
  }
  return anonId;
}

/**
 * Low-level HTTP fetch helper with default JSON headers, credentials, and timeout handling
 */
export async function apiFetch(endpoint, options = {}) {
  const baseUrl = resolveApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes((options.method || 'GET').toUpperCase());
  const body = options.body !== undefined ? options.body : (isWriteMethod ? '{}' : undefined);
  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const response = await fetch(url, {
      credentials: 'include', // Pass HTTP-only session cookies
      ...options,
      headers,
      ...(body !== undefined ? { body } : {}),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data = {};

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }
    } else {
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        const isAuth = response.status === 401 || response.status === 403;
        const err = new Error(
          isAuth
            ? `Your session has expired or is unauthorized (HTTP ${response.status}). Please log in again.`
            : `API error (HTTP ${response.status} ${response.statusText}): Non-JSON response received from ${endpoint}`
        );
        err.status = response.status;
        err.statusText = response.statusText;
        err.endpoint = endpoint;
        err.targetUrl = url;
        err.code = isAuth ? (response.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN') : 'HTTP_NON_JSON_RESPONSE';
        err.isAuthError = isAuth;
        throw err;
      }
      throw new Error(`Unexpected server response format (${contentType || 'text/html'}) from ${endpoint}. Expected JSON.`);
    }

    if (!response.ok) {
      const isAuth = response.status === 401 || response.status === 403;
      const defaultMessage = isAuth
        ? 'Your session has expired. Please log in again.'
        : `API error: HTTP ${response.status} ${response.statusText}`;
      const err = new Error(data.message || defaultMessage);
      err.status = response.status;
      err.statusText = response.statusText;
      err.data = data;
      err.field = data.field;
      err.errors = data.errors;
      err.endpoint = endpoint;
      err.targetUrl = url;
      err.code = data.code || data.error || (isAuth ? (response.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN') : `HTTP_${response.status}`);
      err.isAuthError = isAuth;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`API request to ${endpoint} timed out after ${options.timeoutMs || 10000}ms. The server took too long to respond.`);
      timeoutErr.code = 'TIMEOUT';
      timeoutErr.status = 408;
      timeoutErr.endpoint = endpoint;
      timeoutErr.targetUrl = url;
      timeoutErr.isNetworkError = true;
      throw timeoutErr;
    }

    // Enhance TypeError fetch failures (e.g. Failed to fetch, NetworkError, CORS)
    if (err.name === 'TypeError' && /failed to fetch|network|fetch failed/i.test(err.message)) {
      const isBrowser = typeof window !== 'undefined';
      const currentOrigin = isBrowser ? window.location.origin : '';
      const resolvedTarget = url.startsWith('http') ? url : `${currentOrigin}${url}`;

      let failureType = 'NETWORK_FAILURE';
      let diagnosticHint = '';

      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        failureType = 'MIXED_CONTENT_LOCALHOST_BLOCKED';
        diagnosticHint = `Cannot connect to local development backend (${url}) from deployed application. Please configure VITE_API_BASE_URL.`;
      } else if (isBrowser && typeof navigator !== 'undefined' && navigator.onLine === false) {
        failureType = 'CLIENT_OFFLINE';
        diagnosticHint = 'Your device appears to be offline. Please check your internet connection.';
      } else {
        failureType = 'BACKEND_UNAVAILABLE_OR_CORS';
        diagnosticHint = `Unable to connect to backend server at ${resolvedTarget}. The backend server may be offline, starting up, or CORS origin may be rejected.`;
      }

      const enhancedErr = new Error(
        diagnosticHint
          ? `${diagnosticHint} (${err.message})`
          : `Network connection failed when requesting ${endpoint} (${err.message})`
      );
      enhancedErr.code = failureType;
      enhancedErr.originalError = err;
      enhancedErr.endpoint = endpoint;
      enhancedErr.targetUrl = resolvedTarget;
      enhancedErr.isNetworkError = true;
      throw enhancedErr;
    }

    throw err;
  }
}
