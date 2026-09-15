import { apiFetch, getAnonymousUserId } from './client.js';

const LOCAL_SESSIONS_KEY = 'focuslens_local_sessions';
const PENDING_SYNC_KEY = 'focuslens_pending_sync';

/**
 * Helper to retrieve local sessions stored in browser storage
 */
export function getLocalSessions() {
  try {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Helper to save local sessions array to browser storage
 */
export function saveLocalSessions(sessions) {
  try {
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save session to localStorage:', err);
  }
}

/**
 * Helper to retrieve pending items queued for retry sync
 */
export function getPendingSyncQueue() {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

/**
 * Queue item for background sync retry
 */
export function enqueuePendingSync(item) {
  const queue = getPendingSyncQueue();
  queue.push({
    id: item.id || `pending_${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...item,
  });
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
}

/**
 * Remove queued items after successful retry sync
 */
export function clearPendingSyncQueue(idsToRemove = []) {
  if (!idsToRemove || idsToRemove.length === 0) return;
  const queue = getPendingSyncQueue();
  const filtered = queue.filter(item => !idsToRemove.includes(item.id));
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
}

/**
 * API: Start a new Focus Session with backend or local fallback
 */
export async function startSession({ plannedDurationMs, selectedActivity, goalText = null, goalType = 'NONE', targetValue = null, targetUnit = null }) {
  const anonymousId = getAnonymousUserId();

  try {
    const res = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        plannedDurationMs,
        selectedActivity,
        startedAt: new Date().toISOString(),
        anonymousId,
        goalText,
        goalType,
        targetValue,
        targetUnit,
      }),
    });

    if (res.session && res.session.id) {
      return {
        session: res.session,
        isOfflineFallback: false,
      };
    }
  } catch (err) {
    console.warn('[Session API] Backend startSession unavailable, switching to local offline persistence:', err.message);
  }

  // Local Offline Fallback
  const fallbackSession = {
    id: `local_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    selectedActivity,
    plannedDurationMs,
    actualDurationMs: 0,
    pausedDurationMs: 0,
    status: 'ACTIVE',
    goalText,
    goalType,
    targetValue,
    targetUnit,
    goalProgress: 0,
    goalCompleted: false,
    startedAt: new Date().toISOString(),
    synced: false,
    anonymousId,
  };

  const localList = getLocalSessions();
  saveLocalSessions([fallbackSession, ...localList]);

  return {
    session: fallbackSession,
    isOfflineFallback: true,
  };
}

/**
 * API: Save derived activity segments to backend or local sync queue
 */
export async function saveSessionSegments(sessionId, segments = []) {
  if (!segments || segments.length === 0) return { savedCount: 0 };

  // Sanitize segments to ensure NO raw media fields are sent
  const sanitizedSegments = segments.map(seg => ({
    activityType: seg.type || seg.activityType || 'UNKNOWN',
    startTimeMs: seg.startTime || seg.startTimeMs || 0,
    endTimeMs: seg.endTime || seg.endTimeMs || 0,
    durationMs: seg.durationMs || ((seg.endTime || 0) - (seg.startTime || 0)),
    evidenceScore: seg.evidenceScore ?? 0.8,
    confidenceType: seg.confidenceType || 'heuristic',
    contributingSignals: seg.contributingSignals || [],
    explanation: seg.explanation || {},
  }));

  if (!sessionId.startsWith('local_')) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/segments`, {
        method: 'POST',
        body: JSON.stringify({ segments: sanitizedSegments }),
      });
      return { savedCount: res.savedCount, isOfflineFallback: false };
    } catch (err) {
      console.warn('[Session API] Failed to upload segments to backend, queuing locally for retry:', err.message);
    }
  }

  // Queue locally for retry
  enqueuePendingSync({
    type: 'SAVE_SEGMENTS',
    sessionId,
    segments: sanitizedSegments,
  });

  return { savedCount: sanitizedSegments.length, isOfflineFallback: true };
}

/**
 * API: Update session parameters e.g. goal progress
 */
export async function updateSession(sessionId, updates = {}) {
  if (!sessionId.startsWith('local_')) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      return {
        session: res.session,
        statistics: res.statistics,
        isOfflineFallback: false,
      };
    } catch (err) {
      console.warn('[Session API] Failed to update session on backend, fallback to local update:', err.message);
    }
  }

  const localList = getLocalSessions();
  let updatedSession = null;

  const updatedList = localList.map(s => {
    if (s.id === sessionId) {
      updatedSession = { ...s, ...updates, synced: false };
      return updatedSession;
    }
    return s;
  });

  saveLocalSessions(updatedList);
  return { session: updatedSession, isOfflineFallback: true };
}

/**
 * API: Finalize a session (update actual duration, paused duration, status, goal progress)
 */
export async function finalizeSession(sessionId, { actualDurationMs, pausedDurationMs, status = 'COMPLETED', goalProgress, goalCompleted }) {
  const payload = {
    actualDurationMs,
    pausedDurationMs,
    endedAt: new Date().toISOString(),
    status,
  };

  if (goalProgress !== undefined) payload.goalProgress = goalProgress;
  if (goalCompleted !== undefined) payload.goalCompleted = goalCompleted;

  if (!sessionId.startsWith('local_')) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      return {
        session: res.session,
        statistics: res.statistics,
        isOfflineFallback: false,
      };
    } catch (err) {
      console.warn('[Session API] Failed to finalize session on backend, queuing update locally:', err.message);
    }
  }

  // Local fallback update
  const localList = getLocalSessions();
  let updatedSession = null;

  const updatedList = localList.map(s => {
    if (s.id === sessionId) {
      updatedSession = {
        ...s,
        ...payload,
        synced: false,
      };
      return updatedSession;
    }
    return s;
  });

  if (!updatedSession) {
    updatedSession = {
      id: sessionId,
      ...payload,
      synced: false,
    };
    updatedList.unshift(updatedSession);
  }

  saveLocalSessions(updatedList);

  enqueuePendingSync({
    type: 'FINALIZE_SESSION',
    sessionId,
    payload,
  });

  return {
    session: updatedSession,
    isOfflineFallback: true,
  };
}

/**
 * API: Fetch session history list (merging backend sessions and unsynced local sessions)
 */
export async function fetchSessionsHistory({ limit = 20, offset = 0 } = {}) {
  let backendSessions = [];
  let isBackendAvailable = true;

  try {
    const res = await apiFetch(`/api/sessions?limit=${limit}&offset=${offset}`);
    backendSessions = res.sessions || [];
  } catch (err) {
    isBackendAvailable = false;
  }

  const localSessions = getLocalSessions();
  const sessionMap = new Map();
  
  if (isBackendAvailable) {
    // Only include local sessions that are genuinely unsynced offline creations
    localSessions.filter(s => s.id?.startsWith('local_') && !s.synced).forEach(s => {
      sessionMap.set(s.id, { ...s, isLocal: true });
    });
    // Add server-verified authenticated user sessions
    backendSessions.forEach(s => sessionMap.set(s.id, { ...s, isLocal: false }));
  } else {
    // Offline mode fallback
    localSessions.forEach(s => sessionMap.set(s.id, { ...s, isLocal: true }));
  }

  const mergedSessions = Array.from(sessionMap.values()).sort(
    (a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt)
  );

  return {
    sessions: mergedSessions,
    isBackendAvailable,
    totalCount: mergedSessions.length,
  };
}
