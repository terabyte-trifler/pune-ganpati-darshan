'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  AttributionControl,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DARK_MAP_STYLE } from '@/lib/maps/map-style';
import { buildMarkerSvg, buildRouteStopSvg } from '@/lib/maps/markers';
import { isWebglAvailable } from '@/lib/maps/webgl';
import { boundsOf } from '@/lib/geo';
import type { Ganpati, GanpatiCategory } from '@/types/ganpati';

/**
 * Embedded map for content pages — a mandal's location, a route's shape, the
 * spread of an area.
 *
 * Separate from MapCanvas on purpose. That one is a full-screen application
 * surface with clustering, filters and a sheet; this is a bounded figure
 * inside a page. Sharing one component would mean a pile of flags, and the
 * two have genuinely different jobs.
 *
 * Numbered pins are used when a route order matters, so the map reads the
 * same way as the stop list beside it.
 */

const CATEGORIES: GanpatiCategory[] = ['maanache', 'famous', 'historic', 'local'];

export interface MiniMapProps {
  mandals: Ganpati[];
  /** Draws an ordered route through the mandals and numbers the pins. */
  ordered?: boolean;
  /** Road geometry as [lng, lat] pairs. Falls back to straight connectors. */
  routeGeometry?: [number, number][] | null;
  selectedSlug?: string | null;
  onSelect?: (slug: string) => void;
  className?: string;
  /** Single-location maps want a fixed zoom rather than a bounds fit. */
  zoom?: number;
  interactive?: boolean;
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

async function registerPin(map: MapLibreMap, category: GanpatiCategory) {
  const id = `mini-${category}`;
  if (map.hasImage(id)) return;
  const { url, size } = buildMarkerSvg(category, false);
  // 3x raster: see MapCanvas. These maps are small, so a soft pin is the
  // most conspicuous thing on them.
  const image = new Image(size * 3, size * 3);
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
  if (!map.hasImage(id)) map.addImage(id, image, { pixelRatio: 3 });
}

export function MiniMap({
  mandals, ordered = false, routeGeometry, selectedSlug, onSelect,
  className, zoom, interactive = true,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const numberedRef = useRef<Marker[]>([]);
  // Support is an environment fact, not state that evolves: resolving it once
  // during render avoids a synchronous setState inside the effect (which
  // triggers a cascading re-render).
  const [webglSupported] = useState(() => isWebglAvailable());
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || mandals.length === 0) return;

    if (!webglSupported) return;

    const points = mandals.map((m) => ({ lat: m.location.lat, lng: m.location.lng }));
    const b = boundsOf(points, mandals.length === 1 ? 0.004 : 0.0025);

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: DARK_MAP_STYLE,
        center: [points[0].lng, points[0].lat],
        zoom: zoom ?? 15,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        interactive,
      });
    } catch (error) {
      console.error('[minimap] failed to initialise', error);
      // Deferred so the state change is not synchronous inside the effect,
      // which would cascade a render. This path runs once, on a real driver
      // failure, so a microtask of latency is irrelevant.
      queueMicrotask(() => setFailed(true));
      return;
    }
    mapRef.current = map;

    map.addControl(
      // No customAttribution: the TileJSON already supplies the required
      // OpenStreetMap/OpenMapTiles credit, and adding ours duplicated it.
      new AttributionControl({ compact: true }),
      'bottom-right'
    );
    if (interactive) {
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    }
    map.on('load', async () => {
      collapseAttribution(map.getContainer());
      await Promise.all(CATEGORIES.map((c) => registerPin(map, c)));

      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#E2621B',
          'line-width': 4,
          'line-opacity': 0.85,
          // Dashed while we are only connecting stops in a straight line, so
          // it never reads as a real walking path.
          'line-dasharray': routeGeometry ? [1] : [2, 1.6],
        },
      });

      // Unordered maps use category pins; ordered routes use numbered ones so
      // the map matches the stop list.
      if (!ordered) {
        map.addSource('mandals', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: mandals.map((m) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [m.location.lng, m.location.lat] },
              properties: { slug: m.slug, category: m.category },
            })),
          },
        });
        map.addLayer({
          id: 'mandal-pins',
          type: 'symbol',
          source: 'mandals',
          layout: {
            'icon-image': ['concat', 'mini-', ['get', 'category']],
            // Near full size: these maps are framed on one mandal or a small
            // cluster of them, so there is room for the mark to read.
            'icon-size': 0.95,
            'icon-allow-overlap': true,
          },
        });
        map.on('click', 'mandal-pins', (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
          const slug = e.features?.[0]?.properties?.slug;
          if (typeof slug === 'string') onSelectRef.current?.(slug);
        });
        map.on('mouseenter', 'mandal-pins', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'mandal-pins', () => { map.getCanvas().style.cursor = ''; });
      }

      if (mandals.length > 1) {
        map.fitBounds([[b.west, b.south], [b.east, b.north]], {
          padding: 44, duration: 0, maxZoom: 16,
        });
      }

      map.resize();
      // Resizing can re-open it, so collapse once more afterwards.
      collapseAttribution(map.getContainer());
      setReady(true);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      numberedRef.current.forEach((m) => m.remove());
      numberedRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Built once from the initial props; updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglSupported]);

  /* ---------------- Numbered stop pins ----------------
     Each stop is the Ganpati mark with its order in a badge, so a route map
     is recognisably a map of Ganpatis rather than a map of numbers.

     Note on target size: adjacent stops in the peths are often ~200m apart,
     so at the zoom that shows a whole route their pins overlap and the
     effective target can still fall below 40px. They are not spread apart,
     because moving a pin away from its real position on a map people
     navigate by is a worse defect than a small target.

     This is the WCAG 2.5.8 exception: the same function — selecting a stop —
     is available from the numbered list directly below the map, where each
     row is a full-width target. The map pins are a convenience on top of
     that list, never the only way to reach a stop. */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !ordered) return;

    numberedRef.current.forEach((m) => m.remove());
    numberedRef.current = mandals.map((mandal, i) => {
      const active = mandal.slug === selectedSlug;
      const { url, size } = buildRouteStopSvg(active);
      const badge = Math.round(size * 0.44);

      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', `Stop ${i + 1}: ${mandal.name}`);
      el.style.cssText = [
        `width:${size}px;height:${size}px`,
        'position:relative;padding:0;border:0;background:transparent;cursor:pointer',
        `background-image:url("${url}")`,
        'background-size:contain;background-repeat:no-repeat;background-position:center',
      ].join(';');

      // The order rides in a badge rather than replacing the mark. Kept in the
      // DOM so it stays crisp on a high-density screen and picks up the
      // page's own font, which a rasterised data URI would not.
      const order = document.createElement('span');
      order.textContent = String(i + 1);
      order.setAttribute('aria-hidden', 'true');
      order.style.cssText = [
        `position:absolute;top:0;right:0;width:${badge}px;height:${badge}px`,
        'display:grid;place-items:center;border-radius:9999px',
        `font:700 ${Math.round(badge * 0.62)}px/1 ui-sans-serif,system-ui,sans-serif`,
        'background:#14100c;color:#f6efe3',
        `border:1.5px solid ${active ? '#f2a93b' : '#e2621b'}`,
      ].join(';');
      el.appendChild(order);

      el.addEventListener('click', () => onSelectRef.current?.(mandal.slug));

      return new Marker({ element: el })
        .setLngLat([mandal.location.lng, mandal.location.lat])
        .addTo(map);
    });
  }, [mandals, ordered, selectedSlug, ready]);

  /* ---------------- Route line ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    const source = map.getSource('route') as GeoJSONSource | undefined;
    // With no road geometry, connect the stops directly — drawn dashed above
    // so it is visibly a connector, not a route we are claiming to know.
    const coordinates =
      routeGeometry ??
      (ordered && mandals.length > 1
        ? mandals.map((m) => [m.location.lng, m.location.lat] as [number, number])
        : []);

    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    });

    if (map.getLayer('route-line')) {
      map.setPaintProperty('route-line', 'line-dasharray', routeGeometry ? [1] : [2, 1.6]);
    }
  }, [routeGeometry, mandals, ordered, ready]);

  /* ---------------- Follow the selected stop ---------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedSlug) return;
    const target = mandals.find((m) => m.slug === selectedSlug);
    if (target) {
      map.easeTo({
        center: [target.location.lng, target.location.lat],
        duration: 450,
      });
    }
  }, [selectedSlug, mandals, ready]);

  if (!webglSupported || failed) {
    return (
      <div
        className={`grid place-items-center rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] px-4 text-center ${className ?? ''}`}
      >
        <p className="text-[13px] leading-relaxed text-[var(--muted)]">
          Your browser can&rsquo;t draw the map.
          <br />
          <span className="text-[var(--faint)]">
            Everything else on this page still works.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-minimap-ready={ready ? 'true' : 'false'}
      aria-label={
        ordered
          ? `Route map with ${mandals.length} stops`
          : `Map showing ${mandals.length === 1 ? mandals[0]?.name : `${mandals.length} mandals`}`
      }
      role="img"
      className={`overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--raat)] ${className ?? ''}`}
    />
  );
}
