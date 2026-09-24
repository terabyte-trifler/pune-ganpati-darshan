import { describe, it, expect } from 'vitest';
import { CHECKPOINT_POINTS, TOTAL_CHECKPOINTS } from '../visarjan-checkpoints';
import { MANDAL_ROUTE_SCHEDULES } from '../visarjan';
import { VISARJAN_GEOMETRY } from '../visarjan-geometry';

/**
 * The generator's safety rules, asserted on its output.
 *
 * Each of these caught a real wrong answer: a "Vaibhav" 2.3 km away, a
 * road centroid standing in for a statue, and before that a Tilak Chowk
 * in Nigdi. A checkpoint in the wrong place is worse than a missing one —
 * someone stands on the wrong corner for an hour.
 */
describe('visarjan checkpoints', () => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const haversine = (ax: number, ay: number, bx: number, by: number) => {
    const dLat = toRad(by - ay);
    const dLng = toRad(bx - ax);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(ay)) * Math.cos(toRad(by)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const corridor = VISARJAN_GEOMETRY.filter((g) => g.kind === 'procession')
    .flatMap((g) => g.segments.flat());

  it('places every checkpoint on the procession corridor', () => {
    for (const c of CHECKPOINT_POINTS) {
      const off = Math.min(...corridor.map(([x, y]) => haversine(c.lng, c.lat, x, y)));
      expect(Math.round(off), `${c.place} is ${Math.round(off)} m off`).toBeLessThanOrEqual(350);
    }
  });

  it('never invents a checkpoint the mandal did not publish', () => {
    const kasba = MANDAL_ROUTE_SCHEDULES.find((s) => s.slug === 'kasba-ganpati')!;
    for (const c of CHECKPOINT_POINTS) {
      expect(
        kasba.checkpoints.some((k) => k.time === c.time && k.place === c.place),
        `${c.place} is not on the published schedule`
      ).toBe(true);
    }
    expect(CHECKPOINT_POINTS.length).toBeLessThanOrEqual(TOTAL_CHECKPOINTS);
  });

  it('walks one way down the road after joining it', () => {
    // The first point is the form-up at Mandai, 44 m back east of where
    // the procession joins Laxmi Road; the walk itself never doubles back.
    const walk = CHECKPOINT_POINTS.slice(1).map((c) => c.lng);
    for (let i = 1; i < walk.length; i += 1) {
      expect(walk[i], `checkpoint ${i} doubles back`).toBeLessThanOrEqual(walk[i - 1]);
    }
  });

  it('keeps a record of what it matched, so a bad match can be seen', () => {
    for (const c of CHECKPOINT_POINTS) {
      expect(c.osmName.length).toBeGreaterThan(0);
      expect(typeof c.offCorridorM).toBe('number');
    }
  });
});
