import type { Map as MapLibreMap } from 'maplibre-gl';
import { VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';
import { VISARJAN_CLOSURES } from '@/content/visarjan';

/**
 * Visarjan day: the procession corridor, and the closures that can be
 * drawn honestly.
 *
 * ---------------------------------------------------------------------
 * Two things on one map, in two languages.
 *
 * The corridor is where the miravnuk goes — a wide, soft marigold band,
 * because it is a river of people rather than a line to follow. It is
 * deliberately NOT the vermilion of a darshan route: the app's route line
 * means "walk this", and on visarjan day the corridor means very nearly
 * the opposite.
 *
 * The closures keep the dashed, cool-grey language the festival closures
 * already use on this map, so the two kinds of restriction read as one
 * idea, and each carries its own hour rather than a shared legend.
 *
 * What is missing is missing on purpose. Only three of the seventeen
 * stretches have both end points on the police's junction map, so only
 * three are drawn; the rest are on /visarjan as text. `DRAWN_CLOSURES`
 * and `TOTAL_CLOSURES` exist so the legend can say "3 of 17 drawn"
 * instead of letting the map imply the other fourteen roads are open.
 */

export const VISARJAN_SOURCE_ID = 'visarjan-corridor';
export const VISARJAN_CLOSURE_SOURCE_ID = 'visarjan-closures';

/** Marigold, at low opacity. The procession, not a route. */
const CORRIDOR_COLOR = '#F2A93B';
/** The same bone-grey the after-17:00 closures use. */
const CLOSURE_COLOR = '#C8BCA8';

const MIN_ZOOM = 12.5;

const corridor = VISARJAN_GEOMETRY.filter((g) => g.kind === 'procession');
const closures = VISARJAN_GEOMETRY.filter((g) => g.kind === 'closure');

export const DRAWN_CLOSURES = closures.length;
export const TOTAL_CLOSURES = VISARJAN_CLOSURES.length;

/** The closing time for a road, from the notice rather than the geometry. */
function closingTime(road: string): string {
  return VISARJAN_CLOSURES.find((c) => c.road === road)?.from ?? '';
}

export function corridorFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: corridor.map((g) => ({
      type: 'Feature',
      properties: { name: g.road, label: `${g.road} · miravnuk` },
      geometry: { type: 'MultiLineString', coordinates: g.segments },
    })),
  };
}

export function visarjanClosureFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: closures.map((g) => ({
      type: 'Feature',
      properties: {
        name: g.road,
        label: `Closed from ${closingTime(g.road)}`,
        from: g.from ?? '',
        to: g.to ?? '',
      },
      geometry: { type: 'MultiLineString', coordinates: g.segments },
    })),
  };
}

/**
 * Adds the visarjan layers to a loaded map.
 *
 * Call inside the map's own 'load' handler, before the mandal pins so
 * they stay on top. Guards on the source, because adding twice throws.
 */
export function addVisarjanLayers(map: MapLibreMap): void {
  if (map.getSource(VISARJAN_SOURCE_ID)) return;

  map.addSource(VISARJAN_SOURCE_ID, {
    type: 'geojson',
    data: corridorFeatureCollection(),
  });
  map.addSource(VISARJAN_CLOSURE_SOURCE_ID, {
    type: 'geojson',
    data: visarjanClosureFeatureCollection(),
  });

  // The band, under everything: a glow the peth lanes sit inside.
  map.addLayer({
    id: 'visarjan-corridor-glow',
    type: 'line',
    source: VISARJAN_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': CORRIDOR_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 6, 17, 26],
      'line-opacity': 0.18,
      'line-blur': ['interpolate', ['linear'], ['zoom'], 12.5, 3, 17, 12],
    },
  });

  map.addLayer({
    id: 'visarjan-corridor-line',
    type: 'line',
    source: VISARJAN_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': CORRIDOR_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 2, 17, 7],
      'line-opacity': 0.75,
    },
  });

  map.addLayer({
    id: 'visarjan-corridor-label',
    type: 'symbol',
    source: VISARJAN_SOURCE_ID,
    minzoom: 14,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10.5,
      'text-letter-spacing': 0.04,
      'symbol-spacing': 260,
    },
    paint: {
      'text-color': CORRIDOR_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.6,
    },
  });

  map.addLayer({
    id: 'visarjan-closure-line',
    type: 'line',
    source: VISARJAN_CLOSURE_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': CLOSURE_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 2, 17, 5],
      'line-opacity': 0.6,
      'line-dasharray': [2, 1.6],
    },
  });

  // The hour travels with the line. A closure without its time is an
  // instruction the reader cannot check against the clock.
  map.addLayer({
    id: 'visarjan-closure-label',
    type: 'symbol',
    source: VISARJAN_CLOSURE_SOURCE_ID,
    minzoom: 14,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-letter-spacing': 0.05,
      'symbol-spacing': 220,
    },
    paint: {
      'text-color': CLOSURE_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.4,
    },
  });
}
