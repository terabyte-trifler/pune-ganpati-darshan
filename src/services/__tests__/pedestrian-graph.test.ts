import { describe, it, expect } from 'vitest';
import { laneWalk, walkGeometry, touchesLanes } from '@/services/pedestrian-graph';
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
