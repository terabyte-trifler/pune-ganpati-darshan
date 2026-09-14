import { NextResponse } from 'next/server';
import {
  submitCrowdReport,
  recomputeMandal,
  clientIpFrom,
} from '@/services/crowd/crowd-service';
import { privateJson, timed } from '@/services/crowd/crowd-http';
import { mandalIdSchema, reportBodySchema } from '@/services/crowd/crowd-validation';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Submit a crowd report.
 *
 * The client's cooldown display is UX only; every rule is enforced behind
 * this handler and again inside the database function (§11, §31). Editing
 * localStorage, or calling this endpoint directly with a fresh device id,
 * changes nothing that matters — the atomic claim in
 * `submit_crowd_report()` is what actually decides.
 *
 * Three layers of protection sit in front of that claim:
 *
 *   1. this per-IP in-process limiter — cheap, rejects floods before any
 *      database work happens, but only protects one instance;
 *   2. the shared per-IP throttle table inside the RPC, which is correct
 *      across instances;
 *   3. the per-device hourly cap and the per-mandal cooldown.
 *
 * Responses are `no-store`: the outcome is specific to one device, and
 * caching a cooldown or a success at a CDN would leak one device's state
 * to another (§54).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Next to the database. See the note on the root layout: the default is
 * iad1, Supabase answers from BOM, and each round trip was costing ~330ms
 * across the Pacific. Declared per route because the layout-level
 * declaration is not applied to route handlers.
 */
export const preferredRegion = 'bom1';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mandalId: string }> }
) {
  return timed(async () => {
    // Generous enough for a person tapping through several mandals in an
    // evening, tight enough that a script gets nowhere.
    const limit = rateLimit(request, { key: 'crowd-report', limit: 20, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, reason: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store, private',
            'Retry-After': String(limit.retryAfterS),
          },
        }
      );
    }

    const { mandalId } = await params;
    const id = mandalIdSchema.safeParse(mandalId);
    if (!id.success) {
      return privateJson({ success: false, reason: 'invalid_request' }, 400);
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return privateJson({ success: false, reason: 'invalid_request' }, 400);
    }

    const body = reportBodySchema.safeParse(raw);
    if (!body.success) {
      return privateJson({ success: false, reason: 'invalid_request' }, 400);
    }

    const result = await submitCrowdReport({
      mandalId: id.data,
      deviceId: body.data.deviceId,
      status: body.data.status,
      requestId: body.data.requestId,
      ip: clientIpFrom(request),
      atMandal: body.data.atMandal,
    });

    if (!result.success) {
      const status =
        result.reason === 'cooldown' || result.reason === 'rate_limited' ? 429
        : result.reason === 'unavailable' ? 503
        : result.reason === 'reporting_disabled' ? 409
        : 400;

      const headers: Record<string, string> = { 'Cache-Control': 'no-store, private' };
      if (result.reason === 'cooldown') headers['Retry-After'] = String(result.retryAfter);

      return NextResponse.json(result, { status, headers });
    }

    // Hand back the recomputed status so the panel updates the instant the
    // report lands, rather than showing the old consensus until the next
    // poll.
    //
    // ONE mandal, not the city. This used to call getCrowdStatus, which
    // reads the whole-city snapshot — and the write had just invalidated
    // this mandal, so the snapshot's "all warm" check failed and all 29
    // were recomputed before the voter got a reply. That was the bulk of
    // a 2.04s median vote.
    const crowd = await recomputeMandal(id.data).catch(() => null);

    return privateJson({ ...result, crowd }, 201);
  });
}
