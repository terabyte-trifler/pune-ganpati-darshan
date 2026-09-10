import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeRoute, computeRouteMatrix } from '@/lib/maps/routes';
import { optimizeOrder } from '@/services/route-optimizer';
import { estimateMatrix } from '@/services/route-optimizer';
import { rateLimit } from '@/lib/rate-limit';
import { toTravelMode } from '@/db/database.types';

/**
 * Route computation proxy.
 *
 * The only thing that talks to a routing provider, which gives us one place
 * to rate-limit, cap cost and keep any routing key server-side. Degrades to
 * locally-estimated timings — clearly labelled as such — when no router is
 * reachable, so the planner keeps working offline.
 */

export const runtime = 'nodejs';

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * As many stops as a saved plan can hold.
 *
 * This used to be MAX_MATRIX_POINTS - 1, which is 9, and it was wrong in a
 * way that showed up as a mystery: the planner puts no limit on a darshan,
 * so adding a tenth mandal and tapping Optimise returned a bare
 * "Invalid request" with nothing to act on.
 *
 * The matrix limit is a property of ONE routing provider's table endpoint,
 * not of this request. Above ten points computeRouteMatrix declines and the
 * handler already orders the stops locally and labels the result
 * 'local-estimate' — the same honest degrade it does when the router is
 * unreachable. The schema was rejecting requests before that path could
 * run. 20 matches the cap on a shared plan, so the two agree.
 */
const MAX_STOPS = 20;

const bodySchema = z.object({
  origin: pointSchema,
  stops: z.array(pointSchema).min(1).max(MAX_STOPS),
  // Retired values are accepted and translated rather than rejected: an
  // older tab or a saved plan can still post 'drive'. Rejecting those
  // would 400 a request the app itself produced last week.
  mode: z
    .enum(['walk', 'two_wheeler', 'metro', 'drive', 'transit'])
    .transform(toTravelMode),
  optimize: z.boolean().default(true),
});

export async function POST(request: Request) {
  // Cheap abuse guard: this endpoint costs real money per call.
  const limit = rateLimit(request, { key: 'routes', limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many route requests. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterS) } }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    // "Invalid request" alone is unactionable — it was returned for a plan
    // that was merely too long, and read as a bug in the app. Say which
    // field failed, and say the common case in words.
    const issues = error instanceof z.ZodError ? error.issues : [];
    const tooManyStops = issues.some(
      (i) => i.path[0] === 'stops' && i.code === 'too_big'
    );
    return NextResponse.json(
      {
        error: tooManyStops
          ? `A darshan can hold up to ${MAX_STOPS} stops. Remove a few and try again.`
          : 'Invalid request',
        fields: issues.map((i) => i.path.join('.')).filter(Boolean),
      },
      { status: 400 }
    );
  }

  const { origin, stops, mode, optimize } = parsed;
  const points = [origin, ...stops];

  /* ---------------- Ordering ---------------- */
  let order = stops.map((_, i) => i);
  let optimizedBy: 'routes-matrix' | 'local-estimate' | 'none' = 'none';

  if (optimize && stops.length > 1) {
    // One matrix call, then the solver runs locally over the result — we
    // never call Google once per candidate ordering.
    const matrix = await computeRouteMatrix(points, mode);
    if (matrix.ok) {
      order = optimizeOrder(stops.length, matrix.data).order;
      optimizedBy = 'routes-matrix';
    } else {
      // Routes unavailable: still order the stops sensibly rather than
      // leaving the user with the arbitrary order they tapped them in.
      order = optimizeOrder(stops.length, estimateMatrix(points, mode)).order;
      optimizedBy = 'local-estimate';
    }
  }

  const orderedStops = order.map((i) => stops[i]);

  /* ---------------- Route geometry + totals ---------------- */
  const route = await computeRoute(origin, orderedStops, mode);

  if (!route.ok) {
    // 'unavailable' means we could not reach any router (offline, or the
    // public OSRM instance is down). Ordering above is still real, so return
    // it with estimated timings that the client labels as estimates rather
    // than failing the whole request.
    if (route.reason === 'unavailable') {
      // Honest degraded response: ordering is real, timings are estimates,
      // and the client labels them as such rather than implying Google data.
      const matrix = estimateMatrix([origin, ...orderedStops], mode);
      let durationS = 0;
      const legs: Array<{ distanceM: number; durationS: number }> = [];
      for (let i = 0; i < orderedStops.length; i++) {
        const d = matrix[i][i + 1];
        durationS += d;
        legs.push({ distanceM: 0, durationS: d });
      }
      return NextResponse.json({
        order,
        estimated: true,
        optimizedBy,
        distanceM: null,
        durationS: Math.round(durationS),
        geometry: null,
        provider: null,
        durationSource: 'derived' as const,
        legs,
      });
    }
    return NextResponse.json(
      { error: 'We couldn’t calculate this route.', reason: route.reason },
      { status: 502 }
    );
  }

  return NextResponse.json({
    order,
    estimated: false,
    optimizedBy,
    distanceM: route.data.distanceM,
    durationS: route.data.durationS,
    geometry: route.data.geometry,
    provider: route.data.provider,
    durationSource: route.data.durationSource,
    legs: route.data.legs,
  });
}
