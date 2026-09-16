import { describe, it, expect } from 'vitest';
import { chooseParking } from '@/services/parking-plan';
import { optimizeLocally } from '@/services/route-optimizer';
import { PARKING } from '@/content/parking';
import { localGanpatis } from '@/services/catalogue';
import { haversine, estimateRideSeconds, type LatLng } from '@/lib/geo';
import type { ParkingSpot } from '@/content/parking';
import type { Ganpati } from '@/types/ganpati';

/** The old behaviour: solve every spot, take the cheapest total. */
function exhaustive(origin: LatLng, stops: Ganpati[], at: Date) {
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

/** A fixed instant, because the closures after 17:00 change the answer. */
const istAt = (hour: number) => new Date(Date.UTC(2026, 8, 20, hour - 5, -30, 0));

function agreement(at: Date) {
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
      const fast = chooseParking(origin, stops, PARKING, at);
      const slow = exhaustive(origin, stops, at);
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
  return { same, total, worstPct };
}

/**
 * The shortcut is an approximation, so its quality is pinned rather than
 * trusted — and pinned at a FIXED hour, which it was not at first.
 *
 * chooseParking defaults to new Date(), and the road closures come into
 * force at 17:00 IST: before then every approach is open, after it some
 * parking is priced for a detour and the ranking shifts. So this passed
 * all afternoon and began failing at 17:06 on a day when nothing about
 * parking had changed. A test that depends on when it runs is not a test.
 *
 * Both regimes are measured, because both are real evenings — and the
 * closed one is the harder problem, since the detour factor pulls spots
 * past one another and the cheap ranking agrees less often. The bounds
 * below are what was measured, not a target that was aimed at.
 *
 * ---------------------------------------------------------------------
 * The timeout is explicit because this test is genuinely slow.
 *
 * Each case solves EVERY parking spot exhaustively to compare against the
 * shortcut, which is about 5.7 seconds of arithmetic — over vitest's 5s
 * default. It sat just the wrong side of that line and passed only when
 * the scheduler happened to be kind, so it went green alone and red in a
 * full run, and the run that tipped it had nothing to do with parking.
 *
 * A slow test and a hung test are different things, and the timeout
 * should say which one this is.
 */
const EXHAUSTIVE_SOLVE_TIMEOUT_MS = 30_000;

describe('the parking shortcut', () => {
  it('agrees with solving every spot, before the roads close', () => {
    const { same, total, worstPct } = agreement(istAt(11));
    console.log(`  open roads:   ${same}/${total} same, worst ${worstPct.toFixed(1)}%`);
    expect(same / total).toBeGreaterThanOrEqual(0.8);
    expect(worstPct).toBeLessThan(5);
  }, EXHAUSTIVE_SOLVE_TIMEOUT_MS);

  it('stays close enough once the roads close', () => {
    const { same, total, worstPct } = agreement(istAt(20));
    console.log(`  closed roads: ${same}/${total} same, worst ${worstPct.toFixed(1)}%`);
    expect(same / total).toBeGreaterThanOrEqual(0.7);
    expect(worstPct).toBeLessThan(8);
  }, EXHAUSTIVE_SOLVE_TIMEOUT_MS);
});
