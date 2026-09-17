import 'server-only';

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CROWD_CACHE_TTL_SECONDS } from './crowd-cache';
import { recordCrowdMetric } from './crowd-metrics';

/**
 * HTTP conventions shared by every crowd read endpoint.
 *
 * These headers are the load-bearing part of the whole design. The
 * in-process cache stops repeated database work inside one instance; this
 * is what stops the requests reaching the instance at all. With
 * `s-maxage=15` a CDN serves one origin request per mandal per 15 seconds
 * no matter how many people are reading, which is the difference between
 * 10,000 concurrent readers and 10,000 concurrent origin hits.
 *
 * `stale-while-revalidate` matters just as much: at the moment the cache
 * expires the CDN keeps serving the old copy and refreshes behind it, so
 * expiry never produces a latency spike or a burst of origin traffic.
 */

interface CacheOptions {
  /** Seconds a shared cache may serve this without revalidating. */
  sMaxAge?: number;
  /** Seconds it may keep serving a stale copy while it refreshes. */
  staleWhileRevalidate?: number;
  /**
   * What the ETag is computed over, when that is not the whole body.
   *
   * Exists because hashing the whole body made the ETag useless. The crowd
   * snapshot carries `computedAt`, the moment it was BUILT, which moves
   * every time the cache expires and the snapshot is recomputed — even
   * when every reading in it is byte-identical. Two consecutive snapshots
   * taken two seconds apart differed in that one field and nothing else,
   * so the hash changed, every conditional request missed, and a poll that
   * should have cost a few hundred bytes of headers cost the entire body.
   *
   * Pass the part that actually represents the content, and a client
   * holding an unchanged copy gets the 304 this was always meant to send.
   */
  etagOf?: unknown;
}

/**
 * A public, CDN-cacheable JSON response with an ETag.
 *
 * The ETag turns a poll into a 304 with no body, which matters on a
 * congested festival network: a phone polling transfers a few hundred
 * bytes of headers instead of the payload when nothing has changed — and
 * it is the difference between a poll costing 1.6 KB on the wire and
 * costing almost nothing.
 *
 * See `etagOf` for why the caller usually has to say what to hash.
 */
export function cachedJson(
  data: unknown,
  request: Request,
  {
    sMaxAge = CROWD_CACHE_TTL_SECONDS,
    staleWhileRevalidate = 60,
    etagOf,
  }: CacheOptions = {}
) {
  const body = JSON.stringify(data);
  const etag = `W/"${createHash('sha1')
    .update(JSON.stringify(etagOf === undefined ? data : etagOf))
    .digest('base64url')}"`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // `public` is deliberate and safe here: this payload is identical for
    // every visitor. Anything device-specific — cooldown state above all —
    // must never use this helper (§54).
    'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    ETag: etag,
  };

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(body, { status: 200, headers });
}

/** A response that must never be cached by anyone (§54). */
export function privateJson(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

/** Records end-to-end handler latency for the metrics endpoint (§42). */
export async function timed<T>(fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    recordCrowdMetric('crowd_api_latency', Date.now() - startedAt);
  }
}
