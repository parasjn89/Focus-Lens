import crypto from 'crypto';
import { config } from '../config/env.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import { dbStore } from '../db/store.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Mock adapter hook for unit tests
let apiFetchOverride = null;

export function setGoogleApiFetchOverride(fn) {
  apiFetchOverride = fn;
}

async function doFetch(url, options) {
  if (apiFetchOverride) {
    return apiFetchOverride(url, options);
  }
  return fetch(url, options);
}

/**
 * Generates a signed, tamper-proof state parameter containing user ID, nonce, and expiry.
 *
 * @param {string} userId - FocusLens user ID
 * @returns {string} Base64URL-encoded signed state
 */
export function generateOAuthState(userId) {
  if (!userId) throw new Error('User ID is required to generate OAuth state.');
  const nonce = crypto.randomBytes(16).toString('hex');
  const ts = Date.now();
  const payload = JSON.stringify({ userId, nonce, ts });
  const hmac = crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig: hmac })).toString('base64url');
}

const usedOAuthNonces = new Map(); // nonce -> timestamp

/**
 * Resets used nonces for test isolation
 */
export function clearUsedOAuthNonces() {
  usedOAuthNonces.clear();
}

/**
 * Validates the state parameter and ensures it was generated for the current authenticated user.
 * Guarantees single-use by consuming the state nonce upon successful verification.
 *
 * @param {string} state - Base64URL state string from callback
 * @param {string} currentUserId - Authenticated FocusLens user ID
 * @param {Object} [options]
 * @param {boolean} [options.consume=true] - Whether to consume nonce (single-use)
 * @returns {boolean} True if valid and unused
 */
export function verifyOAuthState(state, currentUserId, { consume = true } = {}) {
  if (!state || !currentUserId) return false;
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const { payload, sig } = JSON.parse(raw);
    const expectedSig = crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');

    // Constant-time signature comparison
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return false;
    }

    const data = JSON.parse(payload);
    // User isolation check
    if (data.userId !== currentUserId) {
      return false;
    }

    // Expiry check: state valid for 15 minutes (900,000 ms)
    const MAX_AGE_MS = 15 * 60 * 1000;
    const now = Date.now();
    if (now - data.ts > MAX_AGE_MS || data.ts > now + 60000) {
      return false;
    }

    // Single-use check: state nonce must not have been previously consumed
    if (usedOAuthNonces.has(data.nonce)) {
      return false;
    }

    if (consume) {
      usedOAuthNonces.set(data.nonce, data.ts);
      // Prune expired nonces
      for (const [nonce, ts] of usedOAuthNonces.entries()) {
        if (now - ts > MAX_AGE_MS) {
          usedOAuthNonces.delete(nonce);
        }
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Creates Google OAuth 2.0 authorization URL.
 *
 * @param {string} userId - Authenticated user ID
 * @returns {string} Authorization URL
 */
export function createAuthorizationUrl(userId) {
  if (!config.googleClientId) {
    const err = new Error('Google OAuth is not configured. GOOGLE_CLIENT_ID is missing.');
    err.statusCode = 500;
    throw err;
  }

  const state = generateOAuthState(userId);
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: 'code',
    scope: REQUIRED_SCOPES.join(' '),
    access_type: 'offline', // Requests refresh_token
    prompt: 'consent',     // Ensures refresh_token is returned even on re-authorization
    include_granted_scopes: 'true',
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens.
 *
 * @param {string} code - Authorization code from Google redirect
 * @returns {Promise<{ accessToken: string, refreshToken?: string, expiresIn: number, scope?: string, idToken?: string }>}
 */
export function exchangeCodeForTokens(code) {
  return (async () => {
    if (!code) throw new Error('Authorization code is required.');

    const bodyParams = new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: 'authorization_code',
    });

    const res = await doFetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      const msg = data.error_description || data.error || 'Failed to exchange authorization code for tokens.';
      const err = new Error(msg);
      err.statusCode = res.status || 400;
      throw err;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresIn: data.expires_in || 3600,
      scope: data.scope || '',
      idToken: data.id_token || null,
    };
  })();
}

/**
 * Fetches user profile email from Google UserInfo endpoint or decodes ID token.
 *
 * @param {string} accessToken
 * @param {string} [idToken]
 * @returns {Promise<string|null>}
 */
export async function getConnectedUserEmail(accessToken, idToken) {
  // Option A: Try extracting from idToken payload without network roundtrip
  if (idToken) {
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        if (payload.email) {
          return payload.email;
        }
      }
    } catch (e) {
      // Fall through to UserInfo endpoint
    }
  }

  // Option B: Query UserInfo API
  if (accessToken) {
    try {
      const res = await doFetch(GOOGLE_USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const info = await res.json();
        return info.email || null;
      }
    } catch (err) {
      // Silent catch
    }
  }

  return null;
}

/**
 * Refreshes an expired access token using the stored refresh token.
 *
 * @param {string} refreshToken
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) throw new Error('Refresh token is required to refresh access token.');

  const bodyParams = new URLSearchParams({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await doFetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const msg = data.error_description || data.error || 'Failed to refresh Google access token.';
    const err = new Error(msg);
    err.statusCode = 401;
    err.code = 'GOOGLE_TOKEN_REFRESH_FAILED';
    throw err;
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Obtains a valid, unexpired access token for the user's connection.
 * Automatically handles token expiration and token refresh.
 *
 * @param {Object} connection - Database connection record
 * @returns {Promise<string>} Plaintext valid access token
 */
export async function getValidAccessToken(connection) {
  if (!connection) {
    const err = new Error('Google Calendar connection not found.');
    err.statusCode = 404;
    err.code = 'NOT_CONNECTED';
    throw err;
  }

  let accessToken = decryptToken(connection.accessTokenEncrypted);
  const now = Date.now();
  const tokenExpiryMs = connection.tokenExpiry ? new Date(connection.tokenExpiry).getTime() : 0;
  const isExpiringSoon = tokenExpiryMs > 0 && tokenExpiryMs - now < 60000; // within 60s

  if (isExpiringSoon) {
    if (!connection.refreshTokenEncrypted) {
      const err = new Error('Google Calendar connection expired. Please reconnect.');
      err.statusCode = 401;
      err.code = 'GOOGLE_TOKEN_EXPIRED';
      throw err;
    }

    try {
      const refreshToken = decryptToken(connection.refreshTokenEncrypted);
      const refreshed = await refreshAccessToken(refreshToken);

      accessToken = refreshed.accessToken;
      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

      // Persist refreshed token securely
      await dbStore.upsertGoogleCalendarConnection(connection.userId, {
        accessTokenEncrypted: encryptToken(accessToken),
        refreshTokenEncrypted: connection.refreshTokenEncrypted,
        tokenExpiry: newExpiry,
      });
    } catch (err) {
      // Safely disconnect / clean up invalid connection so user is prompted to reconnect
      await dbStore.deleteGoogleCalendarConnection(connection.userId).catch(() => {});
      const error = new Error('Google Calendar connection expired or was revoked. Please reconnect.');
      error.statusCode = 401;
      error.code = 'GOOGLE_TOKEN_EXPIRED';
      throw error;
    }
  }

  return accessToken;
}

/**
 * Best-effort token revocation at Google endpoint.
 *
 * @param {string} token
 */
export async function revokeGoogleToken(token) {
  if (!token) return;
  try {
    await doFetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (e) {
    // Best-effort revocation
  }
}

/**
 * Lists user's accessible Google calendars.
 *
 * @param {string} accessToken
 * @returns {Promise<Array<{ id: string, summary: string, description: string, primary: boolean, timeZone: string }>>}
 */
export async function listGoogleCalendars(accessToken) {
  const url = `${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`;
  const res = await doFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || 'Failed to fetch Google calendars.');
    err.statusCode = res.status || 500;
    throw err;
  }

  const items = data.items || [];
  return items.map((c) => ({
    id: c.id,
    summary: c.summary || (c.primary ? 'Primary Calendar' : '(Untitled Calendar)'),
    description: c.description || '',
    primary: Boolean(c.primary),
    timeZone: c.timeZone || 'UTC',
  }));
}

/**
 * Normalizes a raw Google Calendar event into FocusLens standard read-only format.
 *
 * @param {Object} event - Raw Google Calendar API event
 * @returns {Object} Normalized event object
 */
export function normalizeGoogleEvent(event) {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const startStr = event.start?.dateTime || event.start?.date || null;
  const endStr = event.end?.dateTime || event.end?.date || null;

  return {
    id: event.id,
    title: event.summary || '(No title)',
    description: event.description || '',
    start: startStr,
    end: endStr,
    allDay: isAllDay,
    location: event.location || '',
    htmlLink: event.htmlLink || '',
  };
}

/**
 * Fetches events from the user's selected Google calendar within a given date range.
 *
 * @param {string} accessToken
 * @param {string} calendarId - Target calendar ID (defaults to 'primary')
 * @param {Object} options
 * @param {string} options.timeMin - ISO timestamp or YYYY-MM-DD
 * @param {string} options.timeMax - ISO timestamp or YYYY-MM-DD
 * @returns {Promise<Array>} Normalized event array
 */
export async function listGoogleCalendarEvents(accessToken, calendarId = 'primary', { timeMin, timeMax } = {}) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  // Ensure ISO format for Google Calendar API
  if (timeMin) {
    const minIso = timeMin.includes('T') ? timeMin : `${timeMin}T00:00:00Z`;
    params.set('timeMin', minIso);
  }
  if (timeMax) {
    const maxIso = timeMax.includes('T') ? timeMax : `${timeMax}T23:59:59Z`;
    params.set('timeMax', maxIso);
  }

  const calIdEncoded = encodeURIComponent(calendarId || 'primary');
  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/${calIdEncoded}/events?${params.toString()}`;

  const res = await doFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    const err = new Error(data.error?.message || 'Failed to fetch Google Calendar events.');
    err.statusCode = res.status || 500;
    throw err;
  }

  const items = data.items || [];
  // Filter out cancelled events and normalize
  return items
    .filter((evt) => evt.status !== 'cancelled')
    .map(normalizeGoogleEvent);
}
