import type { Map as MapLibreMap } from 'maplibre-gl';
import { VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';
import { VISARJAN_CLOSURES, DIVERSION_POINTS } from '@/content/visarjan';
import { CHECKPOINT_POINTS, TOTAL_CHECKPOINTS } from '@/content/visarjan-checkpoints';

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
export const VISARJAN_DIVERSION_SOURCE_ID = 'visarjan-diversions';
export const VISARJAN_CHECKPOINT_SOURCE_ID = 'visarjan-checkpoints';

/** Marigold, at low opacity. The procession, not a route. */
const CORRIDOR_COLOR = '#F2A93B';
/** The same bone-grey the after-17:00 closures use. */
const CLOSURE_COLOR = '#C8BCA8';
/** Vermilion-leaning, because a diversion is an instruction to act on. */
const DIVERSION_COLOR = '#E2621B';

/**
 * White, because everything else on this map is already spoken for.
 *
 * The corridor is marigold, the mandals brass, the diversions vermilion,
 * the closures bone-grey, and the metro owns purple and teal. Against a
 * near-black ground white is both the highest contrast available and the
 * only tone left that carries no other meaning — green would have been
 * brighter still, and wrong, because green is "short queue" in this
 * app's pin language on a map that has deliberately stopped claiming
 * queues at all.
 *
 * These are also the marks most worth seeing: a checkpoint answers "when
 * does it reach this corner", which is the question asked while standing
 * on the corner.
 */
const CHECKPOINT_COLOR = '#FFFFFF';

const MIN_ZOOM = 12.5;

const corridor = VISARJAN_GEOMETRY.filter((g) => g.kind === 'procession');
const closures = VISARJAN_GEOMETRY.filter((g) => g.kind === 'closure');

export const DRAWN_CLOSURES = closures.length;
export const TOTAL_CLOSURES = VISARJAN_CLOSURES.length;

/** Diversion points we can place. The rest are named on the page instead. */
const placedDiversions = DIVERSION_POINTS.filter(
  (d): d is typeof d & { lat: number; lng: number } =>
    d.lat !== undefined && d.lng !== undefined
);
export const DRAWN_DIVERSIONS = placedDiversions.length;
export const TOTAL_DIVERSIONS = DIVERSION_POINTS.length;

export const DRAWN_CHECKPOINTS = CHECKPOINT_POINTS.length;
export const ALL_CHECKPOINTS = TOTAL_CHECKPOINTS;

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

/**
 * Kasba's checkpoints, carrying the hour rather than the name.
 *
 * On the day the question at a corner is "when does it get here", so the
 * time is the label and the chowk's name is the supporting line. The
 * times come from MANDAL_ROUTE_SCHEDULES through the generator, so the
 * marker and the list below the map cannot disagree.
 */
export function checkpointFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: CHECKPOINT_POINTS.map((c) => ({
      type: 'Feature',
      properties: { time: c.time, place: c.place, placeMr: c.placeMr },
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
    })),
  };
}

export function diversionFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: placedDiversions.map((d) => ({
      type: 'Feature',
      properties: { name: d.name, road: d.road },
      geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
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
/**
 * Lifts the checkpoints and diversions above the mandal pins.
 *
 * Layer order is insertion order, and the mandal pins are added after
 * these. With thirty of them on the peths, a checkpoint drawn underneath
 * disappears behind whichever mandal happens to share its corner — which
 * is most of them, since the procession passes the mandals. Called once
 * the pins exist.
 */
export function liftVisarjanMarkers(map: MapLibreMap): void {
  for (const id of [
    'visarjan-diversion', 'visarjan-diversion-label',
    'visarjan-checkpoint', 'visarjan-checkpoint-label',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}

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
  map.addSource(VISARJAN_DIVERSION_SOURCE_ID, {
    type: 'geojson',
    data: diversionFeatureCollection(),
  });
  map.addSource(VISARJAN_CHECKPOINT_SOURCE_ID, {
    type: 'geojson',
    data: checkpointFeatureCollection(),
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

  // Checkpoints sit on the corridor and carry the hour. Drawn above the
  // band and below the pins: they belong to the route, not to the city.
  map.addLayer({
    id: 'visarjan-checkpoint',
    type: 'circle',
    source: VISARJAN_CHECKPOINT_SOURCE_ID,
    minzoom: 12.5,
    paint: {
      'circle-color': CHECKPOINT_COLOR,
      // A shade larger than a mandal pin: on this map the checkpoint is
      // the instruction and the mandal is the context.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 4.5, 17, 8.5],
      'circle-stroke-color': '#14100C',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'visarjan-checkpoint-label',
    type: 'symbol',
    source: VISARJAN_CHECKPOINT_SOURCE_ID,
    minzoom: 13.5,
    layout: {
      // The hour first: at a corner on the day, that is the question.
      'text-field': ['concat', ['get', 'time'], '  ', ['get', 'place']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-padding': 3,
      'text-max-width': 9,
    },
    paint: {
      'text-color': CHECKPOINT_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 2,
    },
  });

  // Diversion points: where you get turned around, which is a different
  // fact from a road being shut and the more useful one to a rider. Drawn
  // as a ring with a bar through it rather than a dot, so it cannot be
  // mistaken for a mandal pin.
  map.addLayer({
    id: 'visarjan-diversion',
    type: 'circle',
    source: VISARJAN_DIVERSION_SOURCE_ID,
    minzoom: 12.5,
    paint: {
      'circle-color': '#14100C',
      'circle-opacity': 0.85,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 4, 17, 8],
      'circle-stroke-color': DIVERSION_COLOR,
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'visarjan-diversion-label',
    type: 'symbol',
    source: VISARJAN_DIVERSION_SOURCE_ID,
    minzoom: 14,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-padding': 3,
    },
    paint: {
      'text-color': DIVERSION_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.3,
      'text-opacity': 0.9,
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
