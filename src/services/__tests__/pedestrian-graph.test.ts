import { describe, it, expect } from 'vitest';
import {
  laneWalk, walkGeometry, touchesLanes, spliceLaneLegs,
} from '@/services/pedestrian-graph';
import { haversine, metresToPath, type LatLng } from '@/lib/geo';
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
/** Where the westward branch meets the lane down to Tulshibaug. */
const JUNCTION: LatLng = { lat: 18.514987, lng: 73.855054 };

describe('walking Dagdusheth to Tulshibaug', () => {
  it('goes round on the lanes rather than straight across the block', () => {
    const walk = laneWalk(DAGDUSHETH, TULSHIBAUG)!;
    expect(walk).not.toBeNull();
    expect(walk.metres).toBeGreaterThan(haversine(DAGDUSHETH, TULSHIBAUG));
    // Through the junction, which is the whole shape of the detour.
    expect(metresToPath(JUNCTION, walk.path.map((p) => [p.lng, p.lat]))).toBeLessThan(15);
  });

  it('cannot be walked the other way at all', () => {
    expect(laneWalk(TULSHIBAUG, DAGDUSHETH)).toBeNull();
  });

  it('starts and ends at the stops themselves, not at lane vertices', () => {
    const walk = laneWalk(DAGDUSHETH, TULSHIBAUG)!;
    expect(walk.path[0]).toEqual(DAGDUSHETH);
    expect(walk.path[walk.path.length - 1]).toEqual(TULSHIBAUG);
  });
});

describe('the line drawn for a whole walk', () => {
  it('follows the lanes instead of joining the stops directly', () => {
    const stops = [DAGDUSHETH, TULSHIBAUG, JILBYA];
    const line = walkGeometry(stops);
    expect(line.length).toBeGreaterThan(stops.length);
    expect(metresToPath(JUNCTION, line)).toBeLessThan(15);
  });

  it('never repeats a point, so every segment has a direction', () => {
    // A zero-length segment has no bearing, and the arrowhead placed on it
    // would point at nothing.
    const line = walkGeometry([DAGDUSHETH, TULSHIBAUG, JILBYA]);
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
    const walk = laneWalk(DAGDUSHETH, TULSHIBAUG)!;
    // A deliberately wrong routed line: straight across the block.
    const routed: [number, number][] = [
      [DAGDUSHETH.lng, DAGDUSHETH.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
    ];
    const spliced = spliceLaneLegs(routed, [DAGDUSHETH, TULSHIBAUG]);
    expect(spliced.length).toBe(walk.path.length);
    expect(metresToPath(JUNCTION, spliced)).toBeLessThan(15);
  });

  it('keeps the router on one leg and the lane on another', () => {
    const routed: [number, number][] = [
      [KASBA.lng, KASBA.lat],
      [KASBA.lng + 0.0003, KASBA.lat - 0.0008],
      [DAGDUSHETH.lng, DAGDUSHETH.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
    ];
    const spliced = spliceLaneLegs(routed, [KASBA, DAGDUSHETH, TULSHIBAUG]);
    // The router's wandering vertex on the first leg survives...
    expect(spliced).toContainEqual([KASBA.lng + 0.0003, KASBA.lat - 0.0008]);
    // ...and the second leg goes round by the junction.
    expect(metresToPath(JUNCTION, spliced)).toBeLessThan(15);
  });

  it('never leaves two identical points behind', () => {
    const routed: [number, number][] = [
      [DAGDUSHETH.lng, DAGDUSHETH.lat],
      [TULSHIBAUG.lng, TULSHIBAUG.lat],
      [JILBYA.lng, JILBYA.lat],
    ];
    const spliced = spliceLaneLegs(routed, [DAGDUSHETH, TULSHIBAUG, JILBYA]);
    for (let i = 1; i < spliced.length; i++) {
      expect(spliced[i], `duplicate at ${i}`).not.toEqual(spliced[i - 1]);
    }
  });
});
