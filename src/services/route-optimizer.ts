import { haversine, estimateDurationSeconds, type LatLng, type TravelMode } from '@/lib/geo';

/**
 * Darshan route ordering.
 *
 * This is an open Travelling Salesman Problem: the route starts at a fixed
 * origin, visits every chosen mandal once, and ends wherever the last stop
 * is (a visitor does not return to their starting point).
 *
 * Sorting by latitude/longitude — explicitly rejected by the brief — gives
 * badly wrong answers in the peths, where mandals sit in a dense cluster
 * and a 200 m difference in ordering is a real detour on foot.
 *
 * Strategy by size:
 *   n ≤ 8   exact Held–Karp dynamic programming (optimal)
 *   n > 8   nearest-neighbour seed + 2-opt improvement (near-optimal)
 *
 * The cost matrix is supplied by the caller. It comes from the Routes API
 * when available, and falls back to haversine × detour factor when Routes
 * is unavailable or unconfigured — so the planner still works offline.
 */

export const EXACT_SOLVE_LIMIT = 8;

/** Local fallback matrix — no network, used when Routes is unavailable. */
export function estimateMatrix(points: LatLng[], mode: TravelMode): number[][] {
  return points.map((from) =>
    points.map((to) =>
      from === to ? 0 : estimateDurationSeconds(haversine(from, to), mode)
    )
  );
}

function pathCost(order: number[], matrix: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += matrix[order[i]][order[i + 1]];
  }
  return total;
}

/**
 * Held–Karp over subsets. Index 0 is the fixed origin.
 * O(2^n · n^2) — fine at n ≤ 8 (≈16k states), which covers most real plans.
 *
 * Returns null when no finite complete tour exists (some pair is
 * impassable). The caller falls back to the heuristic, which degrades
 * gracefully instead of dropping stops the user chose.
 */
function solveExact(matrix: number[][]): number[] | null {
  const n = matrix.length;
  const stopCount = n - 1; // excluding origin
  const fullMask = (1 << stopCount) - 1;

  // dp[mask][last] = cheapest cost to have visited `mask`, ending at `last`
  const dp: number[][] = Array.from({ length: fullMask + 1 }, () =>
    Array.from({ length: stopCount }, () => Number.POSITIVE_INFINITY)
  );
  const parent: number[][] = Array.from({ length: fullMask + 1 }, () =>
    Array.from({ length: stopCount }, () => -1)
  );

  for (let i = 0; i < stopCount; i++) {
    dp[1 << i][i] = matrix[0][i + 1];
  }

  for (let mask = 1; mask <= fullMask; mask++) {
    for (let last = 0; last < stopCount; last++) {
      if (!(mask & (1 << last))) continue;
      const cost = dp[mask][last];
      if (!Number.isFinite(cost)) continue;

      for (let next = 0; next < stopCount; next++) {
        if (mask & (1 << next)) continue;
        const nextMask = mask | (1 << next);
        const candidate = cost + matrix[last + 1][next + 1];
        if (candidate < dp[nextMask][next]) {
          dp[nextMask][next] = candidate;
          parent[nextMask][next] = last;
        }
      }
    }
  }

  // Open tour: finish at whichever stop is cheapest, not back at the origin.
  let bestLast = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let i = 0; i < stopCount; i++) {
    if (dp[fullMask][i] < bestCost) {
      bestCost = dp[fullMask][i];
      bestLast = i;
    }
  }

  // Every complete ordering is blocked by an impassable pair.
  if (bestLast === -1 || !Number.isFinite(bestCost)) return null;

  const order: number[] = [];
  let mask = fullMask;
  let last = bestLast;
  while (last !== -1) {
    order.push(last + 1);
    const prev = parent[mask][last];
    mask ^= 1 << last;
    last = prev;
  }
  order.reverse();
  return [0, ...order];
}

/** Nearest-neighbour construction from the origin. */
function nearestNeighbour(matrix: number[][]): number[] {
  const n = matrix.length;
  const visited = new Set<number>([0]);
  const order = [0];
  let current = 0;

  while (visited.size < n) {
    let best = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 1; i < n; i++) {
      if (visited.has(i)) continue;
      if (matrix[current][i] < bestCost) {
        bestCost = matrix[current][i];
        best = i;
      }
    }
    // All remaining are unreachable — append them in input order so the
    // user still sees every stop they chose.
    if (best === -1) {
      for (let i = 1; i < n; i++) if (!visited.has(i)) { visited.add(i); order.push(i); }
      break;
    }
    visited.add(best);
    order.push(best);
    current = best;
  }
  return order;
}

/**
 * 2-opt: repeatedly reverse a segment when doing so shortens the path.
 * Index 0 is pinned — the origin cannot move.
 */
function twoOpt(order: number[], matrix: number[][], maxPasses = 40): number[] {
  const best = [...order];
  let improved = true;
  let passes = 0;

  while (improved && passes < maxPasses) {
    improved = false;
    passes++;
    for (let i = 1; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (pathCost(candidate, matrix) < pathCost(best, matrix) - 1e-9) {
          best.splice(0, best.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return best;
}

export interface OptimizeResult {
  /** Indices into the original `stops` array, in visiting order. */
  order: number[];
  /**
   * Total cost in seconds, or null when at least one leg is impassable.
   * Null rather than Infinity so a formatter can never render "Infinity"
   * or NaN into the UI (§36); callers show the "route unavailable" state.
   */
  totalCost: number | null;
  /** False when the ordering contains a leg the routing engine rejected. */
  reachable: boolean;
  method: 'exact' | 'heuristic' | 'trivial';
}

/**
 * Order `stops` for the shortest journey starting at `origin`.
 * `matrix` is over [origin, ...stops] — index 0 is the origin.
 */
export function optimizeOrder(
  stopCount: number,
  matrix: number[][]
): OptimizeResult {
  if (stopCount <= 1) {
    const cost = stopCount === 1 ? matrix[0][1] : 0;
    const reachable = Number.isFinite(cost);
    return {
      order: stopCount === 1 ? [0] : [],
      totalCost: reachable ? cost : null,
      reachable,
      method: 'trivial',
    };
  }

  const exact =
    stopCount <= EXACT_SOLVE_LIMIT ? solveExact(matrix) : null;
  const solved = exact ?? twoOpt(nearestNeighbour(matrix), matrix);
  const method: OptimizeResult['method'] = exact ? 'exact' : 'heuristic';

  const cost = pathCost(solved, matrix);
  const reachable = Number.isFinite(cost);

  return {
    // Drop the origin and shift back to stop-array indices. Every chosen
    // stop is still returned even when unreachable, so the planner can show
    // the full list alongside an honest "route unavailable" message.
    order: solved.slice(1).map((i) => i - 1),
    totalCost: reachable ? cost : null,
    reachable,
    method,
  };
}

/** Convenience: optimise using local estimates, with no network calls. */
export function optimizeLocally(
  origin: LatLng,
  stops: LatLng[],
  mode: TravelMode
): OptimizeResult {
  const matrix = estimateMatrix([origin, ...stops], mode);
  return optimizeOrder(stops.length, matrix);
}
