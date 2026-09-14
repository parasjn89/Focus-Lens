import { dbStore } from '../db/store.js';
import { toSafeUser } from '../controllers/authController.js';

/**
 * Fastify preHandler middleware enforcing mandatory authentication
 */
export async function requireAuth(request, reply) {
  const userId = request.session?.userId;

  if (!userId) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in to access this resource.',
    });
  }

  try {
    const user = await dbStore.getUserById(userId);

    if (!user) {
      request.session.destroy();
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authenticated user session invalid or account removed.',
      });
    }

    request.user = toSafeUser(user);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to verify session authentication.',
    });
  }
}

/**
 * Fastify preHandler middleware attempting optional session authentication
 */
export async function optionalAuth(request, reply) {
  const userId = request.session?.userId;
  if (!userId) return;

  try {
    const user = await dbStore.getUserById(userId);
    if (user) {
      request.user = toSafeUser(user);
    }
  } catch (err) {
    // Silent catch for optional session resolution
  }
}

