import { describe, it, expect } from 'vitest';
import {
  corridorFeatureCollection, visarjanClosureFeatureCollection,
  visarjanParkingFeatureCollection, checkpointFeatureCollection,
  diversionFeatureCollection, visarjanTapLabel, VISARJAN_TAP_LAYERS,
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

  describe('tapping a mark names it', () => {
    it('names every parking place', () => {
      const features = visarjanParkingFeatureCollection().features;
      expect(features.length).toBeGreaterThan(0);
      for (const f of features) {
        const label = visarjanTapLabel('visarjan-parking', f.properties);
        expect(label?.title, JSON.stringify(f.properties)).toBeTruthy();
      }
    });

    it('leads a checkpoint with its hour', () => {
      for (const f of checkpointFeatureCollection().features) {
        const label = visarjanTapLabel('visarjan-checkpoint', f.properties);
        expect(label?.title).toMatch(/^\d{2}:\d{2} · /);
      }
    });

    it('names every diversion point', () => {
      for (const f of diversionFeatureCollection().features) {
        expect(visarjanTapLabel('visarjan-diversion', f.properties)?.title).toBeTruthy();
      }
    });

    it('says nothing rather than guessing', () => {
      // A popup with an empty title is worse than no popup: it reads as
      // a mark the app cannot identify.
      expect(visarjanTapLabel('visarjan-parking', null)).toBeNull();
      expect(visarjanTapLabel('visarjan-parking', { label: '  ' })).toBeNull();
      expect(visarjanTapLabel('something-else', { label: 'x' })).toBeNull();
    });

    it('covers every layer it claims to', () => {
      expect([...VISARJAN_TAP_LAYERS]).toEqual([
        'visarjan-parking', 'visarjan-checkpoint', 'visarjan-diversion',
      ]);
    });
  });

  describe('chowks shared between mandals', () => {
    it('tells you when a second procession uses the same chowk', () => {
      const shared = checkpointFeatureCollection().features.filter(
        (f) => f.properties?.alsoOn
      );
      // Dagdusheth crosses Belbaug and Ganpati Chowk, both on Kasba's list.
      expect(shared.length).toBeGreaterThanOrEqual(2);
      for (const f of shared) {
        const label = visarjanTapLabel('visarjan-checkpoint', f.properties);
        expect(label?.subtitle).toMatch(/passes here too/);
      }
    });

    it('says nothing extra where no other route passes', () => {
      const alone = checkpointFeatureCollection().features.filter(
        (f) => !f.properties?.alsoOn
      );
      expect(alone.length).toBeGreaterThan(0);
      for (const f of alone) {
        expect(
          visarjanTapLabel('visarjan-checkpoint', f.properties)?.subtitle ?? ''
        ).not.toMatch(/passes here too/);
      }
    });
  });
});
