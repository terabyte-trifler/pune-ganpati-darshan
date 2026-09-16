import { describe, it, expect } from 'vitest';
import { returnWalk } from '@/services/metro-return';
import { localGanpatis } from '@/services/catalogue';
import { METRO_STATIONS } from '@/lib/metro';
import { haversine } from '@/lib/geo';

/**
 * Getting home is not getting there.
 *
 * A station to alight at is chosen for a route that has not started; a
 * station to walk to afterwards is chosen from where somebody is standing,
 * at the hour the lanes are one-directional — and walking back the way you
 * came is the thing they exist to stop. The old returnStation ranked by
 * straight-line distance, which cannot see any of that.
 */
describe('the walk back to a station', () => {
  const at = (slug: string) => localGanpatis.find((g) => g.slug === slug)!.location;

  it('finds a station for every mandal in the peths', () => {
    for (const slug of ['tulshibaug-ganpati', 'dagdusheth-halwai-ganpati', 'kasba-ganpati']) {
      expect(returnWalk(at(slug))?.station).toBeDefined();
    }
  });

  it('prices the walk by what it costs, not by how far the station looks', () => {
    const w = returnWalk(at('tulshibaug-ganpati'))!;
    // The lanes can only make a walk dearer than the straight line.
    expect(w.effectiveM).toBeGreaterThanOrEqual(w.distanceM);
  });

  /**
   * The one walk in the peths that cannot be made legal in a straight
   * line. Measured: 450 m with 35 m against the crowd going directly,
   * 473 m and clean by way of Mandai chowk.
   */
  it('sends Tulshibaug round rather than down the lane', () => {
    const w = returnWalk(at('tulshibaug-ganpati'))!;
    expect(w.station.id).toBe('mandai');
    expect(w.via).toHaveLength(1);
    // The waypoint is between the mandal and the station, not a wild detour.
    const viaFromStop = haversine(at('tulshibaug-ganpati'), w.via[0]);
    expect(viaFromStop).toBeLessThan(400);
  });

  it('asks for no detour anywhere else', () => {
    for (const slug of ['dagdusheth-halwai-ganpati', 'kasba-ganpati', 'guruji-talim']) {
      expect(returnWalk(at(slug))!.via, slug).toHaveLength(0);
    }
  });

  it('never returns a station it would not walk to', () => {
    const w = returnWalk(at('kasba-ganpati'))!;
    expect(METRO_STATIONS.some((s) => s.id === w.station.id)).toBe(true);
    expect(w.distanceM).toBeGreaterThan(0);
  });
});
