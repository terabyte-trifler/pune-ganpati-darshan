import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeRoute, computeRouteMatrix } from '@/lib/maps/routes';
import { optimizeOrder } from '@/services/route-optimizer';
import { estimateMatrix } from '@/services/route-optimizer';
import { MAX_PLAN_STOPS } from '@/lib/plan-limits';
import {
  walkGeometry, laneWalk, spliceLaneLegs, laneViaPoints,
} from '@/services/pedestrian-graph';
import {
  enforceOneWays, penaliseAgainstFlow, violatedLanes, laneExclusionPolygons,
  againstMetres,
} from '@/services/pedestrian-flow';
import { isOnFoot, walkedDurationSeconds } from '@/lib/geo';
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

/**
 * Next to the database. See the note on the root layout: the default is
 * iad1, Supabase answers from BOM, and each round trip was costing ~330ms
 * across the Pacific. Declared per route because the layout-level
 * declaration is not applied to route handlers.
 */
export const preferredRegion = 'bom1';

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/**
 * As many stops as a saved plan can hold.
 *
 * The matrix limit is a property of ONE routing provider's table
 * endpoint, not of this request. Above ten points computeRouteMatrix
 * declines and the handler orders the stops locally, labelling the result
 * 'local-estimate' — the same honest degrade it does when the router is
 * unreachable. A schema cap below that just rejects the request before
 * the degrade can run.
 *
 * So the cap comes from the catalogue: see lib/plan-limits. Somebody
 * planning every mandal in the city on one night is doing the thing this
 * app is for.
 */
const MAX_STOPS = MAX_PLAN_STOPS;

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
      // Google walks these lanes in both directions; the police do not.
      // optimizeOrder re-prices the festival flow on top of whatever the
      // router said, the same way it does for the local estimate below.
      order = optimizeOrder(points, matrix.data, mode).order;
      optimizedBy = 'routes-matrix';
    } else {
      // Routes unavailable: still order the stops sensibly rather than
      // leaving the user with the arbitrary order they tapped them in.
      order = optimizeOrder(points, estimateMatrix(points, mode), mode).order;
      optimizedBy = 'local-estimate';
    }
  }

  const orderedStops = order.map((i) => stops[i]);

  /* ---------------- Route geometry + totals ---------------- */
  /**
   * The lane points each leg must pass through.
   *
   * This is what makes the orange line sit on the blue one. Before it, the
   * route merely avoided walking a lane the wrong way; it had no reason to
   * walk one the right way, so it took whatever street was shortest and
   * the lanes went unused beside it.
   *
   * Indexed by arriving stop, so viaByLeg[i] belongs to the walk into
   * orderedStops[i-1]. Empty for legs the lanes say nothing about, which
   * is most of them.
   */
  const routePoints = [origin, ...orderedStops];
  const viaByLeg = isOnFoot(mode)
    ? routePoints.map((p, i) => (i === 0 ? [] : laneViaPoints(routePoints[i - 1], p)))
    : [];

  let route = await computeRoute(origin, orderedStops, mode, [], viaByLeg);

  /**
   * If the routed line walks a lane the wrong way, ask again without it.
   *
   * The router does not know these lanes and cannot be told — but every
   * router can be told to keep out of an area, and barring a lane in both
   * directions is the right answer for a walk that wanted to go up it: it
   * has to go round, on streets the router knows and we do not.
   *
   * This is what makes the rule hold for legs neither of whose ends
   * stands on a lane. Our own graph cannot reroute those; it is 1.3 km of
   * disconnected stretches with no surrounding network, so before this
   * they were simply left going the wrong way.
   *
   * It iterates because barring one lane can push the route onto another —
   * the first attempt cleared two and offended a third. Each pass adds
   * what the last one broke, and the best answer seen is kept rather than
   * insisting on a perfect one: fewer violations is a better route even
   * when it is not yet a clean one, and a router asked to avoid too much
   * eventually finds nothing at all.
   */
  if (isOnFoot(mode) && route.ok && route.data.geometry) {
    const barred = new Map<string, { path: [number, number][] }>();
    // Judged on metres walked against the crowd, not on how many lanes
    // were touched — see againstMetres.
    let best = { route, against: againstMetres(route.data.geometry) };

    for (let pass = 0; pass < 3 && best.against > 0; pass++) {
      const geometry = best.route.ok ? best.route.data.geometry : null;
      if (!geometry) break;
      for (const lane of violatedLanes(geometry)) barred.set(lane.name, lane);

      /**
       * Bar the corridor outright first; cut holes only if that fails.
       *
       * A solid bar is the stronger instruction and gives the better
       * answer — 725 m walked against the crowd across the curated routes,
       * against 1117 m when every exclusion had a gap at each stop, because
       * a gap is also a way back onto the lane.
       *
       * But a router cannot start or finish inside an area it is avoiding,
       * and Dagdusheth stands 1 m from Shivaji Road — so for those routes a
       * solid bar returns no path at all and the violation simply stays.
       * The holed version is the fallback for exactly that case, and it is
       * still only kept if it walks less against the crowd.
       */
      const attempts = [
        [...barred.values()].flatMap((lane) => laneExclusionPolygons(lane)),
        [...barred.values()].flatMap((lane) => laneExclusionPolygons(lane, routePoints)),
      ];

      let improved = false;
      for (const avoid of attempts) {
        const retry = await computeRoute(origin, orderedStops, mode, avoid, viaByLeg);
        if (!retry.ok || !retry.data.geometry) continue;
        const against = againstMetres(retry.data.geometry);
        if (against < best.against) {
          best = { route: retry, against };
          improved = true;
          break;
        }
      }
      if (!improved) break;
    }

    route = best.route;
  }

  /**
   * The lanes override the router on the legs they cover — the line and
   * the numbers together, or the plan says 716 m beside a line drawn 305 m
   * long and the reader has to decide which to believe.
   *
   * Ours is the truer figure here. The router's is longer because it does
   * not know the alley exists and goes round; the lane path is the road as
   * it was reported from the ground.
   *
   * Computed after the exclusion passes above, so it describes whichever
   * route actually survived them.
   */
  const laneLegs =
    isOnFoot(mode) && route.ok
      ? orderedStops.map((stop, i) =>
          laneWalk(i === 0 ? origin : orderedStops[i - 1], stop)
        )
      : [];

  if (!route.ok) {
    // 'unavailable' means we could not reach any router (offline, or the
    // public OSRM instance is down). Ordering above is still real, so return
    // it with estimated timings that the client labels as estimates rather
    // than failing the whole request.
    if (route.reason === 'unavailable') {
      // Honest degraded response: ordering is real, timings are estimates,
      // and the client labels them as such rather than implying Google data.
      // Priced the same way the ordering was, so the per-leg times a
      // visitor reads add up to the order they were given rather than to
      // a straight line nobody walks.
      const points = [origin, ...orderedStops];
      const matrix = penaliseAgainstFlow(estimateMatrix(points, mode), points, mode);
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
    distanceM: Math.round(
      route.data.legs.reduce(
        (sum, leg, i) => sum + (laneLegs[i]?.metres ?? leg.distanceM),
        0
      )
    ),
    durationS: Math.round(
      route.data.legs.reduce(
        (sum, leg, i) =>
          sum +
          (laneLegs[i]
            ? walkedDurationSeconds(laneLegs[i]!.metres, mode)
            : leg.durationS),
        0
      )
    ),
    // On foot: the lanes where they apply, the router everywhere else.
    //
    // The lanes always win on the legs they cover — the router does not
    // know them and can draw the wrong way up one. But they are five short
    // stretches in the peths, and Kasba to Bhausaheb Rangari touches none
    // of them; drawing that straight puts a line through the buildings
    // instead of down Shivaji Road. Falling back to our own straight lines
    // only when the router gave us nothing at all.
    // On foot: the lanes where they apply, the router everywhere else,
    // and then a final pass that makes whatever is left obey the one-ways.
    // The splice only fires when both ends of a leg stand on the network,
    // which five of sixteen peth mandals do; enforceOneWays catches the
    // rest — a leg that merely PASSES along a lane without either end
    // being on it.
    geometry:
      !isOnFoot(mode)
        ? route.data.geometry
        : enforceOneWays(
            route.data.geometry
              ? spliceLaneLegs(route.data.geometry, [origin, ...orderedStops])
              : walkGeometry([origin, ...orderedStops])
          ),
    provider: route.data.provider,
    durationSource: route.data.durationSource,
    legs: route.data.legs.map((leg, i) =>
      laneLegs[i]
        ? {
            distanceM: Math.round(laneLegs[i]!.metres),
            durationS: Math.round(walkedDurationSeconds(laneLegs[i]!.metres, mode)),
          }
        : leg
    ),
  });
}
