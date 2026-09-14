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

export function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? true,
    bodyLimit: 1048576, // 1MB body limit
  });

  // CORS Configuration
  const allowedOrigins = config.corsOrigin === '*'
    ? true
    : (config.corsOrigin.includes(',') ? config.corsOrigin.split(',').map(o => o.trim()) : config.corsOrigin);

  app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Security Response Headers Hook
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  });

  // Cookie & Session Configuration

  // Cookie & Session Configuration
  app.register(fastifyCookie, {
    secret: config.sessionSecret,
  });

  app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: 'focuslens_session',
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      sameSite: 'lax',
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

  return app;
}
