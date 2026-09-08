import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';
import { clientIpFrom, hashIp } from '@/lib/client-ip';

/**
 * In-memory fixed-window rate limiter.
 *
 * Scope: protects a single server instance from a runaway client and from
 * casual abuse of the endpoints that cost money. It is intentionally simple
 * — on multi-instance deployments this must be backed by a shared store
 * (documented in docs/06-security.md) — but it is real, not a stub.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Drop expired buckets occasionally so the map cannot grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function clientId(request: Request) {
  // Trust the platform-set forwarding headers only; never a client-supplied
  // identifier, which would make the limit trivially bypassable.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function rateLimit(
  request: Request,
  { key, limit, windowMs }: { key: string; limit: number; windowMs: number }
): { allowed: boolean; remaining: number; retryAfterS: number } {
  const now = Date.now();
  sweep(now);

  const id = `${key}:${clientId(request)}`;
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterS: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterS: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Cross-instance rate limit.
 *
 * The in-memory limiter above protects one process. On a horizontally
 * scaled deployment that is quietly wrong: N instances multiply every
 * limit by N, and which instance a request lands on is arbitrary — so the
 * limit becomes a suggestion at exactly the traffic where it matters.
 *
 * This counts in Postgres, the store every instance already shares. Redis
 * is the reflex answer and would be a whole piece of infrastructure to
 * run, pay for and monitor for a few hundred writes an evening. Use it
 * when measurement demands it, not before.
 *
 * Costs one round trip, so it belongs on write endpoints only. Reads are
 * protected by the CDN and the cache, which is far cheaper.
 *
 * Fails OPEN: if the database is unreachable the request is allowed
 * through. A rate limiter that takes the site down when its store blinks
 * has converted a minor dependency into a total outage, and the layers
 * behind this one (per-device caps, atomic cooldowns) still hold.
 */
export async function sharedRateLimit(
  request: Request,
  { bucket, limit, windowSeconds }: { bucket: string; limit: number; windowSeconds: number }
): Promise<{ allowed: boolean; retryAfterS: number }> {
  const ip = clientIpFrom(request);
  if (!ip) return { allowed: true, retryAfterS: 0 };

  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { allowed: true, retryAfterS: 0 };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_key_hash: hashIp(ip),
      p_window: `${windowSeconds} seconds`,
      p_limit: limit,
    });

    if (error || !data) return { allowed: true, retryAfterS: 0 };

    const result = data as { allowed: boolean; retryAfter: number };
    return { allowed: result.allowed, retryAfterS: result.retryAfter };
  } catch {
    return { allowed: true, retryAfterS: 0 };
  }
}
