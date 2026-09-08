import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Analytics ingest.
 *
 * Writes with the service-role client because `analytics_events` allows
 * inserts but not reads — the browser must never be able to read the event
 * stream back, and RLS enforces that (§40).
 *
 * Nothing here stores personal data: no IP, no user id, no free text
 * beyond a truncated search term.
 */

export const runtime = 'nodejs';

const EVENT_NAMES = [
  'map_opened', 'ganpati_viewed', 'search_performed', 'search_no_results',
  'directions_clicked', 'favorite_added', 'favorite_removed', 'plan_created',
  'plan_started', 'plan_optimized', 'share_clicked', 'location_enabled',
] as const;

const bodySchema = z.object({
  sessionId: z.string().max(64).optional(),
  events: z.array(
    z.object({
      name: z.enum(EVENT_NAMES),
      ganpatiId: z.string().uuid().optional(),
      props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
    })
  ).min(1).max(20),
});

export async function POST(request: Request) {
  const limit = rateLimit(request, { key: 'analytics', limit: 60, windowMs: 60_000 });
  if (!limit.allowed) {
    // Analytics is best-effort: drop silently rather than surface an error.
    return new NextResponse(null, { status: 204 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Without Supabase configured there is nowhere to write. Accept and drop,
  // so the client never sees an error for a non-essential feature.
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('analytics_events').insert(
      parsed.events.map((e) => ({
        name: e.name,
        session_id: parsed.sessionId ?? null,
        ganpati_id: e.ganpatiId ?? null,
        props: e.props ?? {},
      }))
    );
  } catch {
    // Never fail a user action because analytics is down.
  }

  return new NextResponse(null, { status: 204 });
}
