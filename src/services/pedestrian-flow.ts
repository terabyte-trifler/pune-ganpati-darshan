import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';
import { laneWalk, touchesLanes } from '@/services/pedestrian-graph';
import {
  bearingDeg, bearingDifference, metresToPath, haversine, isOnFoot,
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
 * The direction the crowd moves at one point on a stretch.
 *
 * Read off the nearest segment of the drawn path, not from a number
 * stored beside it. These lanes bend — one of them turns 81° in the
 * middle — and a single bearing for a whole stretch is wrong for half of
 * it, in a way nothing can catch because the number and the geometry are
 * maintained by hand in two places.
 *
 * Paths are a handful of points, so the linear scan is cheaper than the
 * bookkeeping that would avoid it.
 */
export function flowBearingAt(point: LatLng, path: [number, number][]): number | null {
  let best = Infinity;
  let bearing: number | null = null;
  for (let i = 0; i < path.length - 1; i++) {
    const pair: [number, number][] = [path[i], path[i + 1]];
    const d = metresToPath(point, pair);
    if (d < best) {
      best = d;
      bearing = bearingDeg(
        { lat: path[i][1], lng: path[i][0] },
        { lat: path[i + 1][1], lng: path[i + 1][0] }
      );
    }
  }
  return bearing;
}

/** Middle value, so one sample taken at a bend cannot decide a leg. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * How far a leg's heading departs from the crowd's, along a stretch.
 *
 * Compared segment by segment and then taken at the median: a leg that
 * rounds a bend disagrees sharply with one segment and agrees with the
 * next, and neither of those alone describes the walk.
 */
function departureFromFlow(
  heading: number,
  samples: LatLng[],
  path: [number, number][]
): number {
  const diffs = samples
    .map((p) => flowBearingAt(p, path))
    .filter((b): b is number => b !== null)
    .map((b) => bearingDifference(heading, b));
  return diffs.length === 0 ? 0 : median(diffs);
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
      return departureFromFlow(heading, middle, w.path) > 180 - FLOW_TOLERANCE_DEG;
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
          departureFromFlow(heading, middle, w.path) <= FLOW_TOLERANCE_DEG) {
        seen.add(w.note);
        out.push(w);
      }
    }
  }
  return out;
}

/**
 * What a leg costs when the lane network has an opinion about it.
 *
 * The corridor rule above only ever sees the straight line between two
 * stops, which misses the case that matters most: a leg whose straight
 * line lies on no lane at all, because it cuts across the block, but
 * whose real walk has to go round on lanes that only run one way.
 * Tulshibaug to Dagdusheth is exactly that — 149 m as the crow flies, on
 * no lane, and no legal walk in that direction whatsoever.
 *
 *   a route exists  -> what it really costs, which is its length over the
 *                      straight line (Dagdusheth to Tulshibaug is 305 m
 *                      of walking for 149 m of separation)
 *   none exists     -> NO_ROUTE_FACTOR, so the optimiser turns the pair
 *                      round rather than sending somebody up a lane the
 *                      police will not let them up
 *   not on the network -> 1, which is nearly every leg in the city
 *
 * Not Infinity for the second case. People do get between these two
 * mandals; they just cannot do it the short way, and calling the leg
 * impassable would drop the stop out of the plan rather than reorder it.
 */
const NO_ROUTE_FACTOR = 4;

function graphCostFactor(from: LatLng, to: LatLng): number {
  if (!touchesLanes(from) || !touchesLanes(to)) return 1;
  const walk = laneWalk(from, to);
  if (!walk) return NO_ROUTE_FACTOR;
  const straight = haversine(from, to);
  return straight > 0 ? Math.max(1, walk.metres / straight) : 1;
}

/**
 * What one leg costs relative to its straight-line time.
 *
 * Exported so a plan's per-leg minutes come from the same rule the
 * ordering was made against — a route that shows 3 minutes for a leg it
 * priced at 5 has quietly stopped describing itself.
 */
export function legCostFactor(from: LatLng, to: LatLng, mode: TravelMode): number {
  if (!isOnFoot(mode)) return 1;
  // Whichever rule has more to say. The corridor catches a leg that runs
  // straight up a lane; the graph catches one that never touches a lane
  // but has to go round on them.
  return Math.max(
    legAgainstFlow(from, to) ? AGAINST_FLOW_FACTOR : 1,
    graphCostFactor(from, to)
  );
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
  if (!isOnFoot(mode)) return matrix;
  return matrix.map((row, i) =>
    row.map((cost, j) =>
      i === j || !Number.isFinite(cost)
        ? cost
        : cost * legCostFactor(points[i], points[j], mode)
    )
  );
}

/**
 * How opposed a step must be before it counts as going back up a lane.
 *
 * Tighter than FLOW_TOLERANCE_DEG, which is used to ask whether a whole
 * LEG broadly agrees with the crowd and is generous on purpose. This asks
 * something narrower of a single step of a drawn line: is it retracing
 * the lane, or merely crossing it?
 *
 * At the leg tolerance it could not tell the difference. A step heading
 * due south down its own lane passes within 6 m of the east-west lane out
 * of Tulshibaug, 110.1 degrees off that lane's flow — one tenth of a
 * degree over the leg threshold, and so judged to be walking up a lane it
 * was only cutting across. Within 45 degrees of directly opposed is a
 * reversal; 70 degrees off perpendicular is a junction.
 */
const AGAINST_STEP_DEG = 135;

/**
 * Whether one step of a drawn line walks a one-way the wrong way.
 *
 * Judged on the step itself rather than on the whole leg, because this is
 * asked of a routed line whose ends may be nowhere near a lane. Both ends
 * of the step have to be in the corridor, not just its middle — a step
 * that starts on a lane and leaves it is not travelling along it.
 */
function stepAgainstFlow(a: LatLng, b: LatLng): boolean {
  if (haversine(a, b) < 1) return false;
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const heading = bearingDeg(a, b);

  return PEDESTRIAN_ONE_WAYS.some((w) => {
    if (metresToPath(mid, w.path) > FLOW_CORRIDOR_M) return false;
    if (metresToPath(a, w.path) > FLOW_CORRIDOR_M) return false;
    if (metresToPath(b, w.path) > FLOW_CORRIDOR_M) return false;
    const flow = flowBearingAt(mid, w.path);
    return flow !== null && bearingDifference(heading, flow) > AGAINST_STEP_DEG;
  });
}

/**
 * Take a routed line and make it obey the one-ways.
 *
 * The lane rules used to apply only when BOTH ends of a leg stood on the
 * network — and only five of the sixteen mandals round the peths do, so
 * 230 of 240 possible legs never consulted a lane at all. A leg from
 * Kasba to Jilbya Maruti runs down the middle of one without either end
 * being on it, and the router, which knows nothing about any of this,
 * was free to draw it going up.
 *
 * Widening the rule instead was tried and reverted: letting a walk join
 * the network from further off lets it hop off a lane, round its length
 * and back on, which defeats the one-way outright — the tests caught
 * Tulshibaug to Dagdusheth becoming walkable that way.
 *
 * So the question is asked of the line rather than of the leg. Where the
 * routed line itself travels a lane the wrong way, that run is replaced
 * with a legal walk between the same two points. Everything either side
 * stays exactly as the router drew it, which keeps real streets for the
 * approach instead of inventing straight ones.
 *
 * A run with no legal replacement is left alone. That is not a drawing
 * problem to solve here — it means the stops are in an order the crowd
 * does not allow, which is the ordering's job, and the route card says so.
 */
export function enforceOneWays(line: [number, number][]): [number, number][] {
  if (line.length < 2) return line;
  const at = (c: [number, number]): LatLng => ({ lat: c[1], lng: c[0] });

  const out: [number, number][] = [line[0]];
  const push = (c: [number, number]) => {
    const last = out[out.length - 1];
    if (last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  };

  let i = 0;
  while (i < line.length - 1) {
    if (!stepAgainstFlow(at(line[i]), at(line[i + 1]))) {
      push(line[i + 1]);
      i++;
      continue;
    }

    // The whole run of steps that keeps going the wrong way.
    let j = i + 1;
    while (j < line.length - 1 && stepAgainstFlow(at(line[j]), at(line[j + 1]))) j++;

    const legal = laneWalk(at(line[i]), at(line[j]));
    if (legal) {
      for (const p of legal.path) push([p.lng, p.lat]);
    } else {
      for (let k = i + 1; k <= j; k++) push(line[k]);
    }
    i = j;
  }

  return out;
}

/** Which one-way stretches a drawn line travels the wrong way. */
export function violatedLanes(line: [number, number][]) {
  const at = (c: [number, number]): LatLng => ({ lat: c[1], lng: c[0] });
  const hit = new Set<string>();

  for (let i = 0; i < line.length - 1; i++) {
    const a = at(line[i]);
    const b = at(line[i + 1]);
    if (haversine(a, b) < 1) continue;
    const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    const heading = bearingDeg(a, b);

    for (const w of PEDESTRIAN_ONE_WAYS) {
      if (metresToPath(mid, w.path) > FLOW_CORRIDOR_M) continue;
      if (metresToPath(a, w.path) > FLOW_CORRIDOR_M) continue;
      if (metresToPath(b, w.path) > FLOW_CORRIDOR_M) continue;
      const flow = flowBearingAt(mid, w.path);
      if (flow !== null && bearingDifference(heading, flow) > AGAINST_STEP_DEG) hit.add(w.name);
    }
  }

  return PEDESTRIAN_ONE_WAYS.filter((w) => hit.has(w.name));
}

/** Half-width of an exclusion ribbon, in metres. */
const EXCLUDE_HALF_WIDTH_M = 5;

/**
 * How much of each end of a lane to leave open.
 *
 * A ribbon drawn over the whole lane swallows the mandals standing on it —
 * Dagdusheth is 1 m from one — and a router cannot snap a start or a
 * finish inside an excluded area, so the request comes back with no path
 * at all rather than a way round. Leaving the ends clear is what turns
 * "impossible" into "363 m round the block".
 */
const EXCLUDE_END_GAP_M = 30;

/**
 * A lane as a polygon a router can be told to avoid.
 *
 * Routers cannot be told about a one-way that only exists for twelve
 * days, but every one of them can be told to keep out of an area. Barring
 * the lane in BOTH directions is exactly right for a leg that wanted to
 * go up it: the answer is that it must go round, on streets the router
 * knows and we do not.
 *
 * Ribbon, not a buffer: a few metres either side of the drawn line, which
 * is enough to bar a lane a few metres wide without barring the streets
 * beside it.
 */
export function laneExclusionPolygon(
  lane: { path: [number, number][] }
): Array<[number, number]> {
  const first = lane.path[0];
  const last = lane.path[lane.path.length - 1];
  const a = { lat: first[1], lng: first[0] };
  const b = { lat: last[1], lng: last[0] };

  const length = haversine(a, b);
  const t = length > 0 ? Math.min(0.4, EXCLUDE_END_GAP_M / length) : 0;
  const lerp = (u: number): [number, number] => [
    first[0] + (last[0] - first[0]) * u,
    first[1] + (last[1] - first[1]) * u,
  ];
  const start = lerp(t);
  const end = lerp(1 - t);

  const dLng = EXCLUDE_HALF_WIDTH_M / (111_320 * Math.cos((a.lat * Math.PI) / 180));
  const dLat = EXCLUDE_HALF_WIDTH_M / 111_132;

  return [
    [start[0] - dLng, start[1] + dLat],
    [start[0] + dLng, start[1] + dLat],
    [end[0] + dLng, end[1] - dLat],
    [end[0] - dLng, end[1] - dLat],
    [start[0] - dLng, start[1] + dLat],
  ];
}
