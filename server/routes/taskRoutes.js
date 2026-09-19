import {
  listTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
} from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';

export async function taskRoutes(fastify, options) {
  fastify.get('/api/tasks', { preHandler: requireAuth }, listTasks);
  fastify.post('/api/tasks', { preHandler: requireAuth }, createTask);
  fastify.get('/api/tasks/:id', { preHandler: requireAuth }, getTaskById);
  fastify.put('/api/tasks/:id', { preHandler: requireAuth }, updateTask);
  fastify.delete('/api/tasks/:id', { preHandler: requireAuth }, deleteTask);
}
