import { checkDbConnection } from '../db/client.js';

export async function healthRoutes(fastify, options) {
  fastify.get('/api/health', async (request, reply) => {
    const isDbConnected = await checkDbConnection();
    return reply.send({
      status: 'ok',
      service: 'focuslens-backend',
      timestamp: new Date().toISOString(),
      database: isDbConnected ? 'connected' : 'disconnected',
    });
  });
}
