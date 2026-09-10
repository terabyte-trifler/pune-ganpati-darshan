import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { addMetroLayers, metroFeatureCollection, METRO_SOURCE } from '@/lib/maps/metro-layer';
import { DARSHAN_STATIONS } from '@/lib/metro';

/**
 * Stations on every map.
 *
 * The layer lived in the full-screen map alone, so route maps, the planner,
 * the wizard and every mandal page drew the peths with no way in marked on
 * them. These tests pin both halves: that the layer is correct, and that
 * nothing draws a map without it.
 */

/** Enough of a MapLibre map to record what a caller did to it. */
function stubMap() {
  const sources = new Map<string, unknown>();
  const layers: { id: string; minzoom?: number }[] = [];
  return {
    map: {
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, spec: unknown) => sources.set(id, spec),
      addLayer: (layer: { id: string; minzoom?: number }) => layers.push(layer),
    } as unknown as MapLibreMap,
    sources,
    layers,
  };
}

describe('metro layer', () => {
  it('carries every darshan station and nothing else', () => {
    const fc = metroFeatureCollection();
    expect(fc.features).toHaveLength(DARSHAN_STATIONS.length);
    // Network stations must not leak in — Ramwadi on a peth map is noise.
    const names = fc.features.map((f) => f.properties?.name);
    expect(names).toContain('Kasba Peth');
    expect(names).not.toContain('Ramwadi');
  });

  it('marks the exit-only station so it cannot be drawn as an arrival', () => {
    const fc = metroFeatureCollection();
    const mandai = fc.features.find((f) => f.properties?.name === 'Mandai');
    expect(mandai?.properties?.canAlight).toBe(false);
    const kasba = fc.features.find((f) => f.properties?.name === 'Kasba Peth');
    expect(kasba?.properties?.canAlight).toBe(true);
  });

  it('places coordinates as [lng, lat], which is the way round GeoJSON wants', () => {
    // Swapping these puts Pune in the Indian Ocean and is invisible until
    // someone opens a map.
    for (const f of metroFeatureCollection().features) {
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
      expect(lat).toBeGreaterThan(18); expect(lat).toBeLessThan(19);
      expect(lng).toBeGreaterThan(73); expect(lng).toBeLessThan(74);
    }
  });

  it('adds one source and both tiers of halo, dot and label', () => {
    const { map, sources, layers } = stubMap();
    addMetroLayers(map);

    expect([...sources.keys()]).toEqual([METRO_SOURCE]);
    expect(layers.map((l) => l.id)).toEqual([
      'metro-halo-primary', 'metro-dot-primary', 'metro-label-primary',
      'metro-halo-secondary', 'metro-dot-secondary', 'metro-label-secondary',
    ]);
  });

  it('shows the across-the-river stations later than the peth ones', () => {
    const { map, layers } = stubMap();
    addMetroLayers(map);
    const zoomOf = (id: string) => layers.find((l) => l.id === id)!.minzoom!;

    expect(zoomOf('metro-dot-secondary')).toBeGreaterThan(zoomOf('metro-dot-primary'));
    // A name is only worth the clutter once you are close enough to walk.
    expect(zoomOf('metro-label-primary')).toBeGreaterThan(zoomOf('metro-dot-primary'));
  });

  it('is safe to call twice', () => {
    const { map, layers } = stubMap();
    addMetroLayers(map);
    addMetroLayers(map);
    // MapLibre throws on a duplicate source id, which would take the map
    // down rather than double-draw.
    expect(layers).toHaveLength(6);
  });

  it('is used by every component that builds a map', () => {
    // The invariant the whole change exists for. A new map component that
    // forgets this reintroduces exactly the gap being fixed, and it would
    // look fine — the mandals would still be there.
    const dir = join(process.cwd(), 'src/features/map');
    const builders = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => ({ f, src: readFileSync(join(dir, f), 'utf8') }))
      .filter(({ src }) => src.includes('new MapLibreMap('));

    expect(builders.length, 'no map components found — did they move?').toBeGreaterThan(1);
    for (const { f, src } of builders) {
      expect(src, `${f} builds a map without metro stations`).toContain('addMetroLayers');
    }
  });
});
