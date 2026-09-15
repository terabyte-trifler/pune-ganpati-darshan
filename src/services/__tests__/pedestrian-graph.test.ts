import { describe, it, expect } from 'vitest';
import {
  laneWalk, walkGeometry, touchesLanes, spliceLaneLegs, laneExitsFrom,
} from '@/services/pedestrian-graph';
import { haversine, metresToPath, type LatLng } from '@/lib/geo';
import { legCostFactor } from '@/services/pedestrian-flow';
import catalogue from '@/content/catalogue.json';

/**
 * The lanes as something you can route on.
 *
 * Everything here is checked against the real catalogue and the real
 * coordinates reported from the ground, because the whole point of the
 * graph is that it describes one particular set of streets.
 */

const at = (slug: string): LatLng => {
  const g = (catalogue.ganpatis as Array<{ slug: string; latitude: number; longitude: number }>)
    .find((x) => x.slug === slug);
  if (!g) throw new Error(`no mandal ${slug}`);
  return { lat: g.latitude, lng: g.longitude };
};

const DAGDUSHETH = at('dagdusheth-halwai-ganpati');
const TULSHIBAUG = at('tulshibaug-ganpati');
const JILBYA = at('jilbya-maruti-mandal');
const GURUJI_TALIM = at('guruji-talim');
/** Where the westward branch meets the lane down to Tulshibaug. */
const JUNCTION: LatLng = { lat: 18.514987, lng: 73.855054 };

describe('walking Guruji Talim to Tulshibaug', () => {
  it('goes down the lane rather than straight across the block', () => {
    const walk = laneWalk(GURUJI_TALIM, TULSHIBAUG)!;
    expect(walk).not.toBeNull();
    expect(walk.metres).toBeGreaterThan(haversine(GURUJI_TALIM, TULSHIBAUG));
    expect(metresToPath(JUNCTION, walk.path.map((p) => [p.lng, p.lat]))).toBeLessThan(15);
  });

  it('cannot be walked the other way at all', () => {
    expect(laneWalk(TULSHIBAUG, GURUJI_TALIM)).toBeNull();
  });

  it('starts and ends at the stops themselves, not at lane vertices', () => {
    const walk = laneWalk(GURUJI_TALIM, TULSHIBAUG)!;
    expect(walk.path[0]).toEqual(GURUJI_TALIM);
    expect(walk.path[walk.path.length - 1]).toEqual(TULSHIBAUG);
  });
});

describe('Dagdusheth and Tulshibaug are not connected by any legal walk', () => {
  /**
   * These tests used to assert the opposite, and were wrong.
   *
   * The lane graph offered a 284 m walk between them, and its first step
   * was 50 m at bearing 332 — due north, straight up the southbound lane —
   * to reach the two-way branch that begins just past Dagdusheth. Joining
   * the network was an unchecked straight hop, so our own path walked a
   * one-way in reverse and our own tests blessed it.
   *
   * With joins subject to the lanes, neither direction has a legal walk in
   * the data we hold. That is the honest answer: the cost falls to
   * NO_ROUTE_FACTOR, the ordering puts the pair the other way round, and
   * the drawn line comes from the router, which knows streets we do not.
   */
  it('has no lane walk in either direction', () => {
    expect(laneWalk(DAGDUSHETH, TULSHIBAUG)).toBeNull();
    expect(laneWalk(TULSHIBAUG, DAGDUSHETH)).toBeNull();
  });

  it('never starts a walk by going back up a lane', () => {
    // The specific shape of the bug: a first step heading north out of
    // Dagdusheth, where the crowd only goes south.
    for (const to of [TULSHIBAUG, JILBYA, at('guruji-talim')]) {
      const walk = laneWalk(DAGDUSHETH, to);
      if (!walk) continue;
      expect(walk.path[1].lat, 'first step goes north out of Dagdusheth')
        .toBeLessThanOrEqual(DAGDUSHETH.lat + 0.0002);
    }
  });
});

describe('the line drawn for a whole walk', () => {
  it('follows the lanes instead of joining the stops directly', () => {
    const stops = [GURUJI_TALIM, TULSHIBAUG, JILBYA];
    const line = walkGeometry(stops);
    expect(line.length).toBeGreaterThan(stops.length);
    expect(metresToPath(JUNCTION, line)).toBeLessThan(15);
  });

  it('never repeats a point, so every segment has a direction', () => {
    // A zero-length segment has no bearing, and the arrowhead placed on it
    // would point at nothing.
    const line = walkGeometry([GURUJI_TALIM, TULSHIBAUG, JILBYA]);
    for (let i = 1; i < line.length; i++) {
      expect(line[i], `duplicate point at ${i}`).not.toEqual(line[i - 1]);
    }
  });

  it('runs straight where the lanes have nothing to say', () => {
    const shivajinagar = { lat: 18.5308, lng: 73.8478 };
    const kothrud = { lat: 18.5074, lng: 73.8077 };
    expect(walkGeometry([shivajinagar, kothrud])).toHaveLength(2);
  });

  it('leaves a one-stop walk alone', () => {
    expect(walkGeometry([DAGDUSHETH])).toEqual([[DAGDUSHETH.lng, DAGDUSHETH.lat]]);
  });
});

describe('knowing when the lanes apply at all', () => {
  it('is true in the peth cluster and false across the city', () => {
    expect(touchesLanes(DAGDUSHETH)).toBe(true);
    expect(touchesLanes(TULSHIBAUG)).toBe(true);
    expect(touchesLanes({ lat: 18.5074, lng: 73.8077 })).toBe(false);
  });
});

describe('keeping the router for everything the lanes do not cover', () => {
  const KASBA = at('kasba-ganpati');
  const BHAU_RANGARI = at('bhau-rangari-ganpati');

  it('leaves a leg with no lane exactly as the router drew it', () => {
    // Neither of these is within reach of a lane, and the walk between
    // them is a real street. Drawing it straight put a line through the
    // buildings instead of down Shivaji Road.
    expect(laneWalk(KASBA, BHAU_RANGARI)).toBeNull();

    // A stand-in for a routed line: several vertices that wander off the
    // straight line, exactly as a road does.
    const routed: [number, number][] = [
      [KASBA.lng, KASBA.lat],
      [KASBA.lng + 0.0004, KASBA.lat - 0.0005],
      [KASBA.lng + 0.0002, KASBA.lat - 0.0011],
      [BHAU_RANGARI.lng, BHAU_RANGARI.lat],
    ];
    expect(spliceLaneLegs(routed, [KASBA, BHAU_RANGARI])).toEqual(routed);
  });

  it('replaces a leg the lanes do cover, however the router drew it', () => {
    const walk = laneWalk(GURUJI_TALIM, TULSHIBAUG)!;
    // A deliberately wrong routed line: straight across the block.
    const routed: [number, number][] = [
      [GURUJI_TALIM.lng, GURUJI_TALIM.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
    ];
    const spliced = spliceLaneLegs(routed, [GURUJI_TALIM, TULSHIBAUG]);
    expect(spliced.length).toBe(walk.path.length);
    expect(metresToPath(JUNCTION, spliced)).toBeLessThan(15);
  });

  it('keeps the router on one leg and the lane on another', () => {
    const routed: [number, number][] = [
      [KASBA.lng, KASBA.lat],
      [KASBA.lng + 0.0003, KASBA.lat - 0.0008],
      [GURUJI_TALIM.lng, GURUJI_TALIM.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
    ];
    const spliced = spliceLaneLegs(routed, [KASBA, GURUJI_TALIM, TULSHIBAUG]);
    // The router's wandering vertex on the first leg survives...
    expect(spliced).toContainEqual([KASBA.lng + 0.0003, KASBA.lat - 0.0008]);
    // ...and the second leg goes round by the junction.
    expect(metresToPath(JUNCTION, spliced)).toBeLessThan(15);
  });

  it('never leaves two identical points behind', () => {
    const routed: [number, number][] = [
      [GURUJI_TALIM.lng, GURUJI_TALIM.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
      [JILBYA.lng, JILBYA.lat],
    ];
    const spliced = spliceLaneLegs(routed, [GURUJI_TALIM, TULSHIBAUG, JILBYA]);
    for (let i = 1; i < spliced.length; i++) {
      expect(spliced[i], `duplicate at ${i}`).not.toEqual(spliced[i - 1]);
    }
  });
});

describe('joining a lane where you actually stand', () => {
  const HUTATMA = at('hutatma-babu-genu-mandal');

  it('does not overshoot a mandal that sits between two corners', () => {
    // The regression this covers: Hutatma Babu Genu stands beside the main
    // southward lane with no vertex next to it. Joining only at vertices
    // sent the walk 179 m south to the next corner and then 42 m back
    // NORTH to reach it — a U-turn, drawn on a lane that only runs south,
    // which is the one instruction the feature exists to give.
    const walk = laneWalk(DAGDUSHETH, HUTATMA)!;
    expect(walk).not.toBeNull();

    const straight = haversine(DAGDUSHETH, HUTATMA);
    // Room for a real detour, but not for passing it and coming back.
    expect(walk.metres).toBeLessThan(straight * 1.5);

    // And nothing on the path is further south than the destination.
    for (const p of walk.path) {
      expect(p.lat, `${p.lat} is south of Hutatma`).toBeGreaterThan(HUTATMA.lat - 0.0002);
    }
  });

  it('still refuses the northward direction it cannot walk', () => {
    expect(laneWalk(HUTATMA, DAGDUSHETH)).toBeNull();
  });

  it('counts a mandal beside a lane as on it', () => {
    // touchesLanes measures to the lanes, not to their corners.
    expect(touchesLanes(HUTATMA)).toBe(true);
  });
});

/**
 * You cannot turn round at Tulshibaug.
 *
 * Reported in as many words: no U-turn there in any direction — you go on
 * towards Jilbya Maruti, or you take the right lane. A stop standing on
 * the lane network can only be left the ways the crowd leaves it, and
 * before this the planner was free to walk back out the way it came in.
 */
describe('leaving a stop the way the crowd leaves it', () => {
  const TAMBDI = at('tambdi-jogeshwari');
  const KASBA = at('kasba-ganpati');

  it('knows the ways out of Tulshibaug', () => {
    const exits = laneExitsFrom(TULSHIBAUG);
    expect(exits).toHaveLength(2);
    // On towards Jilbya Maruti, and the lane east.
    expect(exits.some((b) => Math.abs(b - 245) < 20)).toBe(true);
    expect(exits.some((b) => Math.abs(b - 102) < 20)).toBe(true);
  });

  it('refuses to send a walker back north out of Tulshibaug', () => {
    for (const north of [DAGDUSHETH, TAMBDI, KASBA, GURUJI_TALIM]) {
      expect(
        legCostFactor(TULSHIBAUG, north, 'walk'),
        'a U-turn out of Tulshibaug'
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it('still allows the two ways the crowd does leave', () => {
    expect(legCostFactor(TULSHIBAUG, JILBYA, 'walk')).toBeLessThan(2);
    expect(legCostFactor(TULSHIBAUG, at('hutatma-babu-genu-mandal'), 'walk')).toBeLessThan(2);
  });

  it('leaves somewhere no lane starts completely alone', () => {
    // Most of the city. A stop with no lane leaving it has no constraint.
    expect(laneExitsFrom({ lat: 18.5074, lng: 73.8077 })).toHaveLength(0);
  });
});
