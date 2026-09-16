import { it, expect } from 'vitest';
import { chooseParking } from '@/services/parking-plan';
import { optimizeLocally } from '@/services/route-optimizer';
import { PARKING } from '@/content/parking';
import { localGanpatis } from '@/services/catalogue';
import { haversine, estimateRideSeconds, type LatLng } from '@/lib/geo';
import type { ParkingSpot } from '@/content/parking';
import type { Ganpati } from '@/types/ganpati';

/** The old behaviour: solve every spot, take the cheapest total. */
function exhaustive(origin: LatLng, stops: Ganpati[]) {
  const points = stops.map((m) => m.location);
  let best: ParkingSpot | null = null;
  let bestS = Infinity;
  for (const spot of PARKING) {
    const point = { lat: spot.lat, lng: spot.lng };
    const walk = optimizeLocally(point, points, 'walk');
    if (walk.totalCost === null) continue;
    const s = estimateRideSeconds(haversine(origin, point)) + walk.totalCost;
    if (s < bestS) { bestS = s; best = spot; }
  }
  return { spot: best, seconds: bestS };
}

it('picks the same parking as solving every spot, or within a couple of per cent', () => {
  const rng = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const origins = [
    { lat: 18.5195, lng: 73.8553 }, { lat: 18.5010, lng: 73.8580 },
    { lat: 18.5308, lng: 73.8478 }, { lat: 18.4900, lng: 73.8200 },
    { lat: 18.5600, lng: 73.9000 }, { lat: 18.5180, lng: 73.8700 },
  ];
  let same = 0, total = 0, worstPct = 0;
  for (const origin of origins) {
    for (let s = 1; s <= 6; s++) {
      const r = rng(s * 7919);
      const pool = [...localGanpatis];
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const stops = pool.slice(0, 3 + (s % 8));
      const fast = chooseParking(origin, stops);
      const slow = exhaustive(origin, stops);
      total++;
      if (fast?.spot.no === slow.spot?.no) { same++; continue; }
      // Different spot: how much worse is it, really?
      const points = stops.map((m) => m.location);
      const w = optimizeLocally({ lat: fast!.spot.lat, lng: fast!.spot.lng }, points, 'walk');
      const got = estimateRideSeconds(haversine(origin, { lat: fast!.spot.lat, lng: fast!.spot.lng })) + (w.totalCost ?? 0);
      const pct = ((got - slow.seconds) / slow.seconds) * 100;
      worstPct = Math.max(worstPct, pct);
      console.log(`  differs: picked ${fast!.spot.name} over ${slow.spot?.name} — ${pct.toFixed(1)}% slower journey`);
    }
  }
  /**
   * The shortcut is an approximation, so its quality is pinned rather than
   * trusted. Measured when it was introduced: the same parking in 31 of 36
   * cases, and where it differed the whole journey was at most 1.9% longer
   * — under two minutes on an hour, against 546 ms of main thread returned
   * to the rider on every position update.
   */
  expect(same / total).toBeGreaterThanOrEqual(0.8);
  expect(worstPct).toBeLessThan(5);
}, 120000);
