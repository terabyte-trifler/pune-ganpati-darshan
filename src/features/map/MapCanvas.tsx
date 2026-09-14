'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type ErrorEvent,
  type ExpressionSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DARK_MAP_STYLE } from '@/lib/maps/map-style';
import { buildMarkerSvg, buildClusterPinSvg, splitPinKey } from '@/lib/maps/markers';
import { isWebglAvailable } from '@/lib/maps/webgl';
import { PUNE_CENTER, boundsOf, type LatLng } from '@/lib/geo';
import { addMetroLayers } from '@/lib/maps/metro-layer';
import { addParkingLayers } from '@/lib/maps/parking-layer';
import { addClosureLayers } from '@/lib/maps/closures-layer';
import type { Ganpati } from '@/types/ganpati';
import type { CrowdPinKey } from '@/features/crowd/crowd-display';

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

export type MapFailure = 'webgl' | 'init' | 'tiles';

export interface MapCanvasProps {
  ganpatis: Ganpati[];
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  userLocation: LatLng | null;
  routeGeometry?: [number, number][] | null;
  onReady?: (ok: boolean, failure?: MapFailure) => void;
  /**
   * Crowd level per mandal id. Absent means no recent reports, which is
   * rendered as no dot at all — never as a calm queue (§32, §33).
   */
  crowd?: Record<string, CrowdPinKey>;
}

/**
 * MapLibre's compact attribution still opens expanded on first render, which
 * covers a good part of a small map. Collapse it to the (i) button; the
 * credit stays one tap away, which is what the OpenStreetMap licence asks
 * for — it must be available, not permanently overlaid.
 */
function collapseAttribution(container: HTMLElement) {
  container
    .querySelector('.maplibregl-ctrl-attrib')
    ?.classList.remove('maplibregl-compact-show');
}

function toFeatureCollection(
  ganpatis: Ganpati[],
  crowd: Record<string, CrowdPinKey> = {}
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ganpatis.map((g) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.location.lng, g.location.lat] },
      properties: {
        slug: g.slug,
        name: g.name,
        category: g.category,
        // Both feed symbol-sort-key — see stackOrder.
        manacheRank: g.manacheRank ?? 0,
        prominence: g.prominence,
        // Omitted entirely when unknown, so the layer filter can use
        // ['has','crowd'] and unreported mandals simply get no dot.
        ...(crowd[g.id] ? { crowd: crowd[g.id] } : {}),
      },
    })),
  };
}

/**
 * Loads an SVG data URI into the map's image registry.
 *
 * Rasterised at 3x rather than 2x: phones have been 3x for years, and the
 * mark is detailed enough that the difference shows as soft edges on the ears
 * and trunk.
 */
const PIN_RASTER = 3;

/**
 * Pin images are keyed by what now decides their colour: the queue.
 *
 * Category no longer tints a pin (see lib/maps/markers), so the only
 * category that still varies the artwork is the Manache Paach, which keep
 * a heavier ring. That leaves four crowd states x manache-or-not x
 * selected-or-not, which is sixteen small images registered once — where
 * keying on category as well would have been sixty-four.
 */
/**
 * Which pin sits on top when two mandals share a spot.
 *
 * Bhausaheb Rangari and Balvikas Mandal are 37 metres apart, which at any
 * usable zoom is less than the width of a pin — so one of them was simply
 * under the other, and no amount of tapping found it. Kasba and Phani Ali
 * are 30 metres apart and have the same problem. Higher sort keys draw
 * last and therefore on top.
 *
 * Three tiers, in order:
 *
 *   selected      whatever the person just chose, always. This was the
 *                 actual bug: selecting a buried mandal changed its
 *                 artwork and left it buried, so the app answered "here
 *                 it is" by showing the neighbour.
 *   Manache Paach rank 1 above rank 5, as before.
 *   prominence    the better-known of two neighbours wins, which is the
 *                 same rule the dwell zones already use to decide which
 *                 of a too-close pair absorbs the other.
 */
function stackOrder(selectedSlug: string | null): ExpressionSpecification {
  return [
    '+',
    ['case', ['==', ['get', 'slug'], selectedSlug ?? '\u0000'], 1_000_000, 0],
    [
      'case',
      ['>', ['get', 'manacheRank'], 0],
      ['*', ['-', 6, ['get', 'manacheRank']], 10_000],
      0,
    ],
    ['coalesce', ['get', 'prominence'], 0],
  ] as ExpressionSpecification;
}

const CROWD_KEYS = [
  'none', 'short', 'moving', 'long',
  // Dwell's two, drawn half-filled: nobody reported, but enough devices
  // were seen dwelling to say something.
  'obs-short', 'obs-moving', 'obs-long',
  // The prior's three, drawn hollow. A mandal nobody has reported is no
  // longer automatically grey — see features/crowd/crowd-display.
  'est-short', 'est-moving', 'est-long',
] as const;

function pinId(crowd: string, manache: boolean, selected: boolean) {
  return `pin-${crowd}${manache ? '-m' : ''}${selected ? '-sel' : ''}`;
}

async function registerPin(
  map: MapLibreMap,
  crowd: (typeof CROWD_KEYS)[number],
  manache: boolean,
  selected: boolean
) {
  const id = pinId(crowd, manache, selected);
  if (map.hasImage(id)) return;

  const { level, fill } = splitPinKey(crowd);
  const { url, size } = buildMarkerSvg(
    manache ? 'maanache' : 'local',
    selected,
    level,
    fill
  );
  const image = new Image(size * PIN_RASTER, size * PIN_RASTER);
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
  if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: PIN_RASTER });
}

/** Loads the cluster's Ganpati artwork. Scaled per count by `icon-size`. */
async function registerClusterPin(map: MapLibreMap) {
  if (map.hasImage('cluster-pin')) return;
  const { url, size } = buildClusterPinSvg();
  const image = new Image(size * PIN_RASTER, size * PIN_RASTER);
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
  if (!map.hasImage('cluster-pin')) map.addImage('cluster-pin', image, { pixelRatio: PIN_RASTER });
}

export function MapCanvas({
  ganpatis, selectedSlug, onSelect, userLocation, routeGeometry, onReady, crowd,
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
      // No customAttribution: the TileJSON already supplies the required
      // OpenStreetMap/OpenMapTiles credit, and adding ours duplicated it.
      new AttributionControl({ compact: true }),
      'bottom-left'
    );
    /**
     * Build a pin the moment the style asks for one it does not have.
     *
     * Every one of the 36 variants — 9 crowd keys x manache x selected —
     * used to be rasterised before the source was added, 37 images at 3x
     * decoded and uploaded to the GPU on the main thread. Measured on a
     * throttled Pixel 5 that was most of 1.65s of long tasks on this
     * page, the worst single one 453ms, and almost all of it was wasted:
     * a map showing two colours and one selection needs about six of
     * those images, and `selected` variants are needed only once
     * something is selected.
     *
     * MapLibre already tells us exactly which it needs, and asks again on
     * the next frame, so building on demand is both correct and
     * self-healing rather than a guess about what will be used.
     */
    map.on('styleimagemissing', (e: { id: string }) => {
      const id = e.id;
      if (!id.startsWith('pin-') || map.hasImage(id)) return;
      const manache = id.includes('-m');
      const selected = id.endsWith('-sel');
      const crowd = id
        .slice(4)
        .replace(/-sel$/, '')
        .replace(/-m$/, '') as (typeof CROWD_KEYS)[number];
      if (!CROWD_KEYS.includes(crowd)) return;
      void registerPin(map, crowd, manache, selected);
    });

    map.on('load', async () => {
      collapseAttribution(map.getContainer());
      // Only the cluster artwork up front: it is drawn immediately at the
      // default zoom, and there is exactly one of it.
      await registerClusterPin(map);

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

      // Closures under the route on purpose: where a planned route meets a
      // closed road, the route must stay visible so the conflict is
      // obvious rather than painted over.
      /**
       * Deferred: everything that is not a mandal.
       *
       * Profiling this page on a throttled Pixel 5 put 2264ms in
       * `(program)` — native MapLibre work, WebGL context, shader
       * compilation, texture upload — against under 400ms of JavaScript
       * in total. Micro-optimising our own code cannot touch that; the
       * only lever is how much the map is asked to build before it first
       * paints.
       *
       * Mandals are the page. Closures, metro and parking are reference
       * layers somebody consults after the map is up, so they are built
       * once the browser is idle rather than in the critical path. The
       * timeout is the fallback for Safari, which has no idle callback.
       */
      const whenIdle = (fn: () => void) => {
        const w = window as unknown as {
          requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void;
        };
        if (typeof w.requestIdleCallback === 'function') {
          w.requestIdleCallback(fn, { timeout: 2000 });
        } else {
          setTimeout(fn, 350);
        }
      };

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#E2621B', 'line-width': 4, 'line-opacity': 0.9 },
      });

      // Context layers first, so the mandal pins draw on top of them.
      whenIdle(() => {
        // The map can be torn down while the callback is pending.
        if (!mapRef.current) return;
        addClosureLayers(map);
        addMetroLayers(map);
        addParkingLayers(map);
        // Closures used to be added BEFORE the mandal layers, so they drew
        // underneath the pins. Adding them later puts them on top, which
        // would bury the thing the page is about — so the mandal layers
        // are lifted back to the front once the reference layers land.
        for (const id of ['clusters', 'cluster-count', 'mandals']) {
          if (map.getLayer(id)) map.moveLayer(id);
        }
      });

      // A cluster is several mandals, so it is drawn as a Ganpati too —
      // brass rather than vermilion, and larger the more it holds. It was a
      // bare orange disc, the only thing on the map that marked mandals
      // without looking like one.
      map.addLayer({
        id: 'clusters',
        type: 'symbol',
        source: SOURCE,
        filter: ['has', 'point_count'],
        layout: {
          'icon-image': 'cluster-pin',
          'icon-size': ['step', ['get', 'point_count'], 0.58, 10, 0.72, 25, 0.86],
          // Clusters sit close together at low zoom; without this MapLibre
          // drops the colliding ones and mandals silently vanish.
          'icon-allow-overlap': true,
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
          'text-size': 12,
          // Offset to the pin's shoulder so the count reads as a badge on the
          // Ganpati rather than covering its face.
          'text-offset': [1.15, -1.05],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#F6EFE3',
          // Stands in for a badge: a solid halo keeps the count legible over
          // both the pin and whatever street is behind it.
          'text-halo-color': '#14100C',
          'text-halo-width': 2.4,
        },
      });

      map.addLayer({
        id: 'mandals',
        type: 'symbol',
        source: SOURCE,
        filter: ['!', ['has', 'point_count']],
        layout: {
          // Colour is the queue. 'none' when nobody has reported, which is
          // a neutral pin rather than a calm-looking one.
          'icon-image': [
            'concat',
            'pin-',
            ['case', ['has', 'crowd'], ['get', 'crowd'], 'none'],
            ['case', ['>', ['get', 'manacheRank'], 0], '-m', ''],
          ],
          // Was a flat 0.5, which drew the 34px artwork at 17px — small
          // enough that the Ganpati collapsed into an anonymous dot, so the
          // map marked mandals with something you could not tell was one.
          // Grows with zoom: wide out, pins are position markers and want to
          // stay out of each other's way; zoomed in you are choosing between
          // mandals and the mark has to be readable.
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.68, 14, 0.88, 16, 1.05],
          'icon-allow-overlap': true,
          'symbol-sort-key': stackOrder(null),
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
    source?.setData(toFeatureCollection(ganpatis, crowd));
  }, [ganpatis, crowd, ready]);

  /* ---------------- Selection ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getLayer('mandals')) return;

    // Only the selected pin uses the larger artwork.
    // Must stay in step with the layer's own icon-image above: this
    // overwrites it, so a key added there and forgotten here silently asks
    // the map for an image that was never registered — every pin vanishes
    // and the console fills with "could not be loaded".
    //
    // The sentinel is '' rather than a literal NUL byte, which is what used
    // to sit here. Both work — a slug is [a-z0-9-]+ and can be neither —
    // but one of them is readable and survives a copy/paste.
    map.setLayoutProperty('mandals', 'icon-image', [
      'concat',
      'pin-',
      ['case', ['has', 'crowd'], ['get', 'crowd'], 'none'],
      ['case', ['>', ['get', 'manacheRank'], 0], '-m', ''],
      ['case', ['==', ['get', 'slug'], selectedSlug ?? ''], '-sel', ''],
    ]);
    // And lift it above whatever it is sharing a doorstep with. Changing
    // only the artwork left a buried pin buried in bigger artwork.
    map.setLayoutProperty('mandals', 'symbol-sort-key', stackOrder(selectedSlug ?? null));

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
