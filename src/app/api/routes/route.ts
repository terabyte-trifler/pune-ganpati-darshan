import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeRoute, computeRouteMatrix, MAX_MATRIX_POINTS } from '@/lib/maps/routes';
import { optimizeOrder } from '@/services/route-optimizer';
import { estimateMatrix } from '@/services/route-optimizer';
import { rateLimit } from '@/lib/rate-limit';

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

const bodySchema = z.object({
  origin: pointSchema,
  stops: z.array(pointSchema).min(1).max(MAX_MATRIX_POINTS - 1),
  mode: z.enum(['walk', 'two_wheeler', 'drive', 'transit']),
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
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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
