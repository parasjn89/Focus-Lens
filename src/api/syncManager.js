import {
  getPendingSyncQueue,
  clearPendingSyncQueue,
  getLocalSessions,
  saveLocalSessions,
} from './sessionApi.js';
import { apiFetch, getAnonymousUserId } from './client.js';

let isSyncing = false;

/**
 * Background retry manager that synchronizes pending local sessions & segments to the backend API
 */
export async function syncPendingSessions() {
  if (isSyncing) return { status: 'already_running' };
  isSyncing = true;

  const queue = getPendingSyncQueue();
  const localSessions = getLocalSessions();
  const unsyncedSessions = localSessions.filter(s => !s.synced && s.id.startsWith('local_'));

  if (queue.length === 0 && unsyncedSessions.length === 0) {
    isSyncing = false;
    return { status: 'idle', syncedCount: 0 };
  }

  let syncedCount = 0;
  const processedQueueIds = [];
  const anonymousId = getAnonymousUserId();

  try {
    // Check authenticated user context
    let currentUser = null;
    try {
      const meRes = await apiFetch('/api/auth/me');
      if (meRes && meRes.user) {
        currentUser = meRes.user;
      }
    } catch (e) {
      // Unauthenticated
    }

    // Do not auto-upload local sessions to server if unauthenticated
    if (!currentUser) {
      isSyncing = false;
      return { status: 'unauthenticated', syncedCount: 0 };
    }

    // 1. Sync offline created sessions first
    for (const session of unsyncedSessions) {
      // Security check: Never upload local session to server if owned by a different user
      if (session.userId && session.userId !== currentUser.id) {
        console.warn(`[Sync Manager] Skipping local session belonging to different user ID "${session.userId}"`);
        continue;
      }

      try {
        const createRes = await apiFetch('/api/sessions', {
          method: 'POST',
          body: JSON.stringify({
            plannedDurationMs: session.plannedDurationMs,
            selectedActivity: session.selectedActivity,
            startedAt: session.startedAt,
            anonymousId,
          }),
        });

        if (createRes.session && createRes.session.id) {
          const newBackendId = createRes.session.id;

          // If session was completed, update backend
          if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
            await apiFetch(`/api/sessions/${newBackendId}`, {
              method: 'PUT',
              body: JSON.stringify({
                actualDurationMs: session.actualDurationMs || 0,
                pausedDurationMs: session.pausedDurationMs || 0,
                endedAt: session.endedAt || new Date().toISOString(),
                status: session.status,
              }),
            });
          }

          // Replace old local_ session ID in pending segment queue
          queue.forEach(qItem => {
            if (qItem.sessionId === session.id) {
              qItem.sessionId = newBackendId;
            }
          });

          // Mark local session as synced
          session.synced = true;
          session.backendId = newBackendId;
          syncedCount++;
        }
      } catch (err) {
        console.warn(`[Sync Manager] Could not sync local session "${session.id}":`, err.message);
      }
    }

    // Update local sessions state
    saveLocalSessions(localSessions.filter(s => !s.synced));

    // 2. Sync queued segments and finalization calls
    for (const qItem of queue) {
      try {
        if (qItem.type === 'SAVE_SEGMENTS' && qItem.sessionId && !qItem.sessionId.startsWith('local_')) {
          await apiFetch(`/api/sessions/${qItem.sessionId}/segments`, {
            method: 'POST',
            body: JSON.stringify({ segments: qItem.segments }),
          });
          processedQueueIds.push(qItem.id);
          syncedCount++;
        } else if (qItem.type === 'FINALIZE_SESSION' && qItem.sessionId && !qItem.sessionId.startsWith('local_')) {
          await apiFetch(`/api/sessions/${qItem.sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(qItem.payload),
          });
          processedQueueIds.push(qItem.id);
          syncedCount++;
        }
      } catch (err) {
        console.warn(`[Sync Manager] Retry sync item failed for session "${qItem.sessionId}":`, err.message);
      }
    }

    // Clear successfully processed queue items
    clearPendingSyncQueue(processedQueueIds);

  } finally {
    isSyncing = false;
  }

  return {
    status: 'completed',
    syncedCount,
    remainingPending: getPendingSyncQueue().length,
  };
}

/**
 * Hook initializer to auto-retry background sync on browser network status change or app start
 */
export function initBackgroundSync() {
  if (typeof window === 'undefined') return;

  // Run initial sync on load
  syncPendingSessions().catch(() => {});

  // Run sync when browser regains connectivity
  window.addEventListener('online', () => {
    console.log('[Sync Manager] Network connection restored. Retrying background sync...');
    syncPendingSessions().catch(() => {});
  });
}
