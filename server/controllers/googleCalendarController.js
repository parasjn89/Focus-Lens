import { dbStore } from '../db/store.js';
import {
  createAuthorizationUrl,
  verifyOAuthState,
  exchangeCodeForTokens,
  getConnectedUserEmail,
  getValidAccessToken,
  revokeGoogleToken,
  listGoogleCalendars,
  listGoogleCalendarEvents,
} from '../services/googleCalendar.js';
import { decryptToken, encryptToken } from '../utils/encryption.js';
import { config } from '../config/env.js';

function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  if (request.session && request.session.userId) {
    return request.session.userId;
  }
  const err = new Error('Authentication required. Please log in.');
  err.statusCode = 401;
  throw err;
}

/**
 * GET /api/integrations/google-calendar/connect
 * Initiates Google OAuth 2.0 flow for the authenticated user.
 */
export async function connectGoogleCalendar(request, reply) {
  try {
    const userId = resolveUserId(request);
    const authUrl = createAuthorizationUrl(userId);

    const acceptsHtml = Boolean(request.headers.accept && request.headers.accept.includes('text/html'));
    const wantsRedirect = request.query.redirect === 'true' || acceptsHtml;

    // If client requested direct redirect or browser visited route directly
    if (wantsRedirect) {
      return reply.redirect(authUrl);
    }

    return reply.send({
      statusCode: 200,
      url: authUrl,
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      message: err.message || 'Failed to initiate Google authorization.',
    });
  }
}

/**
 * GET /api/integrations/google-calendar/callback
 * Handles OAuth 2.0 redirect from Google, validates state, and persists tokens.
 */
export async function googleCalendarCallback(request, reply) {
  const { code, state, error } = request.query;

  // Handle user cancellation or denial
  if (error) {
    request.log.warn({ googleError: error }, 'Google OAuth authorization denied by user.');
    return reply.redirect(`${config.frontendUrl}/calendar?google=denied`);
  }

  if (!code || !state) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Missing code or state in OAuth callback.',
    });
  }

  // Validate state against authenticated user
  const authenticatedUserId = request.user?.id || request.session?.userId;
  if (!authenticatedUserId) {
    request.log.warn('Session expired or unauthenticated during OAuth callback.');
    return reply.redirect(`${config.frontendUrl}/calendar?google=error&message=${encodeURIComponent('Session expired during OAuth authorization. Please log in again.')}`);
  }

  const isValidState = verifyOAuthState(state, authenticatedUserId);
  if (!isValidState) {
    request.log.warn({ state, authenticatedUserId }, 'Invalid or expired OAuth state detected.');
    return reply.redirect(`${config.frontendUrl}/calendar?google=error&message=Invalid+OAuth+state`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    const email = await getConnectedUserEmail(tokens.accessToken, tokens.idToken);
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    // Encrypt sensitive tokens before saving
    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

    // Check if there was an existing connection with a preserved refresh token
    const existing = await dbStore.getGoogleCalendarConnection(authenticatedUserId);
    const finalRefreshToken = refreshTokenEncrypted || existing?.refreshTokenEncrypted || null;

    await dbStore.upsertGoogleCalendarConnection(authenticatedUserId, {
      googleAccountEmail: email,
      accessTokenEncrypted,
      refreshTokenEncrypted: finalRefreshToken,
      scope: tokens.scope,
      tokenExpiry,
      calendarId: existing?.calendarId || 'primary',
    });

    request.log.info({ userId: authenticatedUserId, email }, 'Google Calendar connected successfully.');
    return reply.redirect(`${config.frontendUrl}/calendar?google=connected`);
  } catch (err) {
    request.log.error(err, 'Failed to complete Google OAuth exchange.');
    return reply.redirect(`${config.frontendUrl}/calendar?google=error&message=Authentication+failed`);
  }
}

/**
 * GET /api/integrations/google-calendar/status
 * Returns connection status and safe metadata for authenticated user. Never exposes tokens.
 */
export async function getGoogleCalendarStatus(request, reply) {
  try {
    const userId = resolveUserId(request);
    const connection = await dbStore.getGoogleCalendarConnection(userId);

    if (!connection) {
      return reply.send({
        connected: false,
        email: null,
        selectedCalendarId: 'primary',
      });
    }

    return reply.send({
      connected: true,
      email: connection.googleAccountEmail || null,
      selectedCalendarId: connection.calendarId || 'primary',
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      message: err.message || 'Failed to retrieve connection status.',
    });
  }
}

/**
 * GET /api/integrations/google-calendar/calendars
 * Returns list of accessible Google calendars for the authenticated user.
 */
export async function getGoogleCalendars(request, reply) {
  try {
    const userId = resolveUserId(request);
    const connection = await dbStore.getGoogleCalendarConnection(userId);

    if (!connection) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Google Calendar is not connected. Please connect your account first.',
      });
    }

    const accessToken = await getValidAccessToken(connection);
    const calendars = await listGoogleCalendars(accessToken);

    return reply.send({
      calendars,
      selectedCalendarId: connection.calendarId || 'primary',
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    const message = err.code === 'GOOGLE_TOKEN_EXPIRED'
      ? 'Google Calendar connection expired. Please reconnect.'
      : (err.message || 'Failed to retrieve Google calendars.');

    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      code: err.code || null,
      message,
    });
  }
}

/**
 * POST /api/integrations/google-calendar/select-calendar
 * Updates the user's active Google calendar ID.
 */
export async function selectGoogleCalendar(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { calendarId } = request.body || {};

    if (!calendarId || typeof calendarId !== 'string') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'calendarId string is required.',
      });
    }

    const connection = await dbStore.getGoogleCalendarConnection(userId);
    if (!connection) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Google Calendar is not connected.',
      });
    }

    const updated = await dbStore.updateGoogleCalendarSelectedCalendar(userId, calendarId.trim());

    return reply.send({
      statusCode: 200,
      success: true,
      selectedCalendarId: updated?.calendarId || calendarId,
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      message: err.message || 'Failed to update selected calendar.',
    });
  }
}

/**
 * GET /api/integrations/google-calendar/events
 * Fetches events from Google Calendar for the selected date range.
 */
export async function getGoogleCalendarEvents(request, reply) {
  try {
    const userId = resolveUserId(request);
    const connection = await dbStore.getGoogleCalendarConnection(userId);

    if (!connection) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Google Calendar is not connected. Please connect your account first.',
      });
    }

    const { start, end, calendarId } = request.query || {};
    const targetCalendarId = calendarId || connection.calendarId || 'primary';

    const accessToken = await getValidAccessToken(connection);
    const events = await listGoogleCalendarEvents(accessToken, targetCalendarId, {
      timeMin: start,
      timeMax: end,
    });

    return reply.send({
      statusCode: 200,
      events,
      calendarId: targetCalendarId,
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    const message = err.code === 'GOOGLE_TOKEN_EXPIRED'
      ? 'Google Calendar connection expired. Please reconnect.'
      : (err.message || 'Failed to fetch Google Calendar events.');

    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      code: err.code || null,
      message,
    });
  }
}

/**
 * POST /api/integrations/google-calendar/disconnect
 * Revokes Google tokens and removes the user's connection.
 */
export async function disconnectGoogleCalendar(request, reply) {
  try {
    const userId = resolveUserId(request);
    const connection = await dbStore.getGoogleCalendarConnection(userId);

    if (connection) {
      // Best-effort token revocation
      try {
        if (connection.accessTokenEncrypted) {
          const token = decryptToken(connection.accessTokenEncrypted);
          await revokeGoogleToken(token);
        }
      } catch (e) {
        // Continue with connection removal
      }

      await dbStore.deleteGoogleCalendarConnection(userId);
    }

    return reply.send({
      statusCode: 200,
      success: true,
      connected: false,
    });
  } catch (err) {
    request.log.error(err);
    const statusCode = err.statusCode || 500;
    return reply.status(statusCode).send({
      statusCode,
      error: err.name || 'Error',
      message: err.message || 'Failed to disconnect Google Calendar.',
    });
  }
}
