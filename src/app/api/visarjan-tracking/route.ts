import { NextResponse } from 'next/server';
import { getTrackingSnapshot } from '@/services/visarjan-tracking';

/**
 * Live procession status, proxied from the Pune Police tracker.
 *
 * A proxy rather than a client-side fetch, for three reasons. Their
 * server sees one caller instead of one per visitor; the response is
 * cached for 45 seconds upstream of everyone, so twelve thousand readers
 * cost the police eighty requests an hour; and their API sets no CORS
 * headers, so a browser could not read it directly even if we wanted it
 * to.
 *
 * Answers `{ ready: false }` until the feed carries a named mandal. See
 * services/visarjan-tracking.ts: before the day starts every row is a
 * placeholder, and rendering those would be worse than rendering nothing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Their server is in India and so is almost every reader of this. */
export const preferredRegion = 'bom1';

export async function GET() {
  const snapshot = await getTrackingSnapshot();

  return NextResponse.json(snapshot, {
    headers: {
      // Matches the upstream life of the data. A visitor may hold it for
      // 45 seconds; a shared cache may serve a slightly older copy while
      // it fetches a fresh one, which is the right trade for a position
      // that moves at walking pace.
      'Cache-Control': 'public, max-age=45, s-maxage=45, stale-while-revalidate=60',
    },
  });
}
