import { describe, it, expect } from 'vitest';
import {
  corridorFeatureCollection, visarjanClosureFeatureCollection,
  DRAWN_CLOSURES, TOTAL_CLOSURES,
} from '../visarjan-layer';
import { VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';
import { VISARJAN_CLOSURES } from '@/content/visarjan';

/**
 * These guard the generator, not the rendering.
 *
 * Every failure this file checks for is one the generator actually
 * produced at some point: a loose name pattern that swept in Laxminagar
 * Road, and a stitch that collapsed Karve Road to four points. Both drew
 * something plausible-looking in the wrong place, which is the only kind
 * of bug that matters on a map people navigate a city by.
 */
describe('visarjan map layers', () => {
  // Central Pune. Anything outside this is a different city's road.
  const BOUNDS = { minLat: 18.49, maxLat: 18.53, minLng: 73.82, maxLng: 73.88 };

  it('keeps every drawn coordinate inside central Pune', () => {
    for (const g of VISARJAN_GEOMETRY) {
      for (const [lng, lat] of g.segments.flat()) {
        expect(lat, `${g.road} lat`).toBeGreaterThanOrEqual(BOUNDS.minLat);
        expect(lat, `${g.road} lat`).toBeLessThanOrEqual(BOUNDS.maxLat);
        expect(lng, `${g.road} lng`).toBeGreaterThanOrEqual(BOUNDS.minLng);
        expect(lng, `${g.road} lng`).toBeLessThanOrEqual(BOUNDS.maxLng);
      }
    }
  });

  it('gives every road enough points to be a road', () => {
    // Karve Road once survived as four points after a bad stitch.
    for (const g of VISARJAN_GEOMETRY) {
      const points = g.segments.flat().length;
      expect(points, `${g.road} has ${points} points`).toBeGreaterThanOrEqual(8);
    }
  });

  it('draws all four roads the procession takes', () => {
    const drawn = corridorFeatureCollection().features.map((f) => f.properties?.name);
    expect(drawn).toEqual(
      expect.arrayContaining(['Laxmi Road', 'Tilak Road', 'Kumthekar Road', 'Kelkar Road'])
    );
  });

  it('labels every closure with the hour from the notice', () => {
    for (const f of visarjanClosureFeatureCollection().features) {
      const road = f.properties?.name as string;
      const notice = VISARJAN_CLOSURES.find((c) => c.road === road);
      expect(notice, `${road} is not in the notice`).toBeDefined();
      expect(f.properties?.label).toBe(`Closed from ${notice?.from}`);
    }
  });

  it('never claims to draw more closures than the notice lists', () => {
    expect(DRAWN_CLOSURES).toBeLessThanOrEqual(TOTAL_CLOSURES);
    expect(TOTAL_CLOSURES).toBe(VISARJAN_CLOSURES.length);
  });

  it('only draws a stretch whose end points are both recorded', () => {
    for (const g of VISARJAN_GEOMETRY.filter((x) => x.kind === 'closure')) {
      expect(g.extent).toBe('stretch');
      expect(g.from, `${g.road} from`).toBeTruthy();
      expect(g.to, `${g.road} to`).toBeTruthy();
    }
  });
});
