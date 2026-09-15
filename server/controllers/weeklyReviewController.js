import { z } from 'zod';
import { generateWeeklyReviewAnalysis } from '../utils/weeklyReviewEngine.js';
import { dbStore } from '../db/store.js';

function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  const err = new Error('Unauthorized');
  err.statusCode = 401;
  throw err;
}

const notesSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid weekStartDate format (YYYY-MM-DD)'),
  workedWell: z.string().max(500, 'workedWell must not exceed 500 characters').nullable().optional(),
  madeItHard: z.string().max(500, 'madeItHard must not exceed 500 characters').nullable().optional(),
});

export async function getWeeklyReview(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { week } = request.query || {};

    if (week && !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid week parameter. Must be YYYY-MM-DD',
      });
    }

    const offsetHeader = request.headers['x-timezone-offset'];
    const offsetMinutes = offsetHeader ? parseInt(offsetHeader, 10) : 0;

    const reviewData = await generateWeeklyReviewAnalysis(userId, week || null, {
      timezoneOffsetMinutes: isNaN(offsetMinutes) ? 0 : offsetMinutes,
    });

    return reply.send(reviewData);
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
    }
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to generate Weekly Review.',
    });
  }
}

export async function saveWeeklyReviewNotes(request, reply) {
  try {
    const userId = resolveUserId(request);
    const parseResult = notesSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: parseResult.error.errors.map(e => e.message).join(', '),
      });
    }

    const { weekStartDate, workedWell, madeItHard } = parseResult.data;

    const trimmedWorkedWell = workedWell ? workedWell.trim() : null;
    const trimmedMadeItHard = madeItHard ? madeItHard.trim() : null;

    const noteRecord = await dbStore.upsertWeeklyReviewNote(userId, weekStartDate, {
      workedWell: trimmedWorkedWell,
      madeItHard: trimmedMadeItHard,
    });

    return reply.send({
      success: true,
      notes: {
        weekStartDate: noteRecord.weekStartDate,
        workedWell: noteRecord.workedWell || '',
        madeItHard: noteRecord.madeItHard || '',
        updatedAt: noteRecord.updatedAt,
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
      message: 'Failed to save Weekly Review notes.',
    });
  }
}
