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

  // Queue locally for retry and attach to local session record
  const localList = getLocalSessions();
  const updatedLocal = localList.map(s => {
    if (s.id === sessionId || s.backendId === sessionId) {
      return {
        ...s,
        activitySegments: sanitizedSegments,
        synced: false,
      };
    }
    return s;
  });
  saveLocalSessions(updatedLocal);

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
 * API: Send periodic heartbeat to backend to maintain session liveness
 */
export async function sendSessionHeartbeat(sessionId, { actualDurationMs, pausedDurationMs, isPaused } = {}) {
  if (!sessionId) return { isAlive: false };

  if (!sessionId.startsWith('local_')) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({ actualDurationMs, pausedDurationMs, isPaused }),
      });
      return {
        success: res.success ?? true,
        status: res.status,
        isAlive: res.isAlive ?? (res.status === 'ACTIVE'),
      };
    } catch (err) {
      // Backend heartbeat failure - non-blocking
    }
  }

  // Local fallback: touch lastHeartbeatAt
  try {
    const localList = getLocalSessions();
    const updated = localList.map(s => {
      if (s.id === sessionId || s.backendId === sessionId) {
        return {
          ...s,
          lastHeartbeatAt: new Date().toISOString(),
          actualDurationMs: actualDurationMs ?? s.actualDurationMs,
          pausedDurationMs: pausedDurationMs ?? s.pausedDurationMs,
        };
      }
      return s;
    });
    saveLocalSessions(updated);
  } catch (e) {}

  return { success: true, isAlive: true };
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
  const now = Date.now();
  const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
  const GRACE_PERIOD_MS = 5 * 60 * 1000;
  let localNeedsSave = false;

  const reconciledLocal = localSessions.map(s => {
    if (s.status === 'ACTIVE') {
      const startedMs = new Date(s.startedAt || s.createdAt).getTime();
      const plannedMs = Number(s.plannedDurationMs) || (25 * 60 * 1000);
      const lastPingMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startedMs;
      const isExpired = (now - startedMs) > (plannedMs + GRACE_PERIOD_MS);
      const isHeartbeatDead = (now - lastPingMs) > HEARTBEAT_TIMEOUT_MS;

      if (s.endedAt || isExpired || isHeartbeatDead) {
        localNeedsSave = true;
        const dur = Number(s.actualDurationMs) > 0 ? Number(s.actualDurationMs) : Math.max(1000, lastPingMs - startedMs);
        return {
          ...s,
          status: 'COMPLETED',
          actualDurationMs: dur,
          endedAt: s.endedAt || new Date(startedMs + dur).toISOString(),
        };
      }
    }
    return s;
  });

  if (localNeedsSave) {
    saveLocalSessions(reconciledLocal);
  }

  const sessionMap = new Map();
  
  if (isBackendAvailable) {
    // Only include local sessions that are genuinely unsynced offline creations
    reconciledLocal.filter(s => s.id?.startsWith('local_') && !s.synced).forEach(s => {
      sessionMap.set(s.id, { ...s, isLocal: true });
    });
    // Add server-verified authenticated user sessions
    backendSessions.forEach(s => sessionMap.set(s.id, { ...s, isLocal: false }));
  } else {
    // Offline mode fallback
    reconciledLocal.forEach(s => sessionMap.set(s.id, { ...s, isLocal: true }));
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

/**
 * API: Fetch adaptive session recommendation for authenticated user
 */
export async function fetchRecommendedSession() {
  return await apiFetch('/api/analytics/recommended-session');
}

/**
 * API: Fetch complete session details by ID (including persisted activity segments and analytics).
 * If offline or local session ID, retrieves from local sessions cache.
 */
export async function fetchSessionById(sessionId) {
  if (!sessionId) return null;

  // 1. Try backend fetch first if not an unsynced local ID
  if (!sessionId.startsWith('local_')) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}`);
      if (res && res.session) {
        const rawSegments = res.activitySegments || [];
        const normalizedSegments = rawSegments.map((seg, idx) => {
          const type = seg.type || seg.activityType || 'UNKNOWN';
          const start = Number(seg.startTime ?? seg.startTimeMs ?? 0);
          const end = Number(seg.endTime ?? seg.endTimeMs ?? (start + Number(seg.durationMs || 0)));
          const dur = Number(seg.durationMs ?? Math.max(0, end - start));
          return {
            ...seg,
            id: seg.id || `seg_${idx}`,
            type,
            activityType: type,
            startTime: start,
            startTimeMs: start,
            endTime: Math.max(start, end),
            endTimeMs: Math.max(start, end),
            durationMs: dur,
          };
        });

        return {
          session: res.session,
          activitySegments: normalizedSegments,
          statistics: res.statistics,
          isOfflineFallback: false,
        };
      }
    } catch (err) {
      console.warn(`[Session API] Failed to fetch session "${sessionId}" from backend:`, err.message);
    }
  }

  // 2. Local fallback if offline or local_ session
  const localList = getLocalSessions();
  const found = localList.find(s => s.id === sessionId || s.backendId === sessionId);
  if (found) {
    const rawSegments = found.activitySegments || [];
    const normalizedSegments = rawSegments.map((seg, idx) => {
      const type = seg.type || seg.activityType || 'UNKNOWN';
      const start = Number(seg.startTime ?? seg.startTimeMs ?? 0);
      const end = Number(seg.endTime ?? seg.endTimeMs ?? (start + Number(seg.durationMs || 0)));
      const dur = Number(seg.durationMs ?? Math.max(0, end - start));
      return {
        ...seg,
        id: seg.id || `seg_${idx}`,
        type,
        activityType: type,
        startTime: start,
        startTimeMs: start,
        endTime: Math.max(start, end),
        endTimeMs: Math.max(start, end),
        durationMs: dur,
      };
    });

    return {
      session: found,
      activitySegments: normalizedSegments,
      statistics: null,
      isOfflineFallback: true,
    };
  }

  return null;
}

/**
 * API: Fetch calendar month breakdown and daily session records
 * @param {string} [targetMonthStr] - 'YYYY-MM' (defaults to current month)
 */
export async function fetchCalendarMonth(targetMonthStr) {
  const query = targetMonthStr ? `?month=${encodeURIComponent(targetMonthStr)}` : '';
  const offsetMinutes = new Date().getTimezoneOffset();

  try {
    const res = await apiFetch(`/api/calendar${query}`, {
      headers: {
        'x-timezone-offset': String(offsetMinutes),
      },
    });
    return res;
  } catch (err) {
    console.warn('[Session API] Failed to fetch calendar from backend:', err.message);
    throw err;
  }
}

