'use client';

import type { CrowdSnapshot, CrowdStatus } from '@/types/crowd';

/**
 * One crowd poller for the whole application.
 *
 * Every marker on the map, every card in a list and the detail panel all
 * read from this single store. That is the difference between one request
 * per 20 seconds and one request per component per 20 seconds — at 40
 * markers, the naive version is 120 requests a minute from one phone
 * (§22).
 *
 * Polling stops whenever it cannot be useful: hidden tab, backgrounded
 * app, offline. A festival crowd is exactly the situation where thousands
 * of phones sit in pockets with the tab still open, and a poller that
 * keeps running there is pure cost to the user's battery and our origin
 * (§23).
 */

const ENDPOINT = '/api/crowd';

/**
 * 30s, matched against the endpoint's own cache lifetime rather than
 * chosen for feel.
 *
 * The response carries `s-maxage=15`, so the CDN cannot hand back anything
 * newer than 15 seconds old however often it is asked. Polling faster than
 * that buys no freshness at all — it only multiplies edge requests. A load
 * test against production measured the arithmetic that matters here: 4,606
 * requests over 70 seconds produced a 100% cache hit ratio and ZERO origin
 * requests, so the cost of polling is entirely edge requests and bandwidth,
 * not database load.
 *
 * At the 10,000-concurrent-user target, 20s polling is ~500 req/s to this
 * endpoint; 30s is ~333 req/s. That is roughly 2.4 million fewer edge
 * requests across a four-hour festival evening, in exchange for readings
 * that are at most 15 seconds older — against a 90-minute active window
 * and per-row timestamps that already tell the user exactly how fresh each
 * reading is.
 */
const POLL_INTERVAL_MS = 30_000;
/** Persisted so a reopened tab has something to show immediately (§56). */
const STORAGE_KEY = 'ganpatigo_crowd_snapshot';
/** Beyond this, a restored snapshot is presented as stale, never as now. */
const RESTORE_STALE_AFTER_MS = 2 * 60_000;

export interface CrowdStoreState {
  byMandalId: Record<string, CrowdStatus>;
  computedAt: string | null;
  /** True when what we hold is known to be out of date (§55, §56). */
  stale: boolean;
  /** The API could not be reached and we have nothing usable. */
  unavailable: boolean;
  dwell: Record<string, import('@/services/crowd/crowd-dwell').DwellSummary>;
  loading: boolean;
}

const EMPTY: CrowdStoreState = {
  byMandalId: {},
  computedAt: null,
  stale: false,
  unavailable: false,
  dwell: {},
  loading: true,
};

let state: CrowdStoreState = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;
let restored = false;

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: Partial<CrowdStoreState>) {
  state = { ...state, ...next };
  emit();
}

function toMap(statuses: CrowdStatus[]): Record<string, CrowdStatus> {
  return Object.fromEntries(statuses.map((s) => [s.mandalId, s]));
}

/**
 * Bring back the last snapshot this device saw.
 *
 * Marked stale unless it is very fresh. Showing a two-hour-old crowd
 * reading as current would be worse than showing nothing — the entire
 * value of the feature is that it reflects right now.
 */
function restore() {
  if (restored || typeof window === 'undefined') return;
  restored = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw) as CrowdSnapshot;
    if (!saved?.statuses || !saved.computedAt) return;

    const age = Date.now() - Date.parse(saved.computedAt);
    if (!Number.isFinite(age) || age < 0) return;

    setState({
      byMandalId: toMap(saved.statuses),
      computedAt: saved.computedAt,
      stale: age > RESTORE_STALE_AFTER_MS,
      loading: false,
    });
  } catch {
    // Private mode, blocked storage, corrupt value — all fine, we just
    // start empty rather than breaking the page.
  }
}

function persist(snapshot: CrowdSnapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or blocked storage. Not worth surfacing.
  }
}

async function fetchSnapshot(): Promise<void> {
  // Coalesce: a visibility change and a timer tick can land together.
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch(ENDPOINT, {
        headers: { Accept: 'application/json' },
        // The CDN and the browser cache already handle freshness; asking
        // for no-store here would defeat both.
        cache: 'no-cache',
      });

      if (response.status === 503) {
        // Keep whatever we already have and mark it stale rather than
        // blanking the panel (§55).
        setState({
          loading: false,
          stale: Object.keys(state.byMandalId).length > 0,
          unavailable: Object.keys(state.byMandalId).length === 0,
        });
        return;
      }

      if (!response.ok) throw new Error(`crowd ${response.status}`);

      const snapshot = (await response.json()) as CrowdSnapshot;
      setState({
        byMandalId: toMap(snapshot.statuses),
        computedAt: snapshot.computedAt,
        stale: snapshot.stale,
        // Absent when the display switch is off, which is the normal case.
        dwell: snapshot.dwell ?? {},
        unavailable: false,
        loading: false,
      });
      persist(snapshot);
    } catch {
      setState({
        loading: false,
        stale: Object.keys(state.byMandalId).length > 0,
        unavailable: Object.keys(state.byMandalId).length === 0,
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Poll only while the page is visible, online, and someone is listening. */
function shouldPoll() {
  if (typeof document === 'undefined') return false;
  if (listeners.size === 0) return false;
  if (document.visibilityState === 'hidden') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

function syncTimer() {
  if (shouldPoll()) {
    timer ??= setInterval(() => void fetchSnapshot(), POLL_INTERVAL_MS);
  } else if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onVisibilityChange() {
  syncTimer();
  // Coming back to the tab, whatever we hold is up to 20 seconds stale and
  // the user is looking right at it. Refresh immediately.
  if (shouldPoll()) void fetchSnapshot();
}

let wired = false;
function wireGlobalListeners() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('online', onVisibilityChange);
  window.addEventListener('offline', syncTimer);
  // Some mobile browsers fire pagehide/pageshow without visibilitychange.
  window.addEventListener('pageshow', onVisibilityChange);
}

export function subscribeToCrowd(listener: () => void): () => void {
  restore();
  wireGlobalListeners();

  listeners.add(listener);
  syncTimer();

  // First subscriber kicks off an immediate load; later ones reuse it.
  if (listeners.size === 1) void fetchSnapshot();

  return () => {
    listeners.delete(listener);
    syncTimer();
  };
}

export function getCrowdState(): CrowdStoreState {
  return state;
}

/** Stable empty state for SSR, so hydration does not mismatch. */
export function getServerCrowdState(): CrowdStoreState {
  return EMPTY;
}

export function refreshCrowd(): Promise<void> {
  return fetchSnapshot();
}

/**
 * Fold a freshly submitted report's result into the store.
 *
 * The report endpoint returns the recomputed status, so the panel can
 * update the moment it lands rather than waiting up to 20 seconds for the
 * next poll.
 */
export function applyCrowdStatus(status: CrowdStatus) {
  setState({
    byMandalId: { ...state.byMandalId, [status.mandalId]: status },
    stale: false,
    unavailable: false,
    loading: false,
  });
}

/** Test seam. */
export function resetCrowdStoreForTesting() {
  state = EMPTY;
  restored = false;
  if (timer) clearInterval(timer);
  timer = null;
  inFlight = null;
  listeners.clear();
}
