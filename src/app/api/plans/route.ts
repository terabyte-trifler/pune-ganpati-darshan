import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { features } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Persists a darshan plan and returns a short share id.
 *
 * Written with the service-role client because anonymous visitors must be
 * able to share a plan — RLS only permits inserts where `user_id = auth.uid()`,
 * which by definition excludes them. The row is still attributed to the
 * signed-in user when there is one, so it appears in their saved plans.
 */

export const runtime = 'nodejs';

const bodySchema = z.object({
  title: z.string().min(1).max(120).default('My Darshan'),
  mode: z.enum(['walk', 'two_wheeler', 'drive', 'transit']).default('walk'),
  slugs: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(20),
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().max(120).optional(),
  }).optional(),
});

/** URL-safe, unguessable, and short enough to share by message. */
function makeShareId() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export async function POST(request: Request) {
  const limit = rateLimit(request, { key: 'plans', limit: 12, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many plans created. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterS) } }
    );
  }

  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // The client falls back to a stateless ?stops= link, which still works.
    return NextResponse.json({ error: 'Plan storage is not configured' }, { status: 501 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Attribute to the signed-in user when there is one.
  let userId: string | null = null;
  const userClient = await getSupabaseServerClient();
  if (userClient) {
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  }

  const supabase = getSupabaseAdminClient();

  // Resolve slugs, and preserve the order the user arranged them in.
  const { data: ganpatis, error: lookupError } = await supabase
    .from('ganpatis').select('id, slug').in('slug', parsed.slugs);
  if (lookupError) {
    return NextResponse.json({ error: 'Could not save this plan' }, { status: 502 });
  }
  const idBySlug = new Map((ganpatis ?? []).map((g) => [g.slug, g.id]));
  const ordered = parsed.slugs
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is string => Boolean(id));

  if (ordered.length === 0) {
    return NextResponse.json({ error: 'No recognisable mandals in this plan' }, { status: 400 });
  }

  const shareId = makeShareId();
  const { data: plan, error: planError } = await supabase
    .from('darshan_plans')
    .insert({
      share_id: shareId,
      user_id: userId,
      title: parsed.title,
      mode: parsed.mode,
      origin_lat: parsed.origin?.lat ?? null,
      origin_lng: parsed.origin?.lng ?? null,
      origin_label: parsed.origin?.label ?? null,
      is_public: true,
    })
    .select('id, share_id')
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: 'Could not save this plan' }, { status: 502 });
  }

  const { error: stopsError } = await supabase.from('darshan_plan_stops').insert(
    ordered.map((ganpatiId, position) => ({
      plan_id: plan.id, ganpati_id: ganpatiId, position,
    }))
  );

  if (stopsError) {
    // Do not leave a plan with no stops behind.
    await supabase.from('darshan_plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: 'Could not save this plan' }, { status: 502 });
  }

  return NextResponse.json({ shareId: plan.share_id, stops: ordered.length }, { status: 201 });
}
