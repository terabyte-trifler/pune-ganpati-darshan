import { NextResponse } from 'next/server';
import { z } from 'zod';
import { computeRoute, computeRouteMatrix } from '@/lib/maps/routes';
import { optimizeOrder } from '@/services/route-optimizer';
import { estimateMatrix } from '@/services/route-optimizer';
import { MAX_PLAN_STOPS } from '@/lib/plan-limits';
import {
  walkGeometry, laneWalk, spliceLaneLegs, laneViaPoints, laneDetourVia,
  laneEntriesTo, laneDetoursInto, cutAtStops,
} from '@/services/pedestrian-graph';
import {
  enforceOneWays, penaliseAgainstFlow, violatedLanes, laneExclusionPolygons,
  againstMetres,
} from '@/services/pedestrian-flow';
import { isOnFoot, walkedDurationSeconds } from '@/lib/geo';
import { rateLimit } from '@/lib/rate-limit';
import { toTravelMode } from '@/db/database.types';
import { routeStats, type RouteStats } from '@/lib/maps/route-stats';
import { mapLimit, ROUTER_CONCURRENCY } from '@/lib/maps/concurrency';

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
  // Every response carries what it cost upstream, so a slow plan can be
  // read rather than guessed at: Server-Timing shows the number of router
  // calls and the time spent waiting for them.
  const stats: RouteStats = { calls: 0, upstreamMs: 0, hits: 0 };
  const started = Date.now();
  const response = await routeStats.run(stats, () => handle(request));
  response.headers.set(
    'Server-Timing',
    [
      `total;dur=${Date.now() - started}`,
      `upstream;dur=${stats.upstreamMs}`,
      `calls;desc="${stats.calls}"`,
      `cache_hits;desc="${stats.hits}"`,
    ].join(', ')
  );
  return response;
}

async function handle(request: Request) {
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
    ? routePoints.map((p, i) => {
        if (i === 0) return [];
        const from = routePoints[i - 1];
        /**
         * A leg with no legal straight answer is sent the way round.
         *
         * The exclusion retries below cannot rescue these: bar the lanes
         * through the peth core and the router returns no path at all,
         * because as far as OSM is concerned those lanes are the streets.
         * Walling it off leaves it nowhere to go, so it has to be handed
         * the way round instead — see content/lane-detours.
         *
         * Checked before laneViaPoints rather than merged with it. These
         * are exactly the legs laneWalk has no answer for, so there is
         * nothing to merge, and a detour's waypoints already pass through
         * whatever lanes the legal walk uses.
         */
        const detour = laneDetourVia(from, p);
        return detour.length ? detour : laneViaPoints(from, p);
      })
    : [];

  const route = await computeRoute(origin, orderedStops, mode, [], viaByLeg);

  /**
   * The whole-route exclusion pass used to live here, and is gone.
   *
   * It re-asked the router for the ENTIRE plan with the offending lanes
   * barred, up to four times, each pass depending on the last — so it could
   * not be made parallel and it cost a leg's latency several times over.
   * It predates both the precomputed ways round in content/lane-detours
   * and the per-leg repair below, and by the time those existed it was
   * finding nothing they had not already fixed.
   *
   * Measured before removing it, over the same fifteen plans across the
   * peths: 60 m walked against the crowd with it, 60 m without, one dirty
   * plan either way — and 600 m less walking without, because barring a
   * lane for a whole plan also bars the legs legitimately walking down it.
   * What it cost was the wall clock: eight stops 2,280 ms to 11 ms,
   * fifteen stops 7,900 ms to 569 ms.
   *
   * If a future change makes per-leg repair insufficient, the answer is to
   * fix the leg, not to bar a road for a whole plan on its behalf.
   */

  /**
   * Fix the offending legs one at a time, not the whole route at once.
   *
   * A one-way belongs to a road and to a direction along it — both, and
   * that is the whole difficulty. The road is fixed; which way a walk uses
   * it is not, and a plan can use the same road twice in opposite
   * directions.
   *
   * Everything above bars a lane for the ENTIRE plan, so barring Shivaji
   * Road to fix the leg walking up it also bars the legs legitimately
   * walking down it. The retry then measures the whole plan as worse and
   * keeps the original, which is why a walk from Bhausaheb Rangari to
   * Kasba kept its 126 m up the one-way however many passes it was given.
   *
   * The lane data is where the road and its direction live. What has to be
   * decided leg by leg is only whether THIS leg travels it the wrong way.
   *
   * Each leg is asked separately, with only the lanes that leg offends
   * barred, and only legs that offend pay for a request. A leg is kept
   * only if it comes back walking less against the crowd; a leg that has
   * no legal alternative keeps the line it had.
   */
  if (isOnFoot(mode) && route.ok && route.data.geometry) {
    const line = route.data.geometry;
    const cuts = cutAtStops(line, routePoints);
    const legGeometry = routePoints.slice(1).map((_, k) =>
      line.slice(cuts[k], cuts[k + 1] + 1)
    );

    let changed = false;

    /**
     * Each offending leg repaired at the same time as the others.
     *
     * A leg's repair depends only on that leg: its own geometry, the lanes
     * it offends, the ways round into its own destination. They were being
     * awaited one after another, so a plan with four bad legs paid for four
     * rounds of retries end to end — and measured on this route, 97% of the
     * wall clock is time spent waiting on a router rather than computing.
     *
     * Capped by mapLimit for the reason given there: the default router is
     * a public instance and a plan should not arrive at it as a flood.
     */
    const dirtyLegs = legGeometry
      .map((_, k) => k)
      .filter((k) => violatedLanes(legGeometry[k]).length > 0);

    const repairs = await mapLimit(dirtyLegs, ROUTER_CONCURRENCY, async (k: number) => {
      const from = routePoints[k];
      const to = routePoints[k + 1];
      let best = { against: againstMetres(legGeometry[k]), leg: null as null | { geometry: [number, number][]; distanceM: number; durationS: number } };
      const barred = new Map<string, { path: [number, number][] }>();

      /**
       * Take the cleanest answer, not the first improvement, and keep
       * asking while the leg is still dirty.
       *
       * This took the first attempt that was any better and stopped. On
       * the first leg of great-peth-circuit that meant settling for 70 m
       * against when a wholly clean line existed — and barring one lane
       * pushes a leg onto another, so a pass that only half-helps still
       * tells you what to bar next.
       */
      /**
       * Try coming in the way the crowd is fed in, before barring anything.
       *
       * A stop at the end of a one-way lane has one legal approach, and a
       * leg that arrives any other way is walking up the lane. Barring the
       * lane does not fix that — it leaves the router nowhere to go — but
       * sending it round to the entrance does.
       *
       * This is the same correction the detour table applies, for legs the
       * table has no row for. It cannot have one for every case: the table
       * was built a pair at a time, and a pair routed on its own is not
       * the same walk as the same pair inside a plan. Akhil Mandai to
       * Tulshibaug on its own comes round by Guruji Talim; with Jilbya
       * Maruti as the next stop, the router cuts up the Jilbya lane to
       * save the corner, and walks 119 m against the crowd doing it.
       *
       * Kept only if it comes back cleaner, like every other attempt here.
       */
      const ways = [
        ...laneEntriesTo(to).map((entry) => [entry]),
        ...laneDetoursInto(from, to),
      ];
      for (const via of ways) {
        if (best.against <= 0) break;
        const attempt = await computeRoute(from, [to], mode, [], [[], via]);
        if (!attempt.ok || !attempt.data.geometry) continue;
        const against = againstMetres(attempt.data.geometry);
        if (against < best.against) {
          best = {
            against,
            leg: {
              geometry: attempt.data.geometry,
              distanceM: attempt.data.distanceM,
              durationS: attempt.data.durationS,
            },
          };
        }
      }

      for (let pass = 0; pass < 3 && best.against > 0; pass++) {
        const source = best.leg?.geometry ?? legGeometry[k];
        const before = barred.size;
        for (const lane of violatedLanes(source)) barred.set(lane.name, lane);
        if (barred.size === before && pass > 0) break;

        for (const keepClear of [[], [from, to]]) {
          const attempt = await computeRoute(from, [to], mode,
            [...barred.values()].flatMap((lane) => laneExclusionPolygons(lane, keepClear)));
          if (!attempt.ok || !attempt.data.geometry) continue;

          const against = againstMetres(attempt.data.geometry);
          if (against < best.against) {
            best = {
              against,
              leg: {
                geometry: attempt.data.geometry,
                distanceM: attempt.data.distanceM,
                durationS: attempt.data.durationS,
              },
            };
          }
        }
      }

      if (best.leg) {
        legGeometry[k] = best.leg.geometry;
        route.data.legs[k] = {
          distanceM: best.leg.distanceM,
          durationS: best.leg.durationS,
        };
        changed = true;
      }
    
      return best.leg;
    });

    dirtyLegs.forEach((k, i) => {
      const leg = repairs[i];
      if (!leg) return;
      legGeometry[k] = leg.geometry;
      route.data.legs[k] = { distanceM: leg.distanceM, durationS: leg.durationS };
      changed = true;
    });

    if (changed) {
      const stitched: [number, number][] = [];
      for (const leg of legGeometry) {
        for (const point of leg) {
          const last = stitched[stitched.length - 1];
          if (!last || last[0] !== point[0] || last[1] !== point[1]) stitched.push(point);
        }
      }
      route.data.geometry = stitched;
      route.data.distanceM = route.data.legs.reduce((sum, l) => sum + l.distanceM, 0);
      route.data.durationS = route.data.legs.reduce((sum, l) => sum + l.durationS, 0);
    }
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
