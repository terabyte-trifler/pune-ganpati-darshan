import { NextResponse } from 'next/server';
import { getCrowdSnapshot, CrowdUnavailableError } from '@/services/crowd/crowd-service';
import { cachedJson, timed } from '@/services/crowd/crowd-http';

/**
 * The whole city's crowd state in one response.
 *
 * This is the primary read path, and it exists because the catalogue is
 * small: every mandal's status is ~2KB in total, so the map, the homepage
 * and the cards can share ONE cached response instead of issuing a request
 * per marker. It is both faster for the user and cheaper for the origin
 * than any per-mandal scheme, and it means a popular mandal is served by
 * the same cache entry as an obscure one (§25).
 *
 * The per-mandal and batch endpoints below exist for callers that want a
 * subset; all of them are served from this same aggregate.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return timed(async () => {
    try {
      const snapshot = await getCrowdSnapshot();
      return cachedJson(snapshot, request, {
        // A stale snapshot is already being served past its useful life;
        // let the CDN revalidate sooner rather than pin it.
        sMaxAge: snapshot.stale ? 5 : undefined,
      });
    } catch (error) {
      if (error instanceof CrowdUnavailableError) {
        // 503, not an empty snapshot: the client must be able to tell
        // "unavailable" from "nobody has reported" (§33, §55).
        return NextResponse.json(
          { error: 'Crowd information temporarily unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      throw error;
    }
  });
}
