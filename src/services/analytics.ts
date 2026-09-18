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
  | 'location_enabled'
  | 'crowd_reported'
  | 'crowd_report_rejected'
  /**
   * How long a position took and how good it was, bucketed — never a
   * coordinate. The only way to measure geolocation, which cannot be
   * profiled from a desktop. See hooks/useGeolocation.
   */
  | 'location_fix';

interface QueuedEvent {
  name: AnalyticsEventName;
  ganpatiId?: string;
  props?: Record<string, string | number | boolean>;
}

const SESSION_KEY = 'pg.session';
/**
 * How long a queued event waits for company before it is sent. Measured at
 * 1.2s, every interaction more than a moment apart became its own request:
 * analytics was 131K of the 198K daily function invocations. Widening it
 * costs nothing that matters because the queue is always flushed on the way
 * out of the page.
 */
const FLUSH_WINDOW_MS = 6_000;

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

const REFERRER_KEY = 'pg.referrer';

/**
 * Where this session arrived from — the referring HOST only.
 *
 * Captured once and kept for the session, because `document.referrer` is
 * the previous page: it names Instagram on the first pageview and then
 * names us on every one after, which would report the app as its own
 * biggest traffic source.
 *
 * Only the host is ever sent. A full referrer URL carries search terms,
 * private group links and document titles, and none of that belongs in an
 * analytics table. Our own host resolves to null so internal navigation
 * reads as direct rather than as a referral from ourselves.
 */
function referrerHost(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = sessionStorage.getItem(REFERRER_KEY);
    if (stored !== null) return stored === '' ? undefined : stored;

    let host = '';
    if (document.referrer) {
      try {
        const url = new URL(document.referrer);
        if (url.host && url.host !== window.location.host) host = url.host;
      } catch {
        // A referrer that is not a parseable URL tells us nothing.
      }
    }
    sessionStorage.setItem(REFERRER_KEY, host);
    return host === '' ? undefined : host;
  } catch {
    return undefined;
  }
}

function flush() {
  if (typeof window === 'undefined' || queue.length === 0) return;

  const batch = queue;
  queue = [];
  // Cancel, don't just forget. A flush triggered by the size cap or by the
  // page going away used to leave the old timer pending, so the next event
  // after it was sent on the remainder of someone else's window instead of
  // its own.
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = null;

  const payload = JSON.stringify({
    sessionId: sessionId(),
    referrerHost: referrerHost(),
    events: batch,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch('/api/analytics', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        // The catch below only ever caught a synchronous throw. A fetch
        // that rejects later — a dropped connection in a peth at 9pm,
        // which is the normal case here — escaped it entirely and became
        // an unhandled rejection in the console. Harmless to the page and
        // noisy everywhere else: it surfaced as 29 errors in the test run
        // the moment anything on a timer started reporting.
      }).catch(() => {});
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

  // Batch within a window wide enough to cover a read-then-tap, so a whole
  // page visit is usually one request rather than one per interaction. The
  // window is only a ceiling on latency, never on delivery: both unload
  // handlers below flush synchronously, and sendBeacon survives the unload.
  flushTimer ??= setTimeout(flush, FLUSH_WINDOW_MS);

  if (queue.length >= 10) flush();
}

if (typeof window !== 'undefined') {
  // Flush on the last reliable moment before the page goes away. Neither
  // event alone is enough: iOS Safari can move a page into the back/forward
  // cache without ever reporting it hidden, and a desktop tab can be hidden
  // for minutes and then come back. Listening for both means the wider
  // batching window above never costs an event. flush() is a no-op on an
  // empty queue, so firing twice is free.
  const flushBeforeUnload = () => flush();
  window.addEventListener('pagehide', flushBeforeUnload);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushBeforeUnload();
  });
}
