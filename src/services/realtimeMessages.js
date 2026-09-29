import { resolveApiBaseUrl } from '../api/client.js';

class RealtimeMessageClient {
  constructor() {
    this.eventSource = null;
    this.subscribers = new Set();
    this.status = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    this.retryCount = 0;
    this.reconnectTimer = null;
    this.isExplicitlyClosed = false;

    // Browser tab visibility handling
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.subscribers.size > 0) {
          if (!this.eventSource || this.eventSource.readyState === 2 /* CLOSED */) {
            this.reconnect(true);
          } else {
            // Signal listeners to reconcile in case messages arrived while tab was hidden
            this.notifyStatus('reconcile');
          }
        }
      });

      window.addEventListener('online', () => {
        if (this.subscribers.size > 0) {
          this.reconnect(true);
        }
      });
    }
  }

  notifyStatus(newStatus) {
    if (newStatus !== 'reconcile') {
      this.status = newStatus;
    }
    for (const sub of this.subscribers) {
      if (typeof sub.onStatusChange === 'function') {
        try {
          sub.onStatusChange(newStatus);
        } catch (err) {
          console.error('[RealtimeMessages] Error in onStatusChange listener:', err);
        }
      }
    }
  }

  notifyMessageCreated(payload) {
    for (const sub of this.subscribers) {
      if (typeof sub.onMessageCreated === 'function') {
        try {
          sub.onMessageCreated(payload);
        } catch (err) {
          console.error('[RealtimeMessages] Error in onMessageCreated listener:', err);
        }
      }
    }
  }

  notifyPresenceUpdate(payload) {
    for (const sub of this.subscribers) {
      if (typeof sub.onPresenceUpdate === 'function') {
        try {
          sub.onPresenceUpdate(payload);
        } catch (err) {
          console.error('[RealtimeMessages] Error in onPresenceUpdate listener:', err);
        }
      }
    }
  }

  connect() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource && (this.eventSource.readyState === 0 || this.eventSource.readyState === 1)) {
      return; // Already connecting or connected
    }

    this.cleanupEventSource();
    this.isExplicitlyClosed = false;
    this.notifyStatus(this.retryCount > 0 ? 'reconnecting' : 'connecting');

    const baseUrl = resolveApiBaseUrl();
    const url = `${baseUrl}/api/messages/events`;

    try {
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        this.retryCount = 0;
        this.notifyStatus('connected');
      };

      this.eventSource.addEventListener('message.created', (e) => {
        try {
          const parsed = JSON.parse(e.data);
          this.notifyMessageCreated(parsed);
        } catch (err) {
          console.warn('[RealtimeMessages] Failed to parse message.created event payload:', err);
        }
      });

      const presenceEvents = [
        'focus.presence.started',
        'focus.presence.paused',
        'focus.presence.resumed',
        'focus.presence.completed',
        'focus.presence.cancelled',
        'focus.presence.expired',
      ];

      for (const ev of presenceEvents) {
        this.eventSource.addEventListener(ev, (e) => {
          try {
            const parsed = JSON.parse(e.data);
            this.notifyPresenceUpdate(parsed);
          } catch (err) {
            console.warn(`[RealtimeMessages] Failed to parse ${ev} event payload:`, err);
          }
        });
      }

      this.eventSource.onerror = (e) => {
        console.warn('[RealtimeMessages] EventSource error/disconnect, readyState:', this.eventSource?.readyState);
        this.cleanupEventSource();

        if (this.isExplicitlyClosed) return;

        this.notifyStatus('reconnecting');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[RealtimeMessages] Error initializing EventSource:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.isExplicitlyClosed || this.subscribers.size === 0) {
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
    this.retryCount++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.subscribers.size > 0 && !this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  reconnect(immediate = false) {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (immediate) {
      this.retryCount = 0;
    }
    this.connect();
  }

  cleanupEventSource() {
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (_) {}
      this.eventSource = null;
    }
  }

  /**
   * Subscribes to realtime messages events.
   * Automatically establishes SSE connection on first subscriber.
   * @param {Object} handlers
   * @param {Function} handlers.onMessageCreated - Callback for message.created event
   * @param {Function} handlers.onStatusChange - Callback for status updates ('connected', 'reconnecting', 'reconcile')
   * @returns {Function} Unsubscribe function
   */
  subscribe(handlers = {}) {
    this.subscribers.add(handlers);

    if (this.subscribers.size === 1) {
      this.connect();
    } else if (this.status === 'connected') {
      handlers.onStatusChange?.('connected');
    }

    return () => {
      this.subscribers.delete(handlers);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  /**
   * Explicitly closes and tears down connection (e.g. on logout).
   */
  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupEventSource();
    this.notifyStatus('disconnected');
    this.retryCount = 0;
  }
}

export const realtimeMessages = new RealtimeMessageClient();
