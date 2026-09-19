import { z } from 'zod';
import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from '../utils/analytics.js';
import { generateFocusCoachAnalysis } from '../utils/focusCoachEngine.js';
import { generateConsistencyAnalysis } from '../utils/consistencyEngine.js';
import { generateAdaptiveSessionRecommendation } from '../utils/adaptiveSessionEngine.js';

// Request Validation Schemas using Zod
export const CreateSessionSchema = z.object({
  plannedDurationMs: z.number().int().positive('plannedDurationMs must be positive'),
  selectedActivity: z.string().min(1, 'selectedActivity is required'),
  startedAt: z.string().optional(),
  anonymousId: z.string().optional().default('anon_default_user'),
  goalText: z.string().max(120, 'Goal text cannot exceed 120 characters').transform(s => (typeof s === 'string' ? s.trim() : null)).optional().nullable(),
  goalType: z.enum(['NONE', 'TIME', 'COUNT']).optional().default('NONE'),
  targetValue: z.number().positive('Target value must be positive').optional().nullable(),
  targetUnit: z.string().max(40, 'Target unit cannot exceed 40 characters').transform(s => (typeof s === 'string' ? s.trim() : null)).optional().nullable(),
}).superRefine((data, ctx) => {
  const type = data.goalType || 'NONE';
  const text = data.goalText ? data.goalText.trim() : '';

  if (type !== 'NONE') {
    if (!text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['goalText'],
        message: 'Goal text is required when a goal target is specified',
      });
    }

    if (type === 'TIME') {
      if (data.targetValue == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetValue'],
          message: 'Target focus time in minutes is required for TIME goals',
        });
      } else if (data.targetValue < 1 || data.targetValue > 600) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetValue'],
          message: 'Target focus time must be between 1 and 600 minutes',
        });
      }
    }

    if (type === 'COUNT') {
      if (data.targetValue == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetValue'],
          message: 'Target count is required for COUNT goals',
        });
      } else if (!Number.isInteger(data.targetValue)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetValue'],
          message: 'Target count must be a whole integer',
        });
      } else if (data.targetValue < 1 || data.targetValue > 1000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetValue'],
          message: 'Target count must be between 1 and 1000',
        });
      }
    }
  }
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
  goalProgress: z.number().nonnegative('goalProgress cannot be negative').optional(),
  goalCompleted: z.boolean().optional(),
});

export const HeartbeatSessionSchema = z.object({
  actualDurationMs: z.number().int().nonnegative().optional(),
  pausedDurationMs: z.number().int().nonnegative().optional(),
  isPaused: z.boolean().optional(),
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

    const goalType = body.goalType || 'NONE';
    const goalText = (body.goalText && body.goalText.trim()) ? body.goalText.trim() : null;
    let targetValue = body.targetValue ?? null;
    let targetUnit = (body.targetUnit && body.targetUnit.trim()) ? body.targetUnit.trim() : null;

    if (goalType === 'NONE') {
      targetValue = null;
      targetUnit = null;
    } else if (goalType === 'TIME' && !targetUnit) {
      targetUnit = 'minutes';
    }

    // DATE SOURCE OF TRUTH:
    // The authoritative session creation/start timestamp must come from the actual session start event.
    // Use the real current server timestamp when a session is created.
    // Client-supplied dates (such as a clicked calendar cell, URL parameter, or stale React state)
    // must NEVER override the actual session creation date.
    const now = new Date();
    let sessionStartedAt = now;
    if (body.startedAt) {
      const clientDate = new Date(body.startedAt);
      if (!isNaN(clientDate.getTime())) {
        const diffMs = Math.abs(now.getTime() - clientDate.getTime());
        // Accept client timestamp only if within reasonable clock skew / latency (within 2 hours in the past, or 1 minute in future).
        // Any date outside this window (such as a historical clicked calendar cell date e.g. 2 days ago)
        // is strictly rejected in favor of the authoritative server timestamp.
        if (clientDate <= new Date(now.getTime() + 60000) && diffMs <= 2 * 3600 * 1000) {
          sessionStartedAt = clientDate;
        } else {
          sessionStartedAt = now;
        }
      }
    }

    const session = await dbStore.createSession({
      userId,
      selectedActivity: body.selectedActivity,
      plannedDurationMs: body.plannedDurationMs,
      startedAt: sessionStartedAt,
      goalText,
      goalType,
      targetValue,
      targetUnit,
      goalProgress: 0,
      goalCompleted: false,
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

    const formattedSegments = segments.map((seg, idx) => {
      const type = seg.activityType || seg.type || 'UNKNOWN';
      const start = Number(seg.startTimeMs ?? seg.startTime ?? 0);
      const end = Number(seg.endTimeMs ?? seg.endTime ?? 0);
      const dur = Number(seg.durationMs ?? Math.max(0, end - start));

      return {
        id: seg.id || `seg_${idx}`,
        sessionId: seg.sessionId || id,
        type,
        activityType: type,
        startTime: start,
        startTimeMs: start,
        endTime: end,
        endTimeMs: end,
        durationMs: dur,
        evidenceScore: seg.evidenceScore ?? 0.8,
        confidenceType: seg.confidenceType || 'heuristic',
        contributingSignals: seg.contributingSignals || [],
        explanation: seg.explanation || {},
        createdAt: seg.createdAt || null,
      };
    });

    return reply.send({
      session,
      activitySegments: formattedSegments,
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

// Handler: POST /api/sessions/:id/heartbeat
export async function heartbeatSession(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);
    const body = HeartbeatSessionSchema.parse(request.body || {});

    const updated = await dbStore.recordHeartbeat(id, userId, {
      actualDurationMs: body.actualDurationMs,
      pausedDurationMs: body.pausedDurationMs,
    });

    if (!updated) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    return reply.send({
      success: true,
      sessionId: updated.id,
      status: updated.status,
      isAlive: updated.status === 'ACTIVE',
      lastHeartbeatAt: updated.lastHeartbeatAt,
      actualDurationMs: updated.actualDurationMs,
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
      message: 'Failed to record session heartbeat.',
    });
  }
}

// Handler: PUT /api/sessions/:id
export async function updateSession(request, reply) {
  try {
    const { id } = request.params;
    const userId = resolveUserId(request);
    const body = UpdateSessionSchema.parse(request.body);

    const existing = await dbStore.getSessionByIdAndUser(id, userId);
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Session with ID "${id}" was not found or access is forbidden.`,
      });
    }

    const updates = { ...body };
    if ((updates.status === 'COMPLETED' || updates.status === 'CANCELLED') && !updates.endedAt) {
      updates.endedAt = new Date().toISOString();
    }
    const segments = await dbStore.getSegmentsBySessionId(id);

    // Goal Progress Logic
    if (existing.goalType === 'TIME') {
      let qualifyingSec = 0;
      segments.forEach(seg => {
        const type = (seg.activityType || '').toUpperCase();
        if (type === 'STUDY_LIKE' || type === 'CODING' || type === 'DOCUMENT_ACTIVITY') {
          qualifyingSec += Math.max(0, Math.round((seg.durationMs || 0) / 1000));
        }
      });
      const qualifyingMins = Math.floor(qualifyingSec / 60);
      const progressPercent = existing.targetValue ? Math.min(100, Math.round((qualifyingMins / existing.targetValue) * 100)) : 0;
      updates.goalProgress = progressPercent;
      updates.goalCompleted = existing.targetValue ? qualifyingMins >= existing.targetValue : false;
    } else if (existing.goalType === 'COUNT') {
      if (body.goalProgress !== undefined) {
        const rawProgress = Math.max(0, body.goalProgress);
        const progress = existing.targetValue ? Math.min(existing.targetValue, rawProgress) : rawProgress;
        updates.goalProgress = progress;
        updates.goalCompleted = existing.targetValue ? progress >= existing.targetValue : false;
      } else if (body.goalCompleted !== undefined) {
        updates.goalCompleted = body.goalCompleted;
      }
    }

    const updated = await dbStore.updateSession(id, userId, updates);

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

// Handler: GET /api/analytics/focus-coach
export async function getFocusCoachAnalytics(request, reply) {
  try {
    const userId = resolveUserId(request);
    const sessionsList = await dbStore.getSessionsByUserId(userId, { limit: 2000 });

    const sessionSegmentMap = new Map();
    for (const s of sessionsList) {
      const segments = await dbStore.getSegmentsBySessionId(s.id);
      sessionSegmentMap.set(s.id, segments);
    }

    const analysis = generateFocusCoachAnalysis(sessionsList, sessionSegmentMap);

    if (analysis.insufficientData) {
      return reply.send({
        insufficientData: true,
        generatedFromSessions: analysis.generatedFromSessions,
        minimumRequired: 3,
        message: analysis.message,
      });
    }

    return reply.send({
      insufficientData: false,
      observation: analysis.primary.observation,
      recommendation: analysis.primary.recommendation,
      reason: analysis.primary.reason,
      category: analysis.primary.category,
      strength: analysis.primary.confidence,
      secondary: analysis.secondary,
      suggestedSession: analysis.suggestedSession,
      generatedFromSessions: analysis.generatedFromSessions,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to compute Focus Coach analytics.',
    });
  }
}

// Handler: GET /api/analytics/consistency
export async function getConsistencyAnalytics(request, reply) {
  try {
    const userId = resolveUserId(request);
    const offsetHeader = request.headers['x-timezone-offset'];
    const offsetMinutes = offsetHeader ? parseInt(offsetHeader, 10) : 0;
    const sessionsList = await dbStore.getSessionsByUserId(userId, { limit: 2000 });

    const sessionSegmentMap = new Map();
    for (const s of sessionsList) {
      const segments = await dbStore.getSegmentsBySessionId(s.id);
      sessionSegmentMap.set(s.id, segments);
    }

    const consistencyData = generateConsistencyAnalysis(sessionsList, sessionSegmentMap, {
      timezoneOffsetMinutes: isNaN(offsetMinutes) ? 0 : offsetMinutes,
    });

    return reply.send(consistencyData);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to compute Consistency analytics.',
    });
  }
}

// Handler: GET /api/analytics/recommended-session
export async function getRecommendedSession(request, reply) {
  try {
    const userId = resolveUserId(request);
    const recommendationResult = await generateAdaptiveSessionRecommendation(userId);
    return reply.send(recommendationResult);
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Database Error',
      message: 'Failed to compute Adaptive Session Recommendation.',
    });
  }
}

