import 'server-only';

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
