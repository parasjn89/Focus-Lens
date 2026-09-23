import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from './config/env.js';
import { privacyGuard } from './middleware/privacyGuard.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { sessionRoutes } from './routes/sessionRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { weeklyReviewRoutes } from './routes/weeklyReviewRoutes.js';
import { journalRoutes } from './routes/journalRoutes.js';
import { calendarRoutes } from './routes/calendarRoutes.js';
import { googleCalendarRoutes } from './routes/googleCalendarRoutes.js';
import { taskRoutes } from './routes/taskRoutes.js';
import { buddyRoutes } from './routes/buddyRoutes.js';
import { messageRoutes } from './routes/messageRoutes.js';
import { dbStore } from './db/store.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 1048576, // 1MB body limit
    trustProxy: options.trustProxy ?? true,
  });

  // CORS Configuration
  const defaultAllowedOrigins = [
    'https://focus-lens-nine.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];

  const allowedOrigins = (origin, cb) => {
    // Requests with no origin (such as mobile apps, curl, server-to-server) are allowed
    if (!origin) return cb(null, true);

    const isDefault = defaultAllowedOrigins.includes(origin);
    const isVercelDeploy = /^https:\/\/focus-lens-[a-z0-9\-]+\.vercel\.app$/.test(origin);
    const isCustomOrigin = config.corsOrigin && config.corsOrigin !== '*' && config.corsOrigin.split(',').map(s => s.trim()).includes(origin);
    const isDev = config.nodeEnv !== 'production';

    if (isDefault || isVercelDeploy || isCustomOrigin || isDev) {
      return cb(null, true);
    }
    return cb(new Error(`CORS origin not allowed: ${origin}`), false);
  };

  app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Security Response Headers Hook
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(self), display-capture=(self)');
  });

  // Cookie & Session Configuration
  app.register(fastifyCookie, {
    secret: config.sessionSecret,
  });

  const isProduction = config.nodeEnv === 'production';

  app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: 'focuslens_session',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    saveUninitialized: false,
  });

  // Rate Limiting for Auth Brute-force protection
  app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Privacy Protection Hook
  app.addHook('preValidation', privacyGuard);

  // Register API routes
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(sessionRoutes);
  app.register(dashboardRoutes);
  app.register(weeklyReviewRoutes);
  app.register(journalRoutes);
  app.register(calendarRoutes);
  app.register(googleCalendarRoutes);
  app.register(taskRoutes);
  app.register(buddyRoutes);
  app.register(messageRoutes);

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const message = statusCode === 500 
      ? 'Internal Server Error' 
      : error.message;

    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message,
    });
  });

  // Reconcile any stale active sessions on application startup
  app.addHook('onReady', async () => {
    try {
      await dbStore.reconcileAllStaleActiveSessions();
    } catch (err) {
      app.log.warn(`[Startup] Active session reconciliation failed: ${err.message}`);
    }
  });

  return app;
}
