'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type ErrorEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DARK_MAP_STYLE, OSM_ATTRIBUTION } from '@/lib/maps/map-style';
import { buildMarkerSvg } from '@/lib/maps/markers';
import { isWebglAvailable } from '@/lib/maps/webgl';
import { PUNE_CENTER, boundsOf, type LatLng } from '@/lib/geo';
import type { Ganpati, GanpatiCategory } from '@/types/ganpati';

/**
 * The map.
 *
 * Mandals are a single clustered GeoJSON source rather than one marker object
 * each: MapLibre clusters on the GPU and only renders what is on screen, so
 * panning stays smooth on a mid-range Android even as the catalogue grows
 * past the current 18 (§34).
 *
 * React owns *which* mandals are shown; this component owns the map objects
 * and updates them imperatively, so selecting a marker never re-renders the
 * list behind it.
 */

const SOURCE = 'mandals';
const CATEGORIES: GanpatiCategory[] = ['maanache', 'famous', 'historic', 'local'];

export type MapFailure = 'webgl' | 'init' | 'tiles';

export interface MapCanvasProps {
  ganpatis: Ganpati[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  userLocation: LatLng | null;
  routeGeometry?: [number, number][] | null;
  onReady?: (ok: boolean, failure?: MapFailure) => void;
}

function toFeatureCollection(ganpatis: Ganpati[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ganpatis.map((g) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.location.lng, g.location.lat] },
      properties: {
        slug: g.slug,
        name: g.name,
        category: g.category,
        // Negated in symbol-sort-key so rank 1 draws above rank 5.
        manacheRank: g.manacheRank ?? 0,
      },
    })),
  };
}

/** Loads an SVG data URI into the map's image registry. */
async function registerPin(map: MapLibreMap, category: GanpatiCategory, selected: boolean) {
  const id = `pin-${category}${selected ? '-sel' : ''}`;
  if (map.hasImage(id)) return;

  const { url, size } = buildMarkerSvg(category, selected);
  const image = new Image(size * 2, size * 2);
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
  if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 2 });
}

export function MapCanvas({
  ganpatis, selectedSlug, onSelect, userLocation, routeGeometry, onReady,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [idle, setIdle] = useState(false);

  // Latest callbacks without re-running map setup.
  const onSelectRef = useRef(onSelect);
  const onReadyRef = useRef<MapCanvasProps['onReady']>(onReady);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  /* ---------------- Create the map once ---------------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Check before constructing: MapLibre throws on a missing WebGL context,
    // and an uncaught throw here unmounts the whole route.
    if (!isWebglAvailable()) {
      onReadyRef.current?.(false, 'webgl');
      return;
    }

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: DARK_MAP_STYLE,
        center: [PUNE_CENTER.lng, PUNE_CENTER.lat],
        zoom: 13.5,
        minZoom: 10,
        maxZoom: 19,
        attributionControl: false,
        // The sheet covers the lower half; keep gestures simple and predictable.
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch (error) {
      // Defence in depth: a driver can fail even when the probe succeeded.
      console.error('[map] failed to initialise', error);
      onReadyRef.current?.(false, 'init');
      return;
    }
    mapRef.current = map;

    map.addControl(
      new AttributionControl({ compact: true, customAttribution: OSM_ATTRIBUTION }),
      'bottom-left'
    );

    map.on('load', async () => {
      await Promise.all(
        CATEGORIES.flatMap((c) => [registerPin(map, c, false), registerPin(map, c, true)])
      );

      map.addSource(SOURCE, {
        type: 'geojson',
        data: toFeatureCollection([]),
        cluster: true,
        // Tuned against the real spread: the peth core is ~2 km across, so at
        // the default framing individual pins are already distinguishable.
        // Clustering past that showed counts instead of mandals, which defeats
        // the point of the map — the product question is "which Ganpati next",
        // and a badge reading "6" does not answer it.
        clusterRadius: 38,
        clusterMaxZoom: 12,
      });

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#E2621B', 'line-width': 4, 'line-opacity': 0.9 },
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#E2621B',
          'circle-opacity': 0.9,
          'circle-stroke-color': '#14100C',
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#14100C' },
      });

      map.addLayer({
        id: 'mandals',
        type: 'symbol',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          'icon-size': 0.5,
          'icon-allow-overlap': true,
          'symbol-sort-key': ['-', 0, ['get', 'manacheRank']],
        },
      });

      map.on('click', 'clusters', async (e: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = map.getSource(SOURCE) as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId as number);
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
          duration: 400,
        });
      });

      map.on('click', 'mandals', (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
        const slug = e.features?.[0]?.properties?.slug;
        if (typeof slug === 'string') onSelectRef.current(slug);
      });

      // Tapping empty map clears the selection.
      map.on('click', (e: MapMouseEvent) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['mandals', 'clusters'] });
        if (hits.length === 0) onSelectRef.current(null);
      });

      for (const layer of ['mandals', 'clusters']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }

      // The container can be laid out after the map is constructed (the
      // dynamic import swaps out a skeleton first), and MapLibre caches the
      // size it saw at construction. Without this it computes a zero-sized
      // viewport and never requests a single tile.
      map.resize();

      setReady(true);
      onReadyRef.current?.(true);
    });

    // 'idle' means every tile for the current view is loaded and drawn.
    map.on('idle', () => setIdle(true));
    map.on('movestart', () => setIdle(false));

    map.on('error', (e: ErrorEvent) => {
      const message = String(e.error?.message ?? e.error ?? 'unknown');

      // Always surface the reason. Silently swallowing map errors hides real
      // failures — an earlier version only reported ones mentioning "style"
      // and turned a blank map into a mystery.
      console.error('[map]', message);

      // A missing tile or glyph at the edges is survivable; a style or source
      // failure means nothing will ever render.
      if (/style|source|sprite/i.test(message)) onReadyRef.current?.(false, 'tiles');
    });

    // Keep the map in step with its container for later changes too:
    // rotation, the browser toolbar collapsing, or the sheet resizing.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---------------- Data ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(ganpatis));
  }, [ganpatis, ready]);

  /* ---------------- Selection ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getLayer('mandals')) return;

    // Only the selected pin uses the larger artwork.
    map.setLayoutProperty('mandals', 'icon-image', [
      'concat',
      'pin-',
      ['get', 'category'],
      ['case', ['==', ['get', 'slug'], selectedSlug ?? ' '], '-sel', ''],
    ]);

    if (!selectedSlug) return;
    const target = ganpatis.find((g) => g.slug === selectedSlug);
    if (target) {
      map.easeTo({
        center: [target.location.lng, target.location.lat],
        zoom: Math.max(map.getZoom(), 16),
        duration: 500,
      });
    }
  }, [selectedSlug, ganpatis, ready]);

  /* ---------------- Fit to the filtered set ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || ganpatis.length === 0 || selectedSlug) return;

    // Framing the full set is wrong on first load: Chinchwad sits ~15 km
    // north-west of the peths, so fitting all 18 mandals shrinks the area
    // that 16 of them (and essentially every walking route) live in down to
    // a smudge. Frame the core instead unless the user has filtered to a set
    // that genuinely sits outside it.
    const core = ganpatis.filter((g) => g.area.isCore);
    const framed = core.length >= 2 && core.length === ganpatis.length ? core
      : core.length >= 2 && ganpatis.length > core.length ? core
      : ganpatis;

    const b = boundsOf(framed.map((g) => ({ lat: g.location.lat, lng: g.location.lng })));
    map.fitBounds(
      [[b.west, b.south], [b.east, b.north]],
      // Room for the search pill above and the sheet below.
      { padding: { top: 96, right: 40, bottom: 200, left: 40 }, duration: 500, maxZoom: 16 }
    );
    // Deliberately not reacting to selectedSlug: refitting on every selection
    // would fight the easeTo above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganpatis, ready]);

  /* ---------------- Route overlay ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource('route') as GeoJSONSource | undefined;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: routeGeometry ?? [] },
    });
  }, [routeGeometry, ready]);

  /* ---------------- User location ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:9999px;background:#6fc47f;' +
        'border:2px solid #14100c;box-shadow:0 0 0 6px rgba(78,138,91,.28)';
      el.setAttribute('aria-label', 'Your location');
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
  }, [userLocation, ready]);

  return (
    // Sized with h-full/w-full rather than `absolute inset-0`: maplibre-gl.css
    // sets `.maplibregl-map { position: relative }` and is injected after
    // Tailwind, so it wins on source order and defeats `absolute`. That left a
    // relative block with no height, which collapsed to 0 and meant MapLibre
    // never requested a single tile. Explicit sizing does not depend on which
    // position rule wins.
    <div
      ref={containerRef}
      role="application"
      aria-label="Map of Pune Ganpati mandals"
      // Exposed so tests can wait for a genuinely rendered map rather than
      // sleeping and hoping.
      data-map-ready={ready ? 'true' : 'false'}
      data-map-idle={idle ? 'true' : 'false'}
      className="h-full w-full bg-[var(--raat)]"
    />
  );
}
