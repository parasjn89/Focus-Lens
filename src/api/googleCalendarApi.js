import { apiFetch } from './client.js';

/**
 * Checks Google Calendar connection status for the current authenticated user.
 * Returns { connected: boolean, email: string|null, selectedCalendarId: string }
 */
export async function fetchGoogleCalendarStatus() {
  return apiFetch('/api/integrations/google-calendar/status');
}

/**
 * Requests the Google OAuth authorization URL.
 * Returns { url: string }
 */
export async function getGoogleCalendarConnectUrl() {
  return apiFetch('/api/integrations/google-calendar/connect');
}

/**
 * Initiates the Google OAuth 2.0 authorization flow:
 * Requests the authorization URL from backend and redirects the browser to Google OAuth.
 *
 * @returns {Promise<{ url: string }>}
 */
export async function connectGoogleCalendar() {
  const data = await getGoogleCalendarConnectUrl();
  if (data && data.url) {
    if (typeof window !== 'undefined') {
      window.location.href = data.url;
    }
    return data;
  }
  throw new Error(data?.message || 'No authorization URL returned from server.');
}

/**
 * Fetches user's accessible Google calendars.
 * Returns { calendars: Array<{ id, summary, description, primary, timeZone }>, selectedCalendarId: string }
 */
export async function fetchGoogleCalendars() {
  return apiFetch('/api/integrations/google-calendar/calendars');
}

/**
 * Updates the active calendar ID for FocusLens display.
 *
 * @param {string} calendarId
 * @returns {Promise<{ success: boolean, selectedCalendarId: string }>}
 */
export async function selectGoogleCalendar(calendarId) {
  return apiFetch('/api/integrations/google-calendar/select-calendar', {
    method: 'POST',
    body: JSON.stringify({ calendarId }),
  });
}

/**
 * Fetches events from Google Calendar for the specified date range.
 *
 * @param {string} startDateStr - YYYY-MM-DD or ISO string
 * @param {string} endDateStr - YYYY-MM-DD or ISO string
 * @param {string} [calendarId] - Optional specific calendar ID
 * @returns {Promise<{ events: Array, calendarId: string }>}
 */
export async function fetchGoogleCalendarEvents(startDateStr, endDateStr, calendarId) {
  const params = new URLSearchParams();
  if (startDateStr) params.set('start', startDateStr);
  if (endDateStr) params.set('end', endDateStr);
  if (calendarId) params.set('calendarId', calendarId);

  return apiFetch(`/api/integrations/google-calendar/events?${params.toString()}`);
}

/**
 * Disconnects the Google Calendar integration and removes server-side stored tokens.
 *
 * @returns {Promise<{ success: boolean, connected: false }>}
 */
export async function disconnectGoogleCalendar() {
  return apiFetch('/api/integrations/google-calendar/disconnect', {
    method: 'POST',
  });
}
