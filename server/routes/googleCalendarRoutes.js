import {
  connectGoogleCalendar,
  googleCalendarCallback,
  getGoogleCalendarStatus,
  getGoogleCalendars,
  selectGoogleCalendar,
  getGoogleCalendarEvents,
  disconnectGoogleCalendar,
} from '../controllers/googleCalendarController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

export async function googleCalendarRoutes(fastify, options) {
  // OAuth initiation
  fastify.get('/api/calendar/google/connect', { preHandler: requireAuth }, connectGoogleCalendar);
  fastify.get('/api/integrations/google-calendar/connect', { preHandler: requireAuth }, connectGoogleCalendar);
  fastify.get('/api/google-calendar/connect', { preHandler: requireAuth }, connectGoogleCalendar);

  // OAuth callback from Google (uses session cookie + verified signed state)
  fastify.get('/api/calendar/google/callback', { preHandler: optionalAuth }, googleCalendarCallback);
  fastify.get('/api/integrations/google-calendar/callback', { preHandler: optionalAuth }, googleCalendarCallback);
  fastify.get('/api/google-calendar/callback', { preHandler: optionalAuth }, googleCalendarCallback);

  // Status check (returns connected: boolean, email, selectedCalendarId)
  fastify.get('/api/calendar/google/status', { preHandler: requireAuth }, getGoogleCalendarStatus);
  fastify.get('/api/integrations/google-calendar/status', { preHandler: requireAuth }, getGoogleCalendarStatus);
  fastify.get('/api/google-calendar/status', { preHandler: requireAuth }, getGoogleCalendarStatus);

  // List accessible Google calendars
  fastify.get('/api/calendar/google/calendars', { preHandler: requireAuth }, getGoogleCalendars);
  fastify.get('/api/integrations/google-calendar/calendars', { preHandler: requireAuth }, getGoogleCalendars);
  fastify.get('/api/google-calendar/calendars', { preHandler: requireAuth }, getGoogleCalendars);

  // Select active Google calendar (supports POST or PUT)
  fastify.post('/api/calendar/google/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);
  fastify.put('/api/calendar/google/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);
  fastify.post('/api/integrations/google-calendar/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);
  fastify.put('/api/integrations/google-calendar/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);
  fastify.post('/api/google-calendar/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);
  fastify.put('/api/google-calendar/select-calendar', { preHandler: requireAuth }, selectGoogleCalendar);

  // Fetch events for date range (/api/calendar/events is the primary specification endpoint)
  fastify.get('/api/calendar/events', { preHandler: requireAuth }, getGoogleCalendarEvents);
  fastify.get('/api/calendar/google/events', { preHandler: requireAuth }, getGoogleCalendarEvents);
  fastify.get('/api/integrations/google-calendar/events', { preHandler: requireAuth }, getGoogleCalendarEvents);
  fastify.get('/api/google-calendar/events', { preHandler: requireAuth }, getGoogleCalendarEvents);

  // Disconnect Google Calendar (supports POST or DELETE)
  fastify.post('/api/calendar/google/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
  fastify.delete('/api/calendar/google/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
  fastify.post('/api/integrations/google-calendar/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
  fastify.delete('/api/integrations/google-calendar/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
  fastify.post('/api/google-calendar/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
  fastify.delete('/api/google-calendar/disconnect', { preHandler: requireAuth }, disconnectGoogleCalendar);
}
