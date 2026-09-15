import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';
import {
  bearingDeg, bearingDifference, metresToPath,
  type LatLng, type TravelMode,
} from '@/lib/geo';

/**
 * The crowd only flows one way down some lanes, and a route has to know.
 *
 * Every distance in this app is symmetric — Dagdusheth to Tulshibaug is
 * the same 200 metres as Tulshibaug to Dagdusheth — and during the
 * festival that is simply false. The police make the crowd itself
 * one-directional through the narrowest stretches, which is how a lane a
 * few metres wide carries lakhs of people without a crush. Walk with it
 * and you move; try to walk back up it and you cannot.
 *
 * So a walking leg that runs against the flow is not the same length as
 * the one that runs with it: you have to come round. The app cannot see
 * the streets you would come round by, so it prices the detour rather
 * than pretending to route it — the same choice made for closed roads on
 * the two-wheeler side, and for the same reason.
 */

/**
 * How far from the stretch a leg still counts as using it.
 *
 * These lanes are narrow and the mandals sit on them, so this is tighter
 * than the vehicle corridor: at 150 m every leg in the peth core would
 * match something.
 */
export const FLOW_CORRIDOR_M = 45;

/**
 * How far off the permitted bearing still counts as "with the flow".
 *
 * Generous. A leg between two mandals a hundred metres apart rarely runs
 * exactly along the lane, and the question is only which way you are
 * broadly heading.
 */
export const FLOW_TOLERANCE_DEG = 70;

/** What it costs to walk a leg that has to come round. */
export const AGAINST_FLOW_FACTOR = 1.6;

/** Points along a leg, so a corridor is tested rather than two ends. */
function sample(a: LatLng, b: LatLng, steps = 12): LatLng[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    lat: a.lat + ((b.lat - a.lat) * i) / steps,
    lng: a.lng + ((b.lng - a.lng) * i) / steps,
  }));
}

/**
 * Whether a leg travels ALONG a stretch rather than merely touching it.
 *
 * Every sampled point has to sit in the corridor, not just one. Almost
 * every walk in the peths starts or ends on one of these roads — a rule
 * that accepted a single point inside the corridor charged a walker for
 * stepping off the lane towards Tulshibaug.
 */
function runsAlong(points: LatLng[], path: [number, number][]): boolean {
  return points.every((p) => metresToPath(p, path) <= FLOW_CORRIDOR_M);
}

/**
 * The one-way stretch this leg runs against, if any.
 *
 * A leg counts as using a stretch when its whole middle stays inside the
 * corridor — the middle, not an end point, because almost every leg in
 * the peths STARTS or ENDS on one of these lanes without travelling along
 * it. That is what separates "walked down it" from "stood beside it".
 */
export function legAgainstFlow(from: LatLng, to: LatLng) {
  const heading = bearingDeg(from, to);
  const middle = sample(from, to).slice(3, -3);

  return (
    PEDESTRIAN_ONE_WAYS.find((w) => {
      if (!runsAlong(middle, w.path)) return false;
      return bearingDifference(heading, w.bearingDeg) > 180 - FLOW_TOLERANCE_DEG;
    }) ?? null
  );
}

/** Every one-way stretch a finished route walks along, in order. */
export function flowsOnRoute(points: LatLng[]): typeof PEDESTRIAN_ONE_WAYS {
  const seen = new Set<string>();
  const out: typeof PEDESTRIAN_ONE_WAYS = [];
  for (let i = 0; i < points.length - 1; i++) {
    const heading = bearingDeg(points[i], points[i + 1]);
    const middle = sample(points[i], points[i + 1]).slice(3, -3);
    for (const w of PEDESTRIAN_ONE_WAYS) {
      // Deduplicated on the note, not the name: two of these are one road
      // above the fork, and a walker should be told once.
      if (seen.has(w.note)) continue;
      if (runsAlong(middle, w.path) &&
          bearingDifference(heading, w.bearingDeg) <= FLOW_TOLERANCE_DEG) {
        seen.add(w.note);
        out.push(w);
      }
    }
  }
  return out;
}

/**
 * What one leg costs relative to its straight-line time.
 *
 * Exported so a plan's per-leg minutes come from the same rule the
 * ordering was made against — a route that shows 3 minutes for a leg it
 * priced at 5 has quietly stopped describing itself.
 */
export function legCostFactor(from: LatLng, to: LatLng, mode: TravelMode): number {
  if (mode !== 'walk') return 1;
  return legAgainstFlow(from, to) ? AGAINST_FLOW_FACTOR : 1;
}

/**
 * Re-price a walking matrix so legs that run against the crowd cost more.
 *
 * Applied to whatever matrix we have — the local estimate or Google's —
 * because neither knows about this. These are not OSM one-ways; they are
 * police crowd-control for the twelve days, invisible to any router.
 *
 * Only `walk`. A rider is on the diverted road network already, and the
 * closures handle that lane.
 */
export function penaliseAgainstFlow(
  matrix: number[][],
  points: LatLng[],
  mode: TravelMode
): number[][] {
  if (mode !== 'walk') return matrix;
  return matrix.map((row, i) =>
    row.map((cost, j) =>
      i === j || !Number.isFinite(cost) || !legAgainstFlow(points[i], points[j])
        ? cost
        : cost * AGAINST_FLOW_FACTOR
    )
  );
}
