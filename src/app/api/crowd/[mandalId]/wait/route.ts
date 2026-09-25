import { NextResponse } from 'next/server';
import { z } from 'zod';
import { submitWaitReport, recomputeMandal, clientIpFrom } from '@/services/crowd/crowd-service';
import { privateJson, timed } from '@/services/crowd/crowd-http';
import { mandalIdSchema, deviceIdSchema } from '@/services/crowd/crowd-validation';
import { rateLimit } from '@/lib/rate-limit';
import { features } from '@/lib/env';

/**
 * Submit how long you waited.
 *
 * Every rule lives in the database function, as it does for colour
 * reports: the two-hour cooldown per device per mandal, the daily cap,
 * the shared IP throttle and the block list. This handler only validates
 * the shape and forwards it, so editing localStorage or calling this
 * directly changes nothing that matters.
 *
 * Responses are no-store: the outcome is specific to one device, and a
 * cached cooldown would leak one device's state to another.
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

const bodySchema = z.object({
  deviceId: deviceIdSchema,
  /**
   * Whole minutes. Capped at four hours by the database too — beyond that
   * it is a misread question rather than a queue, and one absurd number
   * drags a median further than ten honest ones.
   */
  minutes: z.number().int().min(0).max(240),
  requestId: z.string().max(64).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mandalId: string }> }
) {
  /**
   * Reporting is switched off — see `features.crowd`.
   *
   * Refused here as well as hidden in the UI. The buttons are gone, but
   * a cooldown token or a replayed request would otherwise still write,
   * and collecting readings nobody is shown is worse than collecting
   * none: they would age into the database looking like evidence.
   *
   * 503 rather than 404: the endpoint exists and is expected back.
   */
  if (!features.crowd) {
    return NextResponse.json(
      { error: 'Crowd reporting is currently switched off.' },
      { status: 503 }
    );
  }

  return timed(async () => {
    const limit = rateLimit(request, { key: 'crowd-wait', limit: 20, windowMs: 60_000 });
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
    if (!id.success) return privateJson({ success: false, reason: 'invalid_request' }, 400);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return privateJson({ success: false, reason: 'invalid_request' }, 400);
    }

    const body = bodySchema.safeParse(raw);
    if (!body.success) return privateJson({ success: false, reason: 'invalid_request' }, 400);

    const result = await submitWaitReport({
      mandalId: id.data,
      deviceId: body.data.deviceId,
      minutes: body.data.minutes,
      requestId: body.data.requestId,
      ip: clientIpFrom(request),
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

    // Hand back the recomputed reading, so the panel updates the moment
    // the report lands rather than at the next poll.
    // One mandal, not the city — see the report route.
    const crowd = await recomputeMandal(id.data).catch(() => null);
    return privateJson({ ...result, crowd }, 201);
  });
}
