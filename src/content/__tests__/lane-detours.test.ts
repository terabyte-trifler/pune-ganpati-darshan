import { describe, it, expect } from 'vitest';
import { LANE_AGAINST_PAIRS } from '@/content/lane-against';
import { LANE_DETOURS } from '@/content/lane-detours';
import { laneDetourVia, laneDetourMetres } from '@/services/pedestrian-graph';
import { haversine } from '@/lib/geo';

const key = (f: string, t: string) => `${f}>${t}`;

/**
 * Every walk that cannot be made legal in a straight line has a way round.
 *
 * Twelve pairs used to have none — the ordering priced them so plans
 * avoided the pair entirely, which is a worse answer than a slightly
 * longer walk. They were found by offering the router the waypoints that
 * were already working for other pairs rather than by searching deeper;
 * see the note in lane-detours.ts.
 *
 * This is the guard on that. Adding a mandal, or re-deriving
 * lane-against.ts, can reintroduce a pair with nowhere to go, and nothing
 * else in the suite would notice: the route would still be returned, just
 * walking up a lane the police made one-way.
 */
describe('every against-flow pair has a way round', () => {
  const detours = new Set(LANE_DETOURS.map((d) => key(d.from, d.to)));

  it('leaves no pair stranded', () => {
    const stranded = LANE_AGAINST_PAIRS
      .filter((p) => !detours.has(key(p.from, p.to)))
      .map((p) => key(p.from, p.to));
    expect(stranded).toEqual([]);
  });

  it('routes each detour through at least one waypoint', () => {
    for (const d of LANE_DETOURS) expect(d.via.length).toBeGreaterThan(0);
  });

  /**
   * A detour long enough to be absurd is not a fix. The measured spread
   * when this was written: median 1.5x straight-line, p90 2.7x, max 8.4x.
   * Ten is a ceiling on nonsense, not a target.
   */
  it('keeps every detour within a sane multiple of the straight line', () => {
    for (const d of LANE_DETOURS) {
      const straight = haversine(d.fromAt, d.toAt);
      if (straight < 50) continue;
      expect(d.distanceM / straight).toBeLessThan(10);
    }
  });

  it('has no duplicate pair', () => {
    expect(detours.size).toBe(LANE_DETOURS.length);
  });

  /** The twelve that were stranded, now reachable through the graph. */
  it.each([
    ['dagdusheth-halwai-ganpati', 'mati-ganpati'],
    ['dagdusheth-halwai-ganpati', 'sarasbaug-ganpati'],
    ['sarasbaug-ganpati', 'phani-ali-ganesh-mandir'],
    ['hutatma-babu-genu-mandal', 'trishund-ganpati-mandir'],
    ['hira-bagh-mandal', 'hutatma-babu-genu-mandal'],
  ])('%s -> %s now has a via chain', (from, to) => {
    const d = LANE_DETOURS.find((x) => x.from === from && x.to === to);
    expect(d).toBeDefined();
    expect(laneDetourVia(d!.fromAt, d!.toAt).length).toBeGreaterThan(0);
    expect(laneDetourMetres(d!.fromAt, d!.toAt)).toBeGreaterThan(0);
  });
});
