import { NextResponse } from 'next/server';
import { getAllGanpatis } from '@/services/ganpati';
import { getCrowdStatuses, CrowdUnavailableError } from '@/services/crowd/crowd-service';
import { cachedJson, timed } from '@/services/crowd/crowd-http';
import { nearbyQuerySchema } from '@/services/crowd/crowd-validation';
import { haversine } from '@/lib/geo';

/**
 * Crowd state for mandals near a point.
 *
 * Coordinates are rounded to ~100m before use. Full precision would make
 * every request a distinct cache key — destroying the cache hit rate this
 * whole design depends on — and would write a caller's exact position into
 * CDN logs for no gain. 100m is far finer than the spacing between
 * mandals, so the result is identical.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ~110m of latitude; less in longitude at Pune's latitude. Good enough. */
const COORD_PRECISION = 3;

export async function GET(request: Request) {
  return timed(async () => {
    const params = new URL(request.url).searchParams;
    const parsed = nearbyQuerySchema.safeParse({
      lat: params.get('lat'),
      lng: params.get('lng'),
      radiusM: params.get('radiusM') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'invalid_request' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const origin = {
      lat: Number(parsed.data.lat.toFixed(COORD_PRECISION)),
      lng: Number(parsed.data.lng.toFixed(COORD_PRECISION)),
    };

    const ganpatis = await getAllGanpatis();
    const near = ganpatis
      .map((g) => ({
        g,
        distanceM: haversine(origin, { lat: g.location.lat, lng: g.location.lng }),
      }))
      .filter((x) => x.distanceM <= parsed.data.radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 25);

    if (near.length === 0) return cachedJson({ items: [] }, request);

    try {
      const statuses = await getCrowdStatuses(near.map((x) => x.g.id));
      const byId = new Map(statuses.map((s) => [s.mandalId, s]));

      return cachedJson(
        {
          items: near
            .map((x) => ({
              slug: x.g.slug,
              name: x.g.name,
              distanceM: Math.round(x.distanceM),
              crowd: byId.get(x.g.id) ?? null,
            }))
            .filter((x) => x.crowd !== null),
        },
        request
      );
    } catch (error) {
      if (error instanceof CrowdUnavailableError) {
        return NextResponse.json(
          { error: 'Crowd information temporarily unavailable' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      throw error;
    }
  });
}
