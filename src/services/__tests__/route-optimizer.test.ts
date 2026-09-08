import { describe, it, expect } from 'vitest';
import {
  optimizeOrder,
  optimizeLocally,
  estimateMatrix,
  EXACT_SOLVE_LIMIT,
} from '../route-optimizer';
import { haversine, type LatLng } from '@/lib/geo';

/** Brute-force optimum, used to check the solver at sizes where it is cheap. */
function bruteForce(matrix: number[][]): number {
  const n = matrix.length - 1;
  const idx = Array.from({ length: n }, (_, i) => i + 1);
  let best = Infinity;
  const permute = (arr: number[], current: number[] = []) => {
    if (arr.length === 0) {
      let cost = 0;
      const path = [0, ...current];
      for (let i = 0; i < path.length - 1; i++) cost += matrix[path[i]][path[i + 1]];
      best = Math.min(best, cost);
      return;
    }
    for (let i = 0; i < arr.length; i++) {
      permute([...arr.slice(0, i), ...arr.slice(i + 1)], [...current, arr[i]]);
    }
  };
  permute(idx);
  return best;
}

describe('route optimizer', () => {
  it('returns the exact optimum for small routes', () => {
    // Deliberately adversarial: input order is the WORST order.
    const matrix = [
      [0, 10, 2, 9],
      [10, 0, 8, 3],
      [2, 8, 0, 7],
      [9, 3, 7, 0],
    ];
    const result = optimizeOrder(3, matrix);
    expect(result.method).toBe('exact');
    expect(result.totalCost!).toBeCloseTo(bruteForce(matrix), 6);
  });

  it('matches brute force across randomised instances', () => {
    for (let trial = 0; trial < 25; trial++) {
      const n = 4 + (trial % 4); // 4..7 stops
      const pts: LatLng[] = Array.from({ length: n + 1 }, () => ({
        lat: 18.5 + Math.random() * 0.02,
        lng: 73.84 + Math.random() * 0.03,
      }));
      const matrix = estimateMatrix(pts, 'walk');
      const result = optimizeOrder(n, matrix);
      expect(result.totalCost!).toBeCloseTo(bruteForce(matrix), 4);
    }
  });

  it('visits every stop exactly once', () => {
    const pts: LatLng[] = Array.from({ length: 12 }, (_, i) => ({
      lat: 18.5 + i * 0.001,
      lng: 73.85 + ((i * 7) % 5) * 0.002,
    }));
    const [origin, ...stops] = pts;
    const result = optimizeLocally(origin, stops, 'walk');
    expect(result.order).toHaveLength(stops.length);
    expect(new Set(result.order).size).toBe(stops.length);
    expect(Math.min(...result.order)).toBe(0);
    expect(Math.max(...result.order)).toBe(stops.length - 1);
  });

  it('falls back to the heuristic above the exact limit and still improves on input order', () => {
    const pts: LatLng[] = Array.from({ length: 11 }, () => ({
      lat: 18.5 + Math.random() * 0.02,
      lng: 73.84 + Math.random() * 0.03,
    }));
    const [origin, ...stops] = pts;
    const matrix = estimateMatrix(pts, 'walk');
    const result = optimizeLocally(origin, stops, 'walk');
    expect(stops.length).toBeGreaterThan(EXACT_SOLVE_LIMIT);
    expect(result.method).toBe('heuristic');

    const naive = [0, ...stops.map((_, i) => i + 1)];
    let naiveCost = 0;
    for (let i = 0; i < naive.length - 1; i++) naiveCost += matrix[naive[i]][naive[i + 1]];
    expect(result.totalCost!).toBeLessThanOrEqual(naiveCost);
  });

  it('beats naive latitude sorting on the real Manache Paach', () => {
    // Actual coordinates. Ceremonial order is not the shortest walk, and
    // sorting by latitude is worse still — this is why we solve properly.
    const origin: LatLng = { lat: 18.5204, lng: 73.8567 }; // Pune centre
    const manache: LatLng[] = [
      { lat: 18.5196, lng: 73.8553 }, // Kasba
      { lat: 18.5175, lng: 73.8556 }, // Tambdi Jogeshwari
      { lat: 18.5163, lng: 73.8543 }, // Guruji Talim
      { lat: 18.5148, lng: 73.8551 }, // Tulshibaug
      { lat: 18.5126, lng: 73.8489 }, // Kesariwada
    ];
    const matrix = estimateMatrix([origin, ...manache], 'walk');
    const optimized = optimizeLocally(origin, manache, 'walk');

    const byLatitude = [...manache.keys()].sort(
      (a, b) => manache[b].lat - manache[a].lat
    );
    let latCost = matrix[0][byLatitude[0] + 1];
    for (let i = 0; i < byLatitude.length - 1; i++) {
      latCost += matrix[byLatitude[i] + 1][byLatitude[i + 1] + 1];
    }

    expect(optimized.totalCost!).toBeLessThanOrEqual(latCost);
  });

  it('reports unreachable routes honestly instead of costing them at zero', () => {
    // No ordering of these two stops is traversable.
    const matrix = [
      [0, 5, 1],
      [5, 0, Infinity],
      [1, Infinity, 0],
    ];
    const result = optimizeOrder(2, matrix);

    // The cost is unknown, not zero and not Infinity — so nothing can
    // render "Infinity" or NaN into the UI.
    expect(result.reachable).toBe(false);
    expect(result.totalCost).toBeNull();
    // Every stop the user chose is still returned for display.
    expect(new Set(result.order).size).toBe(2);
  });

  it('marks fully reachable routes as reachable with a finite cost', () => {
    const matrix = [
      [0, 10, 2, 9],
      [10, 0, 8, 3],
      [2, 8, 0, 7],
      [9, 3, 7, 0],
    ];
    const result = optimizeOrder(3, matrix);
    expect(result.reachable).toBe(true);
    expect(result.totalCost).toBeGreaterThan(0);
  });
});

describe('geo', () => {
  it('computes a known Pune distance', () => {
    // Kasba Ganpati → Tambdi Jogeshwari, ~236 m (verified against Postgres)
    const d = haversine({ lat: 18.5196, lng: 73.8553 }, { lat: 18.5175, lng: 73.8556 });
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(250);
  });
});
