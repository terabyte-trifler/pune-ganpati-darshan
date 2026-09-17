import { recordCacheHit } from '@/lib/maps/route-stats';

/**
 * Remember what the router said, because it will be asked again.
 *
 * Measured on /api/routes before this existed: a three-stop plan cost 2
 * calls and 983 ms, eight stops 9 calls and 3.6 s, fifteen stops 19 calls
 * and 9.6 s — with 97% of the wall clock spent waiting on the public
 * Valhalla instance, and the same plan asked twice costing full price both
 * times. Nothing was cached. The `next: { revalidate }` on those fetches
 * does not apply inside a dynamic route handler, and Valhalla itself sends
 * no cache headers at all, so every ask was a fresh round trip.
 *
 * The answers are worth keeping: a road network does not change during a
 * festival, so the same locations produce the same line. Two people
 * planning the same walk, one person adding and removing a stop, and the
 * retry loops re-asking overlapping questions all collapse onto one call.
 *
 * In process, on purpose. It needs no infrastructure and cannot fail in a
 * way that takes the site with it. The cost of that choice is honest: on
 * serverless each instance keeps its own, so the hit rate depends on
 * instance reuse and a cold instance starts empty. It makes a warm
 * instance fast; it is not a shared cache and is not claimed as one.
 */

const TTL_MS = 60 * 60 * 1000;
/** Bounded so a long-lived instance cannot grow without limit. */
const MAX_ENTRIES = 500;

interface Entry {
  body: string;
  at: number;
}

const store = new Map<string, Entry>();

function evict() {
  // Oldest first — Map keeps insertion order, and every hit reinserts.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function cachedBody(key: string): string | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  // Reinsert so the freshest keys survive eviction.
  store.delete(key);
  store.set(key, hit);
  recordCacheHit();
  return hit.body;
}

export function rememberBody(key: string, body: string) {
  store.set(key, { body, at: Date.now() });
  evict();
}

/** Only for tests: the cache is process-wide and otherwise never cleared. */
export function clearRouterCache() {
  store.clear();
}

export function routerCacheSize() {
  return store.size;
}

/**
 * The half the cache was missing: two identical questions asked AT ONCE.
 *
 * The LRU above collapses a repeat ask into nothing, but only once the
 * first answer has come back. Everything that arrives while it is still
 * in flight misses, because there is nothing stored yet — so twenty
 * people tapping Optimise on the same popular walk in the same second
 * produced twenty calls to the public Valhalla instance, not one. The
 * cache made the SECOND minute cheap and did nothing for the first.
 *
 * That is the shape of a festival: everyone asks about the same handful
 * of mandals at the same moment, and the upstream is a volunteer-run
 * server with no SLA that has already answered ECONNRESET under load. A
 * burst of identical requests is exactly what must not reach it.
 *
 * So an identical request that is already running is awaited rather than
 * repeated. The outcome is shared whatever it is: if the one real call
 * fails, every waiter sees that failure instead of piling on a server
 * that is already struggling — which is the behaviour that turns a bad
 * minute into a retry storm.
 *
 * `crowd-service` does the same thing for the crowd snapshot and explains
 * the reasoning there too; this is that idea applied to the router.
 */
export interface SettledResponse {
  body: string;
  status: number;
  ok: boolean;
}

const pending = new Map<string, Promise<SettledResponse>>();

export function pendingRequest(key: string): Promise<SettledResponse> | null {
  return pending.get(key) ?? null;
}

export function trackRequest(
  key: string,
  run: Promise<SettledResponse>
): Promise<SettledResponse> {
  pending.set(key, run);
  // Cleared however it ends, and only if this promise is still the one
  // registered — a later request must never be evicted by an earlier
  // one settling.
  void run
    .catch(() => undefined)
    .finally(() => {
      if (pending.get(key) === run) pending.delete(key);
    });
  return run;
}

/** Only for tests, like clearRouterCache. */
export function clearPendingRequests() {
  pending.clear();
}

export function pendingRequestCount() {
  return pending.size;
}
