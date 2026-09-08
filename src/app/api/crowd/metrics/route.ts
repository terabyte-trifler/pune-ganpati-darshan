import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { serverEnv } from '@/lib/env.server';
import { readCrowdMetrics } from '@/services/crowd/crowd-metrics';

/**
 * Operational metrics for the crowd feature (§42).
 *
 * Disabled unless `CROWD_METRICS_TOKEN` is configured, and it returns 404
 * rather than 401 when it is not: an endpoint that answers "unauthorised"
 * has confirmed it exists, and this one has no reason to be discoverable.
 *
 * These are per-instance, in-process figures. That is a real limitation
 * and it is why the load test measures the system from outside rather
 * than trusting this endpoint for its headline numbers.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length must match before timingSafeEqual, which throws otherwise —
  // compare lengths first, then the bytes in constant time.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const { CROWD_METRICS_TOKEN } = serverEnv();
  if (!CROWD_METRICS_TOKEN) {
    return new NextResponse(null, { status: 404 });
  }

  const provided =
    request.headers.get('x-metrics-token') ??
    new URL(request.url).searchParams.get('token') ??
    '';

  if (!tokenMatches(provided, CROWD_METRICS_TOKEN)) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(readCrowdMetrics(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
