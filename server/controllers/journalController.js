import { z } from 'zod';
import { dbStore } from '../db/store.js';
import { calculateSessionAnalytics } from '../utils/analytics.js';

function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  const err = new Error('Unauthorized');
  err.statusCode = 401;
  throw err;
}

const journalPatchSchema = z.object({
  intention: z.string().max(300, 'Intention must not exceed 300 characters').nullable().optional(),
  workedWell: z.string().max(500, 'workedWell must not exceed 500 characters').nullable().optional(),
  gotInTheWay: z.string().max(500, 'gotInTheWay must not exceed 500 characters').nullable().optional(),
  notes: z.string().max(1000, 'notes must not exceed 1000 characters').nullable().optional(),
});

export async function updateSessionJournal(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { sessionId } = request.params;

    if (!sessionId) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'sessionId parameter required' });
    }

    const session = await dbStore.getSessionByIdAndUser(sessionId, userId);
    if (!session) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Session not found or unauthorized',
      });
    }

    const parseResult = journalPatchSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: parseResult.error.errors.map(e => e.message).join(', '),
      });
    }

    const { intention, workedWell, gotInTheWay, notes } = parseResult.data;

    const normalize = (val) => (val && val.trim() !== '' ? val.trim() : null);

    const updates = {};
    if (intention !== undefined) updates.intention = normalize(intention);
    if (workedWell !== undefined) updates.workedWell = normalize(workedWell);
    if (gotInTheWay !== undefined) updates.gotInTheWay = normalize(gotInTheWay);
    if (notes !== undefined) updates.notes = normalize(notes);

    const updatedSession = await dbStore.updateSessionJournal(sessionId, userId, updates);

    return reply.send({
      success: true,
      session: {
        id: updatedSession.id,
        intention: updatedSession.intention,
        workedWell: updatedSession.workedWell,
        gotInTheWay: updatedSession.gotInTheWay,
        notes: updatedSession.notes,
        updatedAt: updatedSession.updatedAt,
      },
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to update session journal.',
    });
  }
}

export async function getJournalEntries(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { page = 1, limit = 20, filter = 'all' } = request.query || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const result = await dbStore.getJournalSessions(userId, { limit: limitNum, offset, filter });

    const formattedEntries = [];
    for (const s of result.sessions) {
      const segs = await dbStore.getSegmentsBySessionId(s.id);
      const stats = calculateSessionAnalytics(s, segs);

      const actualSec = Math.round((s.actualDurationMs || s.plannedDurationMs || 0) / 1000);
      const longestBlockSec = stats.deepWork?.longestBlockSec || 0;

      // Reflection preview
      let reflectionPreview = null;
      if (s.workedWell) reflectionPreview = s.workedWell;
      else if (s.notes) reflectionPreview = s.notes;
      else if (s.gotInTheWay) reflectionPreview = s.gotInTheWay;

      formattedEntries.push({
        id: s.id,
        startedAt: s.startedAt,
        selectedActivity: s.selectedActivity,
        durationSeconds: actualSec,
        status: s.status,
        focusPoints: stats.focusPoints,
        qualifyingSeconds: stats.qualifyingSeconds,
        longestDeepWorkSec: longestBlockSec,
        goalText: s.goalText,
        goalType: s.goalType,
        goalCompleted: Boolean(s.goalCompleted),
        goalProgress: s.goalProgress,
        intention: s.intention,
        workedWell: s.workedWell,
        gotInTheWay: s.gotInTheWay,
        notes: s.notes,
        reflectionPreview,
      });
    }

    return reply.send({
      entries: formattedEntries,
      pagination: {
        totalCount: result.totalCount,
        page: result.page,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
        limit: limitNum,
      },
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to fetch Focus Journal entries.',
    });
  }
}
