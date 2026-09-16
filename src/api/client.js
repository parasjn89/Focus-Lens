const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
  const url = `${API_BASE_URL}${endpoint}`;
  const isWriteMethod = ['POST', 'PUT', 'PATCH'].includes((options.method || 'GET').toUpperCase());
  const body = options.body !== undefined ? options.body : (isWriteMethod ? '{}' : undefined);
  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

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
        throw new Error(`API error (HTTP ${response.status}): Non-JSON response received`);
      }
      throw new Error(`Unexpected server response format (${contentType || 'text/html'}). Expected JSON.`);
    }

    if (!response.ok) {
      throw new Error(data.message || `API error: HTTP ${response.status}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('API Request timed out');
    }
    throw err;
  }
}

