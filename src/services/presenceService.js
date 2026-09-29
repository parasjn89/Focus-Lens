import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';
import { realtimeMessages } from './realtimeMessages.js';

class PresenceService {
  constructor() {
    // userId -> { userId, status: 'FOCUSING'|'PAUSED'|'IDLE', startedAt, endsAt, updatedAt }
    this.presenceMap = new Map();
    this.subscribers = new Set();
    this.realtimeUnsubscribe = null;
    this.lastFetchedAt = 0;
    this.isFetching = false;

    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    // Hook into the shared realtime SSE client
    this.realtimeUnsubscribe = realtimeMessages.subscribe({
      onPresenceUpdate: (payload) => {
        this.handlePresenceEvent(payload);
      },
      onStatusChange: (status) => {
        if (status === 'connected' || status === 'reconcile') {
          this.reconcile();
        }
      },
    });

    // Reconcile when tab becomes visible
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.reconcile();
        }
      });
    }
  }

  notifySubscribers() {
    for (const sub of this.subscribers) {
      try {
        sub(this.getAllPresence());
      } catch (err) {
        console.error('[PresenceService] Error in subscriber callback:', err);
      }
    }
  }

  handlePresenceEvent(payload) {
    if (!payload || !payload.userId) return;

    const { userId, status, startedAt, endsAt } = payload;
    const current = this.presenceMap.get(userId);

    // Normalize status
    const normalizedStatus = ['FOCUSING', 'PAUSED'].includes(status) ? status : 'IDLE';

    const updated = {
      userId,
      status: normalizedStatus,
      startedAt: startedAt || null,
      endsAt: endsAt || null,
      updatedAt: Date.now(),
    };

    // Update in-memory map
    this.presenceMap.set(userId, updated);
    this.notifySubscribers();
  }

  async reconcile(force = false) {
    const now = Date.now();
    // Throttle reconciliation pings to at most once per 5 seconds
    if (!force && now - this.lastFetchedAt < 5000) {
      return;
    }
    if (this.isFetching) return;

    this.isFetching = true;
    this.lastFetchedAt = now;

    try {
      const buddiesPresence = await apiFetch('/api/buddies/presence');
      if (Array.isArray(buddiesPresence)) {
        for (const item of buddiesPresence) {
          if (item && item.userId) {
            this.presenceMap.set(item.userId, {
              userId: item.userId,
              username: item.username,
              name: item.name,
              avatarUrl: item.avatarUrl,
              status: ['FOCUSING', 'PAUSED'].includes(item.status) ? item.status : 'IDLE',
              startedAt: item.startedAt || null,
              endsAt: item.endsAt || null,
              updatedAt: now,
            });
          }
        }
        this.notifySubscribers();
      }
    } catch (err) {
      // Reconcile failure is non-fatal (user might be offline / unauthenticated)
    } finally {
      this.isFetching = false;
    }
  }

  getPresence(userId) {
    if (!userId) return { status: 'IDLE' };
    const p = this.presenceMap.get(userId);
    if (!p) return { status: 'IDLE' };

    // Client-side expiration check if endsAt is in the past
    if (p.status === 'FOCUSING' && p.endsAt) {
      const endsTime = new Date(p.endsAt).getTime();
      if (!isNaN(endsTime) && Date.now() > endsTime + 60000) {
        return { ...p, status: 'IDLE' };
      }
    }

    return p;
  }

  getAllPresence() {
    const obj = {};
    for (const [id, p] of this.presenceMap.entries()) {
      obj[id] = p;
    }
    return obj;
  }

  subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    this.subscribers.add(callback);

    // Initial trigger
    callback(this.getAllPresence());

    // If map is empty or stale, trigger reconcile
    if (this.presenceMap.size === 0 || Date.now() - this.lastFetchedAt > 30000) {
      this.reconcile();
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  clear() {
    this.presenceMap.clear();
    this.notifySubscribers();
  }

  destroy() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    this.subscribers.clear();
    this.presenceMap.clear();
  }
}

export const presenceService = new PresenceService();

/**
 * React hook to observe live presence for all buddies.
 */
export function useAllBuddyPresence() {
  const [presenceMap, setPresenceMap] = useState(() => presenceService.getAllPresence());

  useEffect(() => {
    return presenceService.subscribe((updated) => {
      setPresenceMap({ ...updated });
    });
  }, []);

  return presenceMap;
}

/**
 * React hook to observe live presence for a specific buddy.
 */
export function useBuddyPresence(userId) {
  const [presence, setPresence] = useState(() => presenceService.getPresence(userId));

  useEffect(() => {
    if (!userId) {
      setPresence({ status: 'IDLE' });
      return;
    }

    const unsub = presenceService.subscribe(() => {
      setPresence(presenceService.getPresence(userId));
    });

    return unsub;
  }, [userId]);

  return presence;
}

/**
 * Calculates remaining session minutes from endsAt timestamp.
 * Returns null if endsAt is missing or invalid.
 */
export function getRemainingMinutes(endsAt) {
  if (!endsAt) return null;
  const target = new Date(endsAt).getTime();
  if (isNaN(target)) return null;
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60000);
}

/**
 * Formats high-level presence status label.
 * @param {Object} presence
 * @param {'short'|'full'} format
 * @returns {{ label: string, color: 'emerald'|'amber'|'slate', dotClass: string, isFocusing: boolean, isPaused: boolean }}
 */
export function formatPresenceStatus(presence, format = 'full') {
  const status = presence?.status;

  if (status === 'FOCUSING') {
    const mins = getRemainingMinutes(presence?.endsAt);
    let text = 'Focusing';
    if (mins != null && mins > 0) {
      text = format === 'short' ? `Focusing · ${mins}m` : `Focusing · ${mins} min remaining`;
    }
    return {
      label: text,
      color: 'emerald',
      dotClass: 'bg-emerald-500 animate-pulse',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      isFocusing: true,
      isPaused: false,
    };
  }

  if (status === 'PAUSED') {
    return {
      label: 'On a break',
      color: 'amber',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      isFocusing: false,
      isPaused: true,
    };
  }

  return {
    label: format === 'short' ? 'Offline' : 'Not focusing',
    color: 'slate',
    dotClass: 'bg-slate-500',
    badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    isFocusing: false,
    isPaused: false,
  };
}
