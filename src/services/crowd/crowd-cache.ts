import type { CrowdStatus } from '@/types/crowd';

/**
 * Cache seam.
 *
 * The point of this interface is that no business logic knows where a
 * cached status lives. Today it is process memory; putting it in
 * Cloudflare KV or a Worker cache later is a new class implementing these
 * three methods and one line in `getCrowdCache()` — no change to
 * aggregation, routes, or components.
 *
 * A cache miss is never an error. Every implementation must degrade to
 * "not cached" on failure rather than throwing, because a cache outage
 * that takes the feature down with it is worse than no cache at all (§40).
 */
export interface CrowdCache {
  get(mandalId: string): Promise<CrowdStatus | null>;
  set(mandalId: string, status: CrowdStatus, ttlSeconds: number): Promise<void>;
  invalidate(mandalId: string): Promise<void>;
}

/**
 * Freshness of cached crowd state.
 *
 * 15 seconds. Crowd reports are inherently fuzzy — a queue does not change
 * meaningfully in 15 seconds — and this is the single number that decides
 * how much traffic reaches Postgres: at 10,000 concurrent readers, one
 * database query per 15s window is the difference between a warm database
 * and a dead one.
 */
export const CROWD_CACHE_TTL_SECONDS = 15;

/**
 * How long a snapshot may be served after a database failure (§55).
 * Well beyond the TTL, because stale-but-labelled beats an empty panel.
 */
export const CROWD_STALE_TTL_SECONDS = 900;

/**
 * Cache key (§47).
 *
 * Versioned so a change to the aggregation algorithm cannot serve results
 * computed by the previous one, and namespaced by festival year so last
 * year's state can never surface.
 *
 * `mandalId` must already have been checked against the catalogue by the
 * caller — see `assertKnownMandalIds` in crowd-service.ts. Keys are never
 * built from unvalidated input, which is what stops a caller from writing
 * to an arbitrary key or poisoning one (§53).
 */
export function crowdCacheKey(mandalId: string, festivalYear: number): string {
  return `crowd:v1:${festivalYear}:mandal:${mandalId}`;
}

interface Entry {
  status: CrowdStatus;
  expiresAt: number;
}

/**
 * In-process cache.
 *
 * Correct for a single instance and the right starting point: it needs no
 * new infrastructure and no new failure mode. Its limit is honest and
 * documented — on N instances there are N copies, so the effective
 * database load is N queries per TTL window rather than one, and a write
 * invalidates only the instance that served it. At the traffic this app
 * expects that is a rounding error; when it stops being one, the fix is a
 * shared implementation of `CrowdCache`, not a rewrite.
 */
export class MemoryCrowdCache implements CrowdCache {
  private readonly entries = new Map<string, Entry>();
  private lastSweep = 0;

  constructor(
    private readonly festivalYear: number,
    /** Bound on entries so a pathological caller cannot grow this forever. */
    private readonly maxEntries = 2_000
  ) {}

  private key(mandalId: string) {
    return crowdCacheKey(mandalId, this.festivalYear);
  }

  /** Drop expired entries occasionally rather than on every access. */
  private sweep(now: number) {
    if (now - this.lastSweep < 30_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  async get(mandalId: string): Promise<CrowdStatus | null> {
    const now = Date.now();
    this.sweep(now);

    const entry = this.entries.get(this.key(mandalId));
    if (!entry || entry.expiresAt <= now) return null;
    return entry.status;
  }

  async set(mandalId: string, status: CrowdStatus, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.sweep(now);

    if (this.entries.size >= this.maxEntries) {
      // Oldest insertion first — Map preserves insertion order.
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }

    this.entries.set(this.key(mandalId), {
      status,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  async invalidate(mandalId: string): Promise<void> {
    // Only this mandal. Flushing everything on every report would throw
    // away the whole city's cache hundreds of times an evening (§48).
    this.entries.delete(this.key(mandalId));
  }

  /** Test/observability helper. Not part of the interface. */
  size(): number {
    return this.entries.size;
  }
}

let cache: CrowdCache | null = null;

/**
 * The process-wide cache.
 *
 * The one place that decides which implementation is in use. A Cloudflare
 * KV or Workers-backed cache slots in here behind an env check without any
 * caller learning about it.
 */
export function getCrowdCache(festivalYear = new Date().getFullYear()): CrowdCache {
  cache ??= new MemoryCrowdCache(festivalYear);
  return cache;
}

/** Test seam: swap the implementation, and restore it afterwards. */
export function setCrowdCacheForTesting(next: CrowdCache | null) {
  cache = next;
}
