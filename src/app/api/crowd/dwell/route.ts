import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Record a passive dwell sample. Shadow mode.
 *
 * Deliberately the thinnest endpoint in the app. It takes a mandal id, a
 * class and a duration, and writes a row that identifies nobody — see the
 * migration header for why it is device-less, and for the note that the
 * decision does not survive the signal being displayed.
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

const bodySchema = z.object({
  mandalId: z.string().uuid(),
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

  const { error } = await supabase.from('crowd_dwell_samples').insert({
    mandal_id: parsed.data.mandalId,
    dwell: parsed.data.dwell,
    dwell_seconds: parsed.data.dwellSeconds,
    is_final: parsed.data.isFinal,
  });

  // The client must never retry or surface this. A lost shadow sample
  // costs a little calibration precision and nothing else.
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  return new NextResponse(null, { status: 204 });
}
