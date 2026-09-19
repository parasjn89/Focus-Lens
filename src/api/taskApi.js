import { apiFetch } from './client.js';

const LOCAL_TASKS_KEY = 'focuslens_local_tasks';

export function getLocalTasks() {
  try {
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function saveLocalTasks(tasks) {
  try {
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to localStorage:', err);
  }
}

/**
 * Fetch tasks for authenticated user with optional category and search filters
 */
export async function fetchTasks({ category, search } = {}) {
  const params = new URLSearchParams();
  if (category && category !== 'All Work' && category !== 'ALL') {
    params.append('category', category);
  }
  if (search && search.trim()) {
    params.append('search', search.trim());
  }

  const queryStr = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await apiFetch(`/api/tasks${queryStr}`);
    if (res && Array.isArray(res.tasks)) {
      saveLocalTasks(res.tasks);
      return { tasks: res.tasks, isOfflineFallback: false };
    }
  } catch (err) {
    console.warn('[Task API] Backend fetchTasks unavailable, fallback to local storage:', err.message);
  }

  // Local offline fallback
  let localTasks = getLocalTasks();
  if (category && category !== 'All Work' && category !== 'ALL') {
    localTasks = localTasks.filter(t => t.category === category);
  }
  if (search && search.trim()) {
    const term = search.toLowerCase().trim();
    localTasks = localTasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(term)) ||
      (t.description && t.description.toLowerCase().includes(term))
    );
  }

  return { tasks: localTasks, isOfflineFallback: true };
}

/**
 * Create a new task
 */
export async function createTask({ title, description = '', category = 'Other', dueDate = null }) {
  const payload = {
    title: title.trim(),
    description: description ? description.trim() : null,
    category: category || 'Other',
    completed: false,
    dueDate: dueDate || null,
  };

  try {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res && res.task) {
      const local = getLocalTasks();
      saveLocalTasks([res.task, ...local]);
      return { task: res.task, isOfflineFallback: false };
    }
  } catch (err) {
    console.warn('[Task API] Backend createTask unavailable, fallback to local storage:', err.message);
  }

  // Offline fallback
  const fallbackTask = {
    id: `local_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const local = getLocalTasks();
  saveLocalTasks([fallbackTask, ...local]);
  return { task: fallbackTask, isOfflineFallback: true };
}

/**
 * Update an existing task (e.g. toggle complete, edit title/description/category)
 */
export async function updateTask(id, updates = {}) {
  try {
    const res = await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (res && res.task) {
      const local = getLocalTasks();
      const updated = local.map(t => t.id === id ? res.task : t);
      saveLocalTasks(updated);
      return { task: res.task, isOfflineFallback: false };
    }
  } catch (err) {
    console.warn('[Task API] Backend updateTask unavailable, fallback to local storage:', err.message);
  }

  // Local fallback
  const local = getLocalTasks();
  let updatedTask = null;
  const updated = local.map(t => {
    if (t.id === id) {
      updatedTask = { ...t, ...updates, updatedAt: new Date().toISOString() };
      return updatedTask;
    }
    return t;
  });
  saveLocalTasks(updated);
  return { task: updatedTask, isOfflineFallback: true };
}

/**
 * Delete a task
 */
export async function deleteTask(id) {
  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[Task API] Backend deleteTask unavailable, fallback to local storage:', err.message);
  }

  const local = getLocalTasks();
  saveLocalTasks(local.filter(t => t.id !== id));
  return { success: true };
}
