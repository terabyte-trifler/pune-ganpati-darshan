import { describe, it, expect } from 'vitest';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import { parkingFeatureCollection } from '@/lib/maps/parking-layer';
import catalogue from '@/content/catalogue.json';
import { haversine } from '@/lib/geo';

/**
 * The parking list is transcribed from someone else's map, so what is
 * worth testing is that the transcription cannot rot: coordinates in the
 * right city, no duplicates, and every display name still traceable to
 * the label the police published.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALL = ((catalogue as any).ganpatis ?? (catalogue as any).items) as any[];
/* eslint-enable @typescript-eslint/no-explicit-any */

describe('the police parking list', () => {
  it('keeps the source and the credit with the data', () => {
    // Without this the list is just 23 anonymous coordinates, and nobody
    // can check it or decide whether to trust it.
    expect(PARKING_SOURCE.authority).toMatch(/Traffic Police/);
    expect(PARKING_SOURCE.credit).toContain('Anish Shelar');
    expect(PARKING_SOURCE.url).toMatch(/^https:\/\//);
  });

  it('has every entry numbered by the police, with no duplicates', () => {
    const nos = PARKING.map((p) => p.no);
    expect(new Set(nos).size).toBe(nos.length);
    // The gaps are the source's. Asserted so nobody "tidies" them later
    // by inventing the missing four.
    expect(nos).not.toContain(8);
    expect(nos).not.toContain(18);
    expect(nos).not.toContain(23);
    expect(nos).not.toContain(24);
  });

  it('sits inside Pune', () => {
    for (const p of PARKING) {
      expect(p.lat, p.name).toBeGreaterThan(18.4);
      expect(p.lat, p.name).toBeLessThan(18.65);
      expect(p.lng, p.name).toBeGreaterThan(73.75);
      expect(p.lng, p.name).toBeLessThan(73.95);
    }
  });

  it('is within walking reach of at least one mandal', () => {
    // A parking list is only useful near the mandals. If a coordinate is
    // ever mistyped, this is where it shows: the nearest mandal jumps to
    // kilometres away.
    for (const p of PARKING) {
      const nearest = Math.min(
        ...ALL.map((g) => haversine({ lat: p.lat, lng: p.lng }, { lat: g.latitude, lng: g.longitude }))
      );
      expect(Math.round(nearest), `${p.name} is ${Math.round(nearest)}m from any mandal`)
        .toBeLessThan(3_000);
    }
  });

  it('keeps the published label beside every tidied name', () => {
    for (const p of PARKING) {
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.sourceName.length).toBeGreaterThan(2);
      // The tidied name must not be a rewrite. Compared on letters only,
      // because tidying is exactly what changes spacing and punctuation:
      // "HV Desai College Parking" became "H. V. Desai College".
      // The word "parking" is dropped from every display name — every row
      // here is parking — so it comes off the source before comparing,
      // along with the leading number.
      const letters = (v: string) =>
        v.toLowerCase().replace(/pa+rking/g, '').replace(/[^a-z]/g, '');
      const source = letters(p.sourceName.replace(/^\d+\s*\.?\s*/, ''));
      const stem = source.slice(0, Math.min(5, source.length));
      expect(letters(p.name), `${p.name} vs ${p.sourceName}`).toContain(stem);
    }
  });

  it('tells the map which entries are roads rather than yards', () => {
    const fc = parkingFeatureCollection();
    expect(fc.features).toHaveLength(PARKING.length);
    const stretches = fc.features.filter((f) => f.properties?.kind === 'stretch');
    expect(stretches.length).toBeGreaterThan(0);
    // A stretch must never be labelled as though it were a gate.
    for (const f of stretches) {
      expect(String(f.properties?.label)).toMatch(/along the road/);
    }
  });
});

describe('the closures and junctions', () => {
  it('keeps the police layer title, so the hours are quoted not invented', async () => {
    const { CLOSURE_LAYER_TITLE, DIVERSION_SOURCE } = await import('@/content/diversions');
    expect(CLOSURE_LAYER_TITLE).toBe('Road Closures after 17:00');
    // Same capture of the same map as the parking list, deliberately.
    expect(DIVERSION_SOURCE.url).toBe(PARKING_SOURCE.url);
  });

  it('draws every closure as a line with at least two points', async () => {
    const { ROAD_CLOSURES } = await import('@/content/diversions');
    const { closureFeatureCollection } = await import('@/lib/maps/closures-layer');
    expect(ROAD_CLOSURES).toHaveLength(13);
    for (const c of ROAD_CLOSURES) {
      expect(c.path.length, c.name).toBeGreaterThanOrEqual(2);
      for (const [lng, lat] of c.path) {
        expect(lat, c.name).toBeGreaterThan(18.4);
        expect(lat, c.name).toBeLessThan(18.65);
        expect(lng, c.name).toBeGreaterThan(73.75);
        expect(lng, c.name).toBeLessThan(73.95);
      }
    }
    // Every drawn closure states the hours on the map itself.
    for (const f of closureFeatureCollection().features) {
      expect(String(f.properties?.label)).toMatch(/after 17:00/);
    }
  });

  it('never says what happens at a junction', async () => {
    const { CLOSURE_JUNCTIONS } = await import('@/content/diversions');
    expect(CLOSURE_JUNCTIONS).toHaveLength(23);
    // The source labels these pins with a place name only. Any verb here
    // would be an instruction invented on the police's behalf.
    for (const j of CLOSURE_JUNCTIONS) {
      expect(j.name, j.name).not.toMatch(/no entry|diverted|closed|barricade|one way/i);
      expect(j.sourceName.length).toBeGreaterThan(2);
    }
    // Eleven of them are unnumbered on the map; that stays visible.
    expect(CLOSURE_JUNCTIONS.filter((j) => j.no === null)).toHaveLength(11);
  });
});
