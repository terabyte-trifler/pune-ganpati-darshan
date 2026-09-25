import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { dwellDeviceKey } from '@/lib/dwell-key';
import { features } from '@/lib/env';

/**
 * Record a passive dwell sample. Shadow mode.
 *
 * It takes a mandal id, a device id, a class and a duration, and writes a
 * row that identifies nobody: the device id is used here — to check the
 * block list, and to derive a per-(mandal, day) key — and then discarded.
 * See 20260914160000_dwell_device_key.sql for why that is a key and not
 * an id, and the shadow migration for what it replaced.
 *
 * The device id became necessary when dwell was allowed to colour a
 * mandal with no human report behind it: a signal that decides something
 * is a signal worth gaming, and an endpoint with no cooldown and no
 * identity cannot be defended.
 *
 * There is no GET. Nothing reads this back except the admin surface,
 * through the service role. The table has no SELECT policy, so a stolen
 * anon key cannot read it either.
 *
 * Off unless CROWD_DWELL_SHADOW is set. A signal that is not shown should
 * not be collected silently just because the code shipped: enabling it is
 * a separate, revocable act.
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
  mandalId: z.string().uuid(),
  /**
   * The same opaque per-device value the crowd reports use. Never stored
   * here — see dwellDeviceKey.
   */
  deviceId: z.string().min(8).max(64),
  dwell: z.enum(['lingering', 'queueing']),
  dwellSeconds: z.number().int().min(0).max(86_399),
  /**
   * True only for the sample written when a visit ends, which is the one
   * row whose duration is a real observation rather than a threshold.
   * Defaults false so an older client cannot accidentally claim it.
   */
  isFinal: z.boolean().default(false),
});

export async function POST(request: Request) {
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

  if (process.env.CROWD_DWELL_SHADOW !== '1') {
    // 404 rather than 403: an endpoint that is off should not advertise
    // that it exists and might be turned on.
    return new NextResponse(null, { status: 404 });
  }

  // A device emits at most twice per mandal per visit, so anything beyond
  // a handful a minute is a script. Tighter than the report limiter
  // because there is no human tapping here to be inconvenienced.
  const limit = rateLimit(request, { key: 'crowd-dwell', limit: 10, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  // A device blocked for abusing crowd reports is blocked here too: it is
  // the same person, and this signal now moves the same colours. Checked
  // against the raw id, which is the last thing done with it — the block
  // list stays the only table where a device id lives.
  const { data: blocked } = await supabase
    .from('crowd_device_blocks')
    .select('device_id')
    .eq('device_id', parsed.data.deviceId)
    .maybeSingle();
  if (blocked) {
    // 204, not 403. A blocked caller learning it is blocked starts
    // rotating device ids; one that thinks it is being recorded does not.
    return new NextResponse(null, { status: 204 });
  }

  const { error } = await supabase.from('crowd_dwell_samples').insert({
    mandal_id: parsed.data.mandalId,
    dwell: parsed.data.dwell,
    dwell_seconds: parsed.data.dwellSeconds,
    is_final: parsed.data.isFinal,
    device_key: dwellDeviceKey(parsed.data.deviceId, parsed.data.mandalId),
  });

  // The client must never retry or surface this. A lost shadow sample
  // costs a little calibration precision and nothing else.
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  return new NextResponse(null, { status: 204 });
}
