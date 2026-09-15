import { PEDESTRIAN_ONE_WAYS, PEDESTRIAN_TWO_WAYS } from '@/content/diversions';
import { bearingDeg, bearingDifference, metresToPath } from '@/lib/geo';
import { haversine, type LatLng } from '@/lib/geo';

/**
 * The one-way lanes as a graph you can actually walk.
 *
 * Until now the lanes were only ever tested against the STRAIGHT LINE
 * between two stops, which is wrong in both directions at once. A line
 * from Tulshibaug to Dagdusheth cuts across the block: it lies on no lane,
 * so nothing was charged and nothing was drawn along the road — the map
 * flew straight over the buildings between them, and the planner priced
 * the walk as if you could.
 *
 * A graph answers what the straight line cannot: what you would actually
 * walk, and whether the crowd lets you walk it at all.
 *
 * Edges along a lane are DIRECTED, in the direction the crowd moves.
 * Joins — stepping onto or off a lane — are short and undirected, because
 * getting from a mandal doorway to the lane outside it is not itself
 * one-way. The join radius is deliberately tight: a generous one would
 * let the search hop off a lane, round its length, and back on, which is
 * precisely the bypass the lanes exist to prevent.
 */

/** How far from a lane a step still counts as being on it. */
export const FLOW_CORRIDOR_M = 45;

/**
 * How opposed one step must be before it counts as going back up a lane.
 *
 * Within 45 degrees of directly opposed is retracing; 70 degrees off
 * perpendicular is a junction being crossed.
 */
export const AGAINST_STEP_DEG = 135;

/**
 * The direction the crowd moves at one point on a stretch.
 *
 * Read off the nearest segment of the drawn path, because these lanes
 * bend — one of them by 81 degrees — and a single bearing for a whole
 * stretch is wrong for half of it.
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

/**
 * Whether walking straight from a to b goes back up a one-way.
 *
 * Both ends have to be in the corridor, not just the middle — a step that
 * starts on a lane and leaves it is not travelling along it.
 */
export function stepAgainstFlow(a: LatLng, b: LatLng): boolean {
  return laneOpposing(a, b) !== null;
}

/**
 * The one-way stretch a step is travelling the wrong way, if any.
 *
 * A step is judged against the NEAREST lane and no other. Two of these
 * stretches leave Tulshibaug from the same point in opposite directions —
 * one east, one west and then south — so within a few metres of that
 * corner every step down one of them is opposed to the other. Attributing
 * a step to one lane is what separates "walking back up this lane" from
 * "leaving the lane beside it".
 */
export function laneOpposing(a: LatLng, b: LatLng) {
  if (haversine(a, b) < 1) return null;
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };

  const nearest = PEDESTRIAN_ONE_WAYS
    .map((w) => ({ w, d: metresToPath(mid, w.path) }))
    .sort((x, y) => x.d - y.d)[0];

  if (!nearest || nearest.d > FLOW_CORRIDOR_M) return null;
  const { w } = nearest;
  if (metresToPath(a, w.path) > FLOW_CORRIDOR_M) return null;
  if (metresToPath(b, w.path) > FLOW_CORRIDOR_M) return null;

  const flow = flowBearingAt(mid, w.path);
  if (flow === null) return null;
  return bearingDifference(bearingDeg(a, b), flow) > AGAINST_STEP_DEG ? w : null;
}

/** Two vertices this close are the same junction. */
const SAME_NODE_M = 12;

/** How far from a lane you can join it. */
const JOIN_M = 60;

/**
 * How much longer than the straight line a lane path may be before it is
 * not worth drawing. Beyond this the lanes are not really what this walk
 * is about, and following them would be a longer lie than the straight
 * line is.
 */
const MAX_DETOUR_RATIO = 3;

interface Node { id: number; point: LatLng }
interface Edge { to: number; metres: number }

interface Graph { nodes: Node[]; out: Edge[][] }

let cached: Graph | null = null;

function build(): Graph {
  const nodes: Node[] = [];
  const out: Edge[][] = [];

  const nodeAt = (point: LatLng): number => {
    const existing = nodes.find((n) => haversine(n.point, point) <= SAME_NODE_M);
    if (existing) return existing.id;
    const id = nodes.length;
    nodes.push({ id, point });
    out.push([]);
    return id;
  };

  // One directed edge per lane segment, in the direction the crowd walks.
  for (const lane of PEDESTRIAN_ONE_WAYS) {
    for (let i = 0; i < lane.path.length - 1; i++) {
      const a = { lat: lane.path[i][1], lng: lane.path[i][0] };
      const b = { lat: lane.path[i + 1][1], lng: lane.path[i + 1][0] };
      const from = nodeAt(a);
      const to = nodeAt(b);
      if (from !== to) out[from].push({ to, metres: haversine(a, b) });
    }
  }

  // Two-way links: an edge each way. Without these the graph has only the
  // one-way lanes and believes the roads between them do not exist, which
  // is how a leg with a perfectly good walk came back unroutable.
  for (const link of PEDESTRIAN_TWO_WAYS) {
    for (let i = 0; i < link.path.length - 1; i++) {
      const a = { lat: link.path[i][1], lng: link.path[i][0] };
      const b = { lat: link.path[i + 1][1], lng: link.path[i + 1][0] };
      const from = nodeAt(a);
      const to = nodeAt(b);
      if (from === to) continue;
      const metres = haversine(a, b);
      out[from].push({ to, metres });
      out[to].push({ to: from, metres });
    }
  }

  return { nodes, out };
}

function graph(): Graph {
  cached ??= build();
  return cached;
}

/** Test seam: the lanes are static, but a test may swap the catalogue. */
export function resetPedestrianGraph(): void {
  cached = null;
}

/**
 * The nearest point to `p` on the segment a-b, and how far away it is.
 *
 * Equirectangular, like metresToPath — over a segment a few hundred
 * metres long in Pune the error is centimetres.
 */
function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; metres: number } {
  const mPerLat = 111_132;
  const mPerLng = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ax = a.lng * mPerLng, ay = a.lat * mPerLat;
  const bx = b.lng * mPerLng, by = b.lat * mPerLat;
  const px = p.lng * mPerLng, py = p.lat * mPerLat;

  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const point = { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
  return { point, metres: haversine(p, point) };
}

/**
 * A working copy of the graph with `from` and `to` joined onto it.
 *
 * Joining only at the lanes' own vertices was wrong, and produced exactly
 * the artefact it sounds like. Hutatma Babu Genu stands beside the main
 * southward lane but there is no vertex next to it, so a walk from
 * Dagdusheth ran 179 m south to the next vertex and then 42 m back NORTH
 * to reach it — a U-turn, drawn on a lane that only goes south, which is
 * the one instruction the whole feature exists to give.
 *
 * A stop joins where it actually stands. Each lane segment that passes
 * close enough gets a temporary node at the nearest point along it, with
 * the segment's own direction preserved on both halves: you may enter it
 * from the segment's start and leave it towards the segment's end, and
 * never the other way.
 */
function withEndpoints(from: LatLng, to: LatLng) {
  const base = graph();
  const nodes = [...base.nodes];
  const out = base.out.map((edges) => [...edges]);

  /**
   * Stepping on or off a lane is a walk, and the lanes apply to it.
   *
   * A join used to be an unchecked straight hop, which is how the walk
   * from Dagdusheth to Tulshibaug came to start with 50 m at bearing 332 —
   * due north, straight up the southbound lane — to reach the two-way
   * branch that begins just past it. Our own path was walking a one-way in
   * reverse, and it was our own rule that let it.
   *
   * `outbound` is which way the walk crosses the join: away from the stop
   * when it is the start of the leg, towards it when it is the end.
   *
   * Very short hops are exempt, and have to be. Tulshibaug stands 9 m off
   * the end of its own lane, so the last step to its doorway points back
   * up that lane and was read as walking the wrong way — which cut
   * Tulshibaug off the network entirely. Nine metres to a doorway is
   * stepping off a lane; fifty up the middle of one is not.
   */
  const JOIN_CHECK_MIN_M = 25;
  const addJoin = (
    p: LatLng,
    outbound: boolean
  ): Array<{ id: number; metres: number }> => {
    const allowed = (node: LatLng) =>
      haversine(p, node) < JOIN_CHECK_MIN_M ||
      (outbound ? !stepAgainstFlow(p, node) : !stepAgainstFlow(node, p));

    const joins: Array<{ id: number; metres: number }> = [];

    // Existing vertices within reach.
    for (const n of nodes.slice(0, base.nodes.length)) {
      const d = haversine(p, n.point);
      if (d <= JOIN_M && allowed(n.point)) joins.push({ id: n.id, metres: d });
    }

    // And a fresh node on any segment that passes closer than those.
    for (let u = 0; u < base.out.length; u++) {
      for (const edge of base.out[u]) {
        const { point, metres } = projectOnSegment(p, base.nodes[u].point, base.nodes[edge.to].point);
        if (metres > JOIN_M) continue;
        // Already standing on a vertex of this segment; nothing to add.
        if (haversine(point, base.nodes[u].point) < SAME_NODE_M) continue;
        if (haversine(point, base.nodes[edge.to].point) < SAME_NODE_M) continue;

        if (!allowed(point)) continue;

        const id = nodes.length;
        nodes.push({ id, point });
        out.push([{ to: edge.to, metres: haversine(point, base.nodes[edge.to].point) }]);
        out[u].push({ to: id, metres: haversine(base.nodes[u].point, point) });
        joins.push({ id, metres });
      }
    }

    return joins.sort((a, b) => a.metres - b.metres);
  };

  const starts = addJoin(from, true);
  const ends = addJoin(to, false);
  return { nodes, out, starts, ends };
}

/**
 * Whether a point is close enough to the lanes for them to apply.
 *
 * Measured to the lanes themselves, not to their corners — a mandal
 * standing halfway along a stretch is on it.
 */
export function touchesLanes(point: LatLng): boolean {
  const { nodes, out } = graph();
  return out.some((edges, u) =>
    edges.some(
      (e) => projectOnSegment(point, nodes[u].point, nodes[e.to].point).metres <= JOIN_M
    )
  );
}

export interface LaneWalk {
  /** The walked line, starting at `from` and ending at `to`. */
  path: LatLng[];
  /** Its length, which is what the walk actually costs. */
  metres: number;
}

/**
 * The shortest walk from one point to another that respects the lanes.
 *
 * Returns null when the lanes have nothing to say about this leg — either
 * end too far from any of them, no route through them, or a route so much
 * longer than the straight line that it is not what the walk is about.
 * A null is the caller's signal to fall back to a straight line, which is
 * the right answer for almost every leg in the city.
 */
export function laneWalk(from: LatLng, to: LatLng): LaneWalk | null {
  const { nodes, out, starts, ends } = withEndpoints(from, to);
  if (starts.length === 0 || ends.length === 0) return null;

  const endCost = new Map(ends.map((e) => [e.id, e.metres]));

  const dist = new Array<number>(nodes.length).fill(Infinity);
  const prev = new Array<number>(nodes.length).fill(-1);
  for (const s of starts) dist[s.id] = s.metres;

  // Small graph — a linear scan beats a heap and has no failure modes.
  const seen = new Set<number>();
  for (;;) {
    let at = -1;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!seen.has(i) && dist[i] < best) { best = dist[i]; at = i; }
    }
    if (at === -1) break;
    seen.add(at);
    for (const e of out[at]) {
      const candidate = dist[at] + e.metres;
      if (candidate < dist[e.to]) { dist[e.to] = candidate; prev[e.to] = at; }
    }
  }

  let finish = -1;
  let total = Infinity;
  for (const [id, join] of endCost) {
    const candidate = dist[id] + join;
    if (candidate < total) { total = candidate; finish = id; }
  }
  if (finish === -1 || !Number.isFinite(total)) return null;

  const straight = haversine(from, to);
  if (straight > 0 && total > straight * MAX_DETOUR_RATIO) return null;

  const chain: LatLng[] = [];
  for (let at = finish; at !== -1; at = prev[at]) chain.push(nodes[at].point);
  chain.reverse();


  // A single node means the walk touched the network without travelling
  // along it — nothing to draw, and the straight line is honest.
  if (chain.length < 2) return null;

  return { path: [from, ...chain, to], metres: total };
}

/**
 * The line to draw for a whole ordered walk.
 *
 * Each leg follows the lanes where they apply and runs straight where
 * they do not, so the drawn route bends round the block between
 * Tulshibaug and Dagdusheth instead of flying over it.
 */
export function walkGeometry(stops: LatLng[]): [number, number][] {
  if (stops.length < 2) return stops.map((s) => [s.lng, s.lat]);

  const line: [number, number][] = [[stops[0].lng, stops[0].lat]];
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = laneWalk(stops[i], stops[i + 1]);
    const points = leg ? leg.path.slice(1) : [stops[i + 1]];
    for (const p of points) {
      const last = line[line.length - 1];
      // Consecutive duplicates make a zero-length segment, which MapLibre
      // cannot take a bearing from — so the arrowhead on it points at
      // nothing.
      if (last[0] !== p.lng || last[1] !== p.lat) line.push([p.lng, p.lat]);
    }
  }
  return line;
}

/**
 * A routed line with its lane-covered legs replaced by the lanes.
 *
 * Both halves of this are needed and neither is enough alone.
 *
 * The router cannot be trusted where the lanes are: it does not know they
 * exist, cannot be told, and cannot be threaded through them — asked to
 * go via their vertices the public OSRM returned 1720 m for a walk the
 * lane graph puts at 305 m, because its pedestrian graph has no peth
 * alleys. Between mandals its line can run the wrong way up a lane, which
 * is the one thing a drawn route must never do.
 *
 * But the lanes are five short stretches in the peths and the city is
 * larger than that. Kasba to Bhausaheb Rangari touches none of them, and
 * drawing it straight puts a line through the buildings instead of down
 * Shivaji Road. So the router keeps every leg the lanes have no opinion
 * about, which is most of them.
 *
 * Cutting forward-only matters: a walk through the peths passes close to
 * mandals it has not reached yet, and a nearest-vertex search over the
 * whole line would cut at the wrong place and turn the route inside out.
 */
export function spliceLaneLegs(
  line: [number, number][],
  points: LatLng[]
): [number, number][] {
  if (line.length < 2 || points.length < 2) return line;

  const nearestFrom = (start: number, p: LatLng): number => {
    let best = start;
    let bestD = Infinity;
    for (let i = start; i < line.length; i++) {
      const d = haversine(p, { lat: line[i][1], lng: line[i][0] });
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  const cuts: number[] = [0];
  for (let k = 1; k < points.length; k++) cuts.push(nearestFrom(cuts[k - 1], points[k]));
  cuts[cuts.length - 1] = line.length - 1;

  const out: [number, number][] = [line[0]];
  const push = (c: [number, number]) => {
    const last = out[out.length - 1];
    if (last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  };

  for (let k = 1; k < points.length; k++) {
    const leg = laneWalk(points[k - 1], points[k]);
    if (leg) {
      for (const p of leg.path) push([p.lng, p.lat]);
    } else {
      for (let i = cuts[k - 1] + 1; i <= cuts[k]; i++) push(line[i]);
    }
  }
  return out;
}

/**
 * The lane's own points to send a router through, for one leg.
 *
 * Empty when the lanes have nothing to say about this leg, which is most
 * of them. Otherwise these are the interior points of the legal walk —
 * the ends are the stops themselves and the router already has those.
 *
 * Handing these to a router as through-points is what makes the orange
 * line sit on the blue one: the router still draws real streets, but it
 * must pass through the lane on the way, so it draws the lane.
 */
export function laneViaPoints(from: LatLng, to: LatLng): LatLng[] {
  return laneWalk(from, to)?.path.slice(1, -1) ?? [];
}
