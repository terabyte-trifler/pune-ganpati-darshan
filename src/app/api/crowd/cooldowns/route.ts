import { NextResponse } from 'next/server';
import { getDeviceCooldowns } from '@/services/crowd/crowd-service';
import { privateJson, timed } from '@/services/crowd/crowd-http';
import { deviceIdSchema, mandalIdSchema, MAX_BATCH_IDS } from '@/services/crowd/crowd-validation';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

/**
 * Which mandals this device reported recently, and for how much longer.
 *
 * Purely so the UI can say "you reported this 20 minutes ago" on page load
 * instead of offering a button the server will refuse. It is advisory: the
 * cooldown is enforced by the atomic claim in `submit_crowd_report()`
 * regardless of what this returns or what the client does with it (§11).
 *
 * POST rather than GET, deliberately. A device id in a query string ends
 * up in access logs, referrer headers and any intermediary's cache key; in
 * a body it does not. And this response is specific to one device, so it
 * must never be stored by a shared cache (§54) — hence `no-store, private`
 * and no ETag.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  deviceId: deviceIdSchema,
  /** Omit for every mandal; the whole catalogue is well under the cap. */
  mandalIds: z.array(mandalIdSchema).min(1).max(MAX_BATCH_IDS).optional(),
});

export async function POST(request: Request) {
  return timed(async () => {
    const limit = rateLimit(request, { key: 'crowd-cooldowns', limit: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store, private',
            'Retry-After': String(limit.retryAfterS),
          },
        }
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return privateJson({ error: 'invalid_request' }, 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return privateJson({ error: 'invalid_request' }, 400);

    const cooldowns = await getDeviceCooldowns(
      parsed.data.deviceId,
      parsed.data.mandalIds
    ).catch(() => ({}));

    // Seconds remaining per mandal. Absent means no active cooldown.
    return privateJson({ cooldowns });
  });
}
