import { z } from 'zod';
import { dbStore } from '../db/store.js';

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200, 'Task title cannot exceed 200 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').nullable().optional(),
  category: z.enum(['Study', 'Coding', 'Other']).optional().default('Other'),
  completed: z.boolean().optional().default(false),
  dueDate: z.string().nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty').max(200, 'Task title cannot exceed 200 characters').optional(),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').nullable().optional(),
  category: z.enum(['Study', 'Coding', 'Other']).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
});

function resolveUserId(request) {
  if (request.user && request.user.id) {
    return request.user.id;
  }
  const err = new Error('Authentication required. Please log in.');
  err.statusCode = 401;
  throw err;
}

// GET /api/tasks
export async function listTasks(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { category, search } = request.query || {};

    const tasks = await dbStore.getTasksByUserId(userId, { category, search });

    return reply.send({
      tasks,
      count: tasks.length,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: err.message });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ statusCode: 500, error: 'Database Error', message: 'Failed to retrieve tasks.' });
  }
}

// POST /api/tasks
export async function createTask(request, reply) {
  try {
    const userId = resolveUserId(request);
    const body = CreateTaskSchema.parse(request.body);

    const task = await dbStore.createTask({
      userId,
      title: body.title,
      description: body.description,
      category: body.category,
      completed: body.completed,
      dueDate: body.dueDate,
    });

    return reply.status(201).send({
      task,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: err.message });
    }
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ statusCode: 500, error: 'Database Error', message: 'Failed to create task.' });
  }
}

// GET /api/tasks/:id
export async function getTaskById(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { id } = request.params;

    const task = await dbStore.getTaskByIdAndUser(id, userId);
    if (!task) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Task with ID "${id}" was not found or access is forbidden.`,
      });
    }

    return reply.send({
      task,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: err.message });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ statusCode: 500, error: 'Database Error', message: 'Failed to retrieve task.' });
  }
}

// PUT /api/tasks/:id
export async function updateTask(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { id } = request.params;
    const body = UpdateTaskSchema.parse(request.body);

    const existing = await dbStore.getTaskByIdAndUser(id, userId);
    if (!existing) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Task with ID "${id}" was not found or access is forbidden.`,
      });
    }

    const updated = await dbStore.updateTask(id, userId, body);

    return reply.send({
      task: updated,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: err.message });
    }
    if (err instanceof z.ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
      });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ statusCode: 500, error: 'Database Error', message: 'Failed to update task.' });
  }
}

// DELETE /api/tasks/:id
export async function deleteTask(request, reply) {
  try {
    const userId = resolveUserId(request);
    const { id } = request.params;

    const deleted = await dbStore.deleteTask(id, userId);
    if (!deleted) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Task with ID "${id}" was not found or access is forbidden.`,
      });
    }

    return reply.send({
      success: true,
      message: `Task "${id}" deleted successfully.`,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: err.message });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ statusCode: 500, error: 'Database Error', message: 'Failed to delete task.' });
  }
}
