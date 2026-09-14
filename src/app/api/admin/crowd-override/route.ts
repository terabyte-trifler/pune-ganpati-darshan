import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/services/auth';
import { setCrowdOverride, clearCrowdOverride } from '@/services/crowd/crowd-service';

/**
 * Set or clear an admin override.
 *
 * The authorization boundary for this feature. Middleware gates /admin
 * pages, but an API route is reachable directly, and this one can change
 * what every visitor in Pune sees — so it re-checks the session itself
 * (§27) rather than trusting anything upstream.
 *
 * `getSessionUser().isAdmin` requires both the database flag and the
 * email allowlist; see lib/admin-access for why it takes two.
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
  // null clears an override early; a level sets one.
  status: z.enum(['short', 'moving', 'long']).nullable(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    // 404, not 403: an endpoint only one account may use should not
    // confirm to anyone else that it exists.
    return new NextResponse(null, { status: 404 });
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

  const { mandalId, status } = parsed.data;

  const result =
    status === null
      ? await clearCrowdOverride(mandalId)
      : await setCrowdOverride({ mandalId, status, actor: user.email ?? 'unknown' });

  if (!result.success) {
    return NextResponse.json(result, { status: result.reason === 'cooldown' ? 429 : 400 });
  }
  return NextResponse.json(result);
}
