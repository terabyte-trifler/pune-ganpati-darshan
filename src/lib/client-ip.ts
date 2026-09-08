import 'server-only';

import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env.server';

/**
 * Identifying a caller by address, carefully.
 *
 * ⚠️ `X-Forwarded-For` is only trustworthy behind a proxy that OVERWRITES
 * it — Vercel and Cloudflare do. Exposed directly to the internet, a client
 * can set it to anything, and every limit keyed on it becomes advisory.
 * That is why IP limiting is always the outermost layer here and never the
 * only one: the per-device caps and the atomic cooldown do not depend on it.
 */
export function clientIpFrom(request: Request): string | null {
  // Platform-set forwarding headers only, never a client-named identifier.
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip');
  return ip || null;
}

/**
 * Salted digest of an address. The raw value is never stored.
 *
 * The fallback constant keeps throttling working without configuration,
 * and stays consistent across instances — a per-process random salt would
 * silently break shared limits, which is worse than a weak salt. Set
 * CROWD_IP_SALT in production: IPv4 has only ~4 billion values, so an
 * unsalted digest is reversible by anyone who obtains the table.
 */
const IP_SALT_FALLBACK = 'pune-ganpati-darshan/crowd-ip/v1';

export function hashIp(ip: string): string {
  const { CROWD_IP_SALT } = serverEnv();
  return createHash('sha256')
    .update(`${CROWD_IP_SALT ?? IP_SALT_FALLBACK}:${ip}`)
    .digest('hex')
    .slice(0, 32);
}
