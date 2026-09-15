import { PEDESTRIAN_ONE_WAYS, PEDESTRIAN_TWO_WAYS } from '@/content/diversions';
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

/** Lane nodes close enough to step onto from a point. */
function joinsFor(point: LatLng): Array<{ id: number; metres: number }> {
  return graph()
    .nodes.map((n) => ({ id: n.id, metres: haversine(point, n.point) }))
    .filter((j) => j.metres <= JOIN_M)
    .sort((a, b) => a.metres - b.metres);
}

/** Whether a point is close enough to the lanes for them to apply. */
export function touchesLanes(point: LatLng): boolean {
  return graph().nodes.some((n) => haversine(point, n.point) <= JOIN_M);
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
  const starts = joinsFor(from);
  const ends = joinsFor(to);
  if (starts.length === 0 || ends.length === 0) return null;

  const { nodes, out } = graph();
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
