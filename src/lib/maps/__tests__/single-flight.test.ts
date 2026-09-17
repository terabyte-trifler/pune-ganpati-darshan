import { describe, it, expect, beforeEach } from 'vitest';
import {
  pendingRequest, trackRequest, clearPendingRequests, pendingRequestCount,
  clearRouterCache, cachedBody, rememberBody,
} from '@/lib/maps/router-cache';

beforeEach(() => { clearPendingRequests(); clearRouterCache(); });

/**
 * Twenty people tapping Optimise on the same walk in the same second.
 *
 * The LRU alone does not help here: nothing is stored until the first
 * answer returns, so every request that arrives while it is in flight
 * misses and goes upstream. The upstream is a volunteer-run Valhalla with
 * no SLA that has already returned ECONNRESET under load, so a burst of
 * identical questions is precisely what must not reach it.
 */
describe('single-flight collapses a burst into one upstream call', () => {
  const settle = (body: string) => ({ body, status: 200, ok: true });

  it('sends one request for twenty simultaneous identical asks', async () => {
    let upstreamCalls = 0;
    const ask = (key: string) => {
      const already = pendingRequest(key);
      if (already) return already;
      return trackRequest(key, (async () => {
        upstreamCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return settle('{"trip":1}');
      })());
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => ask('same-route'))
    );
    expect(upstreamCalls).toBe(1);
    expect(results).toHaveLength(20);
    expect(results.every((r) => r.body === '{"trip":1}')).toBe(true);
  });

  it('does not collapse requests that differ', async () => {
    let upstreamCalls = 0;
    const ask = (key: string) => {
      const already = pendingRequest(key);
      if (already) return already;
      return trackRequest(key, (async () => {
        upstreamCalls++;
        await new Promise((r) => setTimeout(r, 5));
        return settle(key);
      })());
    };
    await Promise.all([ask('a'), ask('b'), ask('c'), ask('a')]);
    expect(upstreamCalls).toBe(3);
  });

  /**
   * A failure must be shared too. If the one real call fails and the other
   * nineteen then each try their own, a bad minute upstream becomes a
   * retry storm against a server already in trouble.
   */
  it('shares a failure rather than letting each caller retry', async () => {
    let upstreamCalls = 0;
    const ask = (key: string) => {
      const already = pendingRequest(key);
      if (already) return already;
      return trackRequest(key, (async () => {
        upstreamCalls++;
        await new Promise((r) => setTimeout(r, 5));
        return { body: 'rate limited', status: 429, ok: false };
      })());
    };
    const out = await Promise.all(Array.from({ length: 10 }, () => ask('k')));
    expect(upstreamCalls).toBe(1);
    expect(out.every((r) => r.status === 429)).toBe(true);
  });

  it('releases the key so the next ask can run', async () => {
    const run = trackRequest('k', Promise.resolve(settle('x')));
    expect(pendingRequestCount()).toBe(1);
    await run;
    await Promise.resolve();
    expect(pendingRequestCount()).toBe(0);
    expect(pendingRequest('k')).toBeNull();
  });

  it('releases the key even when the request throws', async () => {
    const boom = trackRequest('k', Promise.reject(new Error('network')));
    await expect(boom).rejects.toThrow('network');
    await Promise.resolve();
    expect(pendingRequestCount()).toBe(0);
  });

  /** A later request must not be evicted by an earlier one settling. */
  it('does not let a settling promise evict a newer one', async () => {
    const first = trackRequest('k', Promise.resolve(settle('1')));
    await first;
    const second = trackRequest('k', new Promise<never>(() => {}));
    await Promise.resolve(); await Promise.resolve();
    expect(pendingRequest('k')).toBe(second);
  });

  it('still prefers the stored body once one exists', () => {
    rememberBody('k', '{"cached":true}');
    expect(cachedBody('k')).toBe('{"cached":true}');
  });
});
