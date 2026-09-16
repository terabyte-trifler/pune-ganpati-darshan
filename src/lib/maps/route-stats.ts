import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * What one /api/routes request actually cost, upstream.
 *
 * The handler's own work is microseconds; everything it waits for is a
 * router on the other side of the internet, and until this existed there
 * was no way to see how many times it asked. A plan that takes four
 * seconds is not four seconds of computation, it is some number of
 * sequential requests, and the number was the thing nobody knew.
 *
 * Per-request via AsyncLocalStorage rather than a module counter, which
 * would blend concurrent requests into a number describing neither.
 */
export interface RouteStats {
  /** Upstream routing calls made while serving this request. */
  calls: number;
  /** Milliseconds spent waiting for them. */
  upstreamMs: number;
  /** Cache hits served without an upstream call. */
  hits: number;
}

export const routeStats = new AsyncLocalStorage<RouteStats>();

export function recordUpstream(ms: number) {
  const s = routeStats.getStore();
  if (s) { s.calls++; s.upstreamMs += ms; }
}

export function recordCacheHit() {
  const s = routeStats.getStore();
  if (s) s.hits++;
}
