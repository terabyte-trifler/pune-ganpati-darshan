'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  type GeoJSONSource,
  type MapMouseEvent,
  type ErrorEvent,
  type FilterSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DARK_MAP_STYLE } from '@/lib/maps/map-style';
import { buildMarkerSvg, buildClusterPinSvg } from '@/lib/maps/markers';
import { isWebglAvailable } from '@/lib/maps/webgl';
import { PUNE_CENTER, boundsOf, type LatLng } from '@/lib/geo';
import { DARSHAN_STATIONS, LINE_COLOR, primaryLine } from '@/lib/metro';
import type { Ganpati, GanpatiCategory } from '@/types/ganpati';
import type { CrowdLevel } from '@/types/crowd';

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
const METRO_SOURCE = 'metro-stations';

/**
 * Metro stations, drawn under the mandals.
 *
 * They are context, not destinations: the question the map answers is
 * "which Ganpati next", and a station that competed with the pins for
 * attention would get in the way of it. So they sit below the mandal
 * layers, use the line's own colour rather than the app's vermilion, and
 * never take a tap.
 *
 * The two Aqua Line stations across the river appear two zoom levels later
 * than the three in the peths. That is the "rare" in the brief expressed as
 * geometry rather than as a caption — at the zoom where you are choosing a
 * mandal they are simply not part of the decision, and they fade in only
 * once you have pulled back far enough to be thinking about getting there.
 */
const METRO_MIN_ZOOM = { primary: 11.5, secondary: 13.5 } as const;

function metroFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: DARSHAN_STATIONS.map((s) => ({
      type: 'Feature',
      properties: {
        name: s.name,
        tier: s.tier,
        color: LINE_COLOR[primaryLine(s)],
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  };
}
const CATEGORIES: GanpatiCategory[] = ['maanache', 'famous', 'historic', 'local'];

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
  crowd?: Record<string, CrowdLevel>;
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
  crowd: Record<string, CrowdLevel> = {}
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
        // Negated in symbol-sort-key so rank 1 draws above rank 5.
        manacheRank: g.manacheRank ?? 0,
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

async function registerPin(map: MapLibreMap, category: GanpatiCategory, selected: boolean) {
  const id = `pin-${category}${selected ? '-sel' : ''}`;
  if (map.hasImage(id)) return;

  const { url, size } = buildMarkerSvg(category, selected);
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

/**
 * Small status dot drawn beside a pin.
 *
 * A separate layer rather than baking crowd into the pin artwork: the pin
 * already varies by category and selection, and folding in four crowd
 * states would mean 32 registered images to keep in step. One dot per
 * level is three.
 */
const CROWD_DOT: Record<CrowdLevel, string> = {
  short: '#5fb872',
  moving: '#f2a93b',
  long: '#e5544b',
};

async function registerCrowdDot(map: MapLibreMap, level: CrowdLevel) {
  const id = `crowd-${level}`;
  if (map.hasImage(id)) return;

  const color = CROWD_DOT[level];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
    <circle cx="9" cy="9" r="7" fill="${color}" stroke="#14100c" stroke-width="2.5"/>
  </svg>`;

  const image = new Image(18 * PIN_RASTER, 18 * PIN_RASTER);
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });
  if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: PIN_RASTER });
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
    map.on('load', async () => {
      collapseAttribution(map.getContainer());
      await Promise.all(
        CATEGORIES.flatMap((c) => [registerPin(map, c, false), registerPin(map, c, true)])
          .concat(registerClusterPin(map))
          .concat(
            (['short', 'moving', 'long'] as CrowdLevel[]).map((l) =>
              registerCrowdDot(map, l)
            )
          )
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

      map.addSource(METRO_SOURCE, { type: 'geojson', data: metroFeatureCollection() });

      for (const tier of ['primary', 'secondary'] as const) {
        const minzoom = METRO_MIN_ZOOM[tier];
        const filter: FilterSpecification = ['==', ['get', 'tier'], tier];

        // A soft ring reading as "the station is somewhere in here" — which
        // is honest, because these coordinates are station boxes and the
        // exits are up to a couple of hundred metres apart.
        map.addLayer({
          id: `metro-halo-${tier}`,
          type: 'circle',
          source: METRO_SOURCE,
          minzoom,
          filter,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-opacity': tier === 'primary' ? 0.14 : 0.09,
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 22],
          },
        });

        map.addLayer({
          id: `metro-dot-${tier}`,
          type: 'circle',
          source: METRO_SOURCE,
          minzoom,
          filter,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6],
            'circle-stroke-color': '#14100C',
            'circle-stroke-width': 1.5,
            'circle-opacity': tier === 'primary' ? 1 : 0.75,
          },
        });

        map.addLayer({
          id: `metro-label-${tier}`,
          type: 'symbol',
          source: METRO_SOURCE,
          // Labels one level later than the dot: the dot is orientation and
          // costs nothing, the name is only worth the clutter once you are
          // close enough to walk from it.
          minzoom: minzoom + 1,
          filter,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 10,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            // The three peth stations keep their names whatever else wants
            // the space. Left to collision they lost to OpenStreetMap's own
            // place labels — "PUNE", "SHANIWAR PETH" — and the map showed
            // three anonymous coloured dots, which answers nothing. The two
            // Aqua Line ones stay collision-managed: they are the rare
            // choice, and not worth crowding the peths for.
            'text-allow-overlap': tier === 'primary',
            'text-padding': 3,
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#14100C',
            'text-halo-width': 1.6,
            'text-opacity': tier === 'primary' ? 0.95 : 0.7,
          },
        });
      }

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
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          // Was a flat 0.5, which drew the 34px artwork at 17px — small
          // enough that the Ganpati collapsed into an anonymous dot, so the
          // map marked mandals with something you could not tell was one.
          // Grows with zoom: wide out, pins are position markers and want to
          // stay out of each other's way; zoomed in you are choosing between
          // mandals and the mark has to be readable.
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.68, 14, 0.88, 16, 1.05],
          'icon-allow-overlap': true,
          'symbol-sort-key': ['-', 0, ['get', 'manacheRank']],
        },
      });

      map.addLayer({
        id: 'crowd-dots',
        type: 'symbol',
        source: SOURCE,
        // Only mandals that actually have a reading. No property, no dot.
        filter: ['all', ['!', ['has', 'point_count']], ['has', 'crowd']],
        layout: {
          'icon-image': ['concat', 'crowd-', ['get', 'crowd']],
          'icon-size': 0.75,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          // Sits on the pin's upper-right shoulder. Offset is in units of
          // the icon's own size, so it tracks the pin as it scales.
          'icon-offset': [9, -11],
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
