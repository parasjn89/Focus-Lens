import { z } from 'zod';
import { dbStore } from '../db/store.js';

export function toSafeSettings(settings) {
  if (!settings) return null;
  return {
    defaultDuration: settings.defaultDuration ?? 25,
    autoResumePause: settings.autoResumePause ?? true,
    confirmBeforePause: settings.confirmBeforePause ?? true,
    confirmBeforeEnd: settings.confirmBeforeEnd ?? false,
    defaultCamera: settings.defaultCamera ?? true,
    defaultScreen: settings.defaultScreen ?? true,
    defaultCategory: settings.defaultCategory || 'ALL',
    showFocusScore: settings.showFocusScore ?? true,
    showFocusPoints: settings.showFocusPoints ?? true,
    showFocusStreak: settings.showFocusStreak ?? true,
    autoResumeWarning: settings.autoResumeWarning ?? true,
    theme: settings.theme || 'dark',
    updatedAt: settings.updatedAt || null,
  };
}

export const UpdateSettingsSchema = z.object({
  defaultDuration: z.number().int().min(1).max(1440).optional(),
  autoResumePause: z.boolean().optional(),
  confirmBeforePause: z.boolean().optional(),
  confirmBeforeEnd: z.boolean().optional(),
  defaultCamera: z.boolean().optional(),
  defaultScreen: z.boolean().optional(),
  defaultCategory: z.string().min(1).max(50).trim().optional(),
  showFocusScore: z.boolean().optional(),
  showFocusPoints: z.boolean().optional(),
  showFocusStreak: z.boolean().optional(),
  autoResumeWarning: z.boolean().optional(),
  theme: z.enum(['dark', 'navy', 'slate']).optional(),
}).strict();

export async function getSettings(request, reply) {
  const userId = request.user?.id || request.session?.userId;
  if (!userId) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const settings = await dbStore.getUserSettings(userId);
    return reply.send({
      settings: toSafeSettings(settings),
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to retrieve user settings.',
    });
  }
}

export async function updateSettings(request, reply) {
  const userId = request.user?.id || request.session?.userId;
  if (!userId) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const parsed = UpdateSettingsSchema.parse(request.body);
    const updated = await dbStore.updateUserSettings(userId, parsed);
    return reply.send({
      success: true,
      settings: toSafeSettings(updated),
      message: 'Settings updated successfully.',
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
      error: 'Internal Server Error',
      message: 'Failed to update user settings.',
    });
  }
}

export async function resetSettings(request, reply) {
  const userId = request.user?.id || request.session?.userId;
  if (!userId) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const reset = await dbStore.resetUserSettings(userId);
    return reply.send({
      success: true,
      settings: toSafeSettings(reset),
      message: 'Settings reset to defaults successfully.',
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to reset user settings.',
    });
  }
}
