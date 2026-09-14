import { z } from 'zod';
import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from '../utils/analytics.js';

// Request Validation Schemas using Zod
export const CreateSessionSchema = z.object({
  plannedDurationMs: z.number().int().positive('plannedDurationMs must be positive'),
  selectedActivity: z.string().min(1, 'selectedActivity is required'),
  startedAt: z.string().optional(),
  anonymousId: z.string().optional().default('anon_default_user'),
});

export const SaveSegmentsSchema = z.object({
  segments: z.array(
    z.object({
      activityType: z.string(),
      startTimeMs: z.number(),
      endTimeMs: z.number(),
      durationMs: z.number().int(),
      evidenceScore: z.number(),
      confidenceType: z.string().optional().default('heuristic'),
      contributingSignals: z.array(z.string()).optional().default([]),
      explanation: z.any().optional().default({}),
    })
  ).min(1, 'segments array cannot be empty'),
});

export const UpdateSessionSchema = z.object({
  actualDurationMs: z.number().int().nonnegative().optional(),
  pausedDurationMs: z.number().int().nonnegative().optional(),
  endedAt: z.string().optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional().default('COMPLETED'),
});

/**
 * Helper to resolve user ID strictly from authenticated server-side session context.
 * NEVER trusts client-supplied user IDs or shared anonymous fallbacks.
 */
function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  const err = new Error('Authentication required. Please log in.');
  err.statusCode = 401;
  throw err;
}

// Handler: POST /api/sessions
export async function createSession(request, reply) {
  try {
    const body = CreateSessionSchema.parse(request.body);
    const userId = resolveUserId(request);

    const session = await dbStore.createSession({
      userId,
      selectedActivity: body.selectedActivity,
      plannedDurationMs: body.plannedDurationMs,
      startedAt: body.startedAt,
    });

    return reply.status(201).send({
      session,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to create session in database.',
    });
  }
}

// Handler: GET /api/sessions
export async function listSessions(request, reply) {
  try {
    const userId = resolveUserId(request);
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const offset = Math.max(0, parseInt(request.query.offset || '0', 10));
    const { from, to } = request.query;

    const sessionList = await dbStore.getSessionsByUserId(userId, { limit, offset, from, to });

    return reply.send({
      sessions: sessionList,
      limit,
      offset,
      count: sessionList.length,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to retrieve session history.',
    });
  }
}

// Handler: GET /api/sessions/:id
export async function getSessionById(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);

    const session = await dbStore.getSessionByIdAndUser(id, userId);

    if (!session) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    const segments = await dbStore.getSegmentsBySessionId(id);
    const statistics = calculateSessionAnalytics(session, segments);

    return reply.send({
      session,
      activitySegments: segments,
      statistics,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to retrieve session details.',
    });
  }
}

// Handler: POST /api/sessions/:id/segments
export async function saveSegments(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);
    const body = SaveSegmentsSchema.parse(request.body);

    const insertedSegments = await dbStore.saveSegments(id, userId, body.segments);

    if (!insertedSegments) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    return reply.status(201).send({
      sessionId: id,
      savedCount: insertedSegments.length,
      segments: insertedSegments,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to save activity segments.',
    });
  }
}

// Handler: PUT /api/sessions/:id
export async function updateSession(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);
    const body = UpdateSessionSchema.parse(request.body);

    const updated = await dbStore.updateSession(id, userId, body);

    if (!updated) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    const segments = await dbStore.getSegmentsBySessionId(id);
    const statistics = calculateSessionAnalytics(updated, segments);

    return reply.send({
      session: updated,
      statistics,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to update session.',
    });
  }
}

// Handler: DELETE /api/sessions/:id
export async function deleteSession(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);

    const deleted = await dbStore.deleteSession(id, userId);

    if (!deleted) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    return reply.send({
      success: true,
      message: `Session "${id}" deleted successfully.`,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to delete session.',
    });
  }
}
