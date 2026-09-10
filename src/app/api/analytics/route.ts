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
 *
 * Origin is recorded at city grain and no finer. Vercel resolves the
 * requester's IP into geolocation headers before the request arrives, and
 * this reads only country, region and city from them. Latitude, longitude
 * and postal code are available on the same request and are deliberately
 * ignored: a postal code alongside a session id and a timestamp describes
 * a household, which is a different promise than the one
 * docs/03-security.md makes.
 *
 * The IP itself is never read here at all — only the derived headers.
 */

/**
 * Geolocation from the platform, never from the client.
 *
 * A browser cannot be asked where it is for this: it would be trivially
 * spoofable and would also mean prompting for location to collect
 * analytics, which is not a trade worth making. These headers are set by
 * Vercel ahead of the function and are absent in local development, where
 * every column simply stays null.
 */
function originFrom(request: Request): {
  country: string | null;
  region: string | null;
  city: string | null;
} {
  const get = (name: string) => {
    const raw = request.headers.get(name);
    return raw && raw.trim() !== '' ? raw.trim() : null;
  };

  const city = get('x-vercel-ip-city');
  return {
    country: get('x-vercel-ip-country'),
    region: get('x-vercel-ip-country-region'),
    // Vercel percent-encodes this header (RFC3986), so "Bengaluru" arrives
    // intact but anything with a non-ASCII character arrives as escapes.
    // decodeURIComponent throws on a malformed sequence, and analytics must
    // never be the reason a request fails.
    city: city ? safeDecode(city) : null,
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

export const runtime = 'nodejs';

const EVENT_NAMES = [
  'map_opened', 'ganpati_viewed', 'search_performed', 'search_no_results',
  'directions_clicked', 'favorite_added', 'favorite_removed', 'plan_created',
  'plan_started', 'plan_optimized', 'share_clicked', 'location_enabled',
] as const;

const bodySchema = z.object({
  sessionId: z.string().max(64).optional(),
  /**
   * Host only — the client strips it before sending. A full referrer URL
   * carries search terms and private group links, which is how an
   * analytics table ends up holding things nobody meant to send.
   */
  referrerHost: z.string().max(120).optional(),
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

  const origin = originFrom(request);

  try {
    const supabase = getSupabaseAdminClient();
    await supabase.from('analytics_events').insert(
      parsed.events.map((e) => ({
        name: e.name,
        session_id: parsed.sessionId ?? null,
        ganpati_id: e.ganpatiId ?? null,
        props: e.props ?? {},
        ...origin,
        referrer_host: parsed.referrerHost ?? null,
      }))
    );
  } catch {
    // Never fail a user action because analytics is down.
  }

  return new NextResponse(null, { status: 204 });
}
