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
