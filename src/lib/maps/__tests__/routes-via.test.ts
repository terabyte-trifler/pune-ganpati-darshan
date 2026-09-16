import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeRoute } from '@/lib/maps/routes';
import { localGanpatis } from '@/services/catalogue';
import type { LatLng } from '@/lib/geo';

/**
 * The lane waypoints have to survive into the request.
 *
 * They were being dropped on any route with ten stops or more — the
 * allowance handed out was MAX_LOCATIONS minus the number of stops, which
 * goes negative there, so every leg got zero. It made sense when a route
 * was a single request; it has not been one since the chunking arrived,
 * and the effect was that the one-way lanes were silently switched off on
 * exactly the long walks that need them most.
 *
 * Nothing caught it because the per-leg repair in /api/routes re-routes a
 * leg on its own, where the allowance is positive, so the worst legs were
 * being rescued after the fact and the total still looked plausible.
 */
describe('lane waypoints in a long request', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Every location Valhalla was asked for, across all chunks. */
  async function locationsSentFor(stops: LatLng[], viaByLeg: LatLng[][]) {
    const sent: Array<Array<Record<string, unknown>>> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      // The Valhalla route request is a GET with the payload in the query
      // string, so that Next's Data Cache can cache it at all.
      const query = new URL(String(url)).searchParams.get('json');
      const payload = query ? JSON.parse(query) : JSON.parse(String(init?.body ?? '{}'));
      if (payload.locations) sent.push(payload.locations);
      // Enough of a trip to be accepted, with a shape we never read.
      return new Response(JSON.stringify({
        trip: { summary: { length: 1, time: 1 }, legs: [{ shape: '_p~iF~ps|U', summary: { length: 1, time: 1 } }] },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    await computeRoute(stops[0], stops.slice(1), 'walk', [], viaByLeg);
    return sent;
  }

  const at = (slug: string) => {
    const g = localGanpatis.find((x) => x.slug === slug)!;
    return { lat: g.location.lat, lng: g.location.lng };
  };

  it('keeps them on a twelve-stop walk, where the old allowance went negative', async () => {
    const stops = localGanpatis.slice(0, 12).map((g) => g.location);
    // One waypoint on the walk into every stop but the first.
    const via = stops.map((_, i) => (i === 0 ? [] : [at('guruji-talim')]));
    const chunks = await locationsSentFor(stops, via);

    const through = chunks.flat().filter((l) => l.type === 'through');
    expect(through.length, 'the lanes were dropped before the request was built').toBe(11);
  });

  it('never sends a chunk over the limit, and never ends one mid-leg', async () => {
    const stops = localGanpatis.slice(0, 12).map((g) => g.location);
    const via = stops.map((_, i) => (i === 0 ? [] : [at('guruji-talim'), at('tulshibaug-ganpati')]));
    const chunks = await locationsSentFor(stops, via);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(10);
      // A through-point cannot start or finish a request.
      expect(chunk[0].type).toBeUndefined();
      expect(chunk[chunk.length - 1].type).toBeUndefined();
    }
  });

  it('sends a through-point exactly as measured, and rounds the stops', async () => {
    // Eleven metres of rounding is enough to put a waypoint on the wrong
    // side of a lane, so these go unrounded while stops stay bucketed.
    const stops = [at('kasba-ganpati'), at('tulshibaug-ganpati')];
    const guruji = at('guruji-talim');
    const [chunk] = await locationsSentFor(stops, [[], [guruji]]);

    const through = chunk.find((l) => l.type === 'through')!;
    expect(through.lat).toBe(guruji.lat);
    expect(through.lon).toBe(guruji.lng);
    const stop = chunk.find((l) => l.type === undefined)!;
    expect(String(stop.lat).split('.')[1].length).toBeLessThanOrEqual(4);
  });
});
