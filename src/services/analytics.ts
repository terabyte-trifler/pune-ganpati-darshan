'use client';

/**
 * Product analytics.
 *
 * Privacy posture (§40): no personal data, no cross-site identifiers, no
 * raw IP. The session id is a random value held in sessionStorage — it
 * disappears when the tab closes and cannot be joined to a person.
 *
 * Events are queued and flushed with `sendBeacon` so a tap that navigates
 * away still records, and so analytics never delays a user action.
 */

export type AnalyticsEventName =
  | 'map_opened'
  | 'ganpati_viewed'
  | 'search_performed'
  | 'search_no_results'
  | 'directions_clicked'
  | 'favorite_added'
  | 'favorite_removed'
  | 'plan_created'
  | 'plan_started'
  | 'plan_optimized'
  | 'share_clicked'
  | 'location_enabled';

interface QueuedEvent {
  name: AnalyticsEventName;
  ganpatiId?: string;
  props?: Record<string, string | number | boolean>;
}

const SESSION_KEY = 'pg.session';
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function sessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked — analytics is optional, never fatal.
    return '';
  }
}

function flush() {
  if (typeof window === 'undefined' || queue.length === 0) return;

  const batch = queue;
  queue = [];
  flushTimer = null;

  const payload = JSON.stringify({ sessionId: sessionId(), events: batch });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch('/api/analytics', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    }
  } catch {
    // Analytics must never surface an error to the user.
  }
}

export function trackEvent(
  name: AnalyticsEventName,
  options: { ganpatiId?: string; props?: Record<string, string | number | boolean> } = {}
) {
  if (typeof window === 'undefined') return;
  queue.push({ name, ganpatiId: options.ganpatiId, props: options.props });

  // Batch within a short window so a burst of interactions is one request.
  flushTimer ??= setTimeout(flush, 1200);

  if (queue.length >= 10) flush();
}

if (typeof window !== 'undefined') {
  // Flush on the last reliable moment before the page goes away.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
