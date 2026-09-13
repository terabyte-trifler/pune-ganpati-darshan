import type { Map as MapLibreMap } from 'maplibre-gl';
import { ROAD_CLOSURES, CLOSURE_JUNCTIONS, LINE_7_NOTE } from '@/content/diversions';

/**
 * Road closures and the junctions named with them.
 *
 * Drawn from the Pune City Traffic Police's own plan — see
 * content/diversions.ts for what that source states and what it leaves
 * unlabelled.
 *
 * ---------------------------------------------------------------------
 * Why it looks nothing like a route.
 *
 * The app already draws a vermilion line: your darshan route, the thing
 * to follow. A closure is the opposite instruction, so drawing it in any
 * warm colour — or solid — would put "go this way" and "you cannot go
 * this way" in the same visual language. These are dashed, cool and
 * translucent, and they carry their own text along the line saying
 * "closed after 17:00" rather than relying on a legend nobody reads.
 *
 * They also sit UNDER the route line and under every pin. If a route and
 * a closure overlap, the honest thing is for the route to stay visible so
 * the conflict is obvious, and for the closure's label to explain it.
 *
 * The junction pins are deliberately plain rings with names and no verb.
 * The source does not say what happens at each one, so neither does this.
 */

export const CLOSURE_SOURCE_ID = 'road-closures';
export const CLOSURE_JUNCTION_SOURCE_ID = 'closure-junctions';

/** Cool bone-grey: a restriction, and not a colour used for anything else. */
const CLOSURE_COLOR = '#C8BCA8';

/** Below this the peth lanes overlap and a dashed line is noise. */
const MIN_ZOOM = 13;

export function closureFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ROAD_CLOSURES.map((c) => ({
      type: 'Feature',
      properties: {
        name: c.name,
        note: c.note || (c.name === 'Line 7' ? LINE_7_NOTE : ''),
        // Every label states the time, because a closure without its hours
        // is an instruction the reader cannot check against the clock.
        label: 'Closed after 17:00',
      },
      geometry: { type: 'LineString', coordinates: c.path },
    })),
  };
}

export function junctionFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: CLOSURE_JUNCTIONS.map((j) => ({
      type: 'Feature',
      properties: { name: j.name, no: j.no },
      geometry: { type: 'Point', coordinates: [j.lng, j.lat] },
    })),
  };
}

/**
 * Adds closures and junctions to a loaded map.
 *
 * Call inside the map's own 'load' handler, before the route and the
 * mandal layers, so both draw on top. Guards on the source, because
 * calling twice throws from MapLibre.
 */
export function addClosureLayers(map: MapLibreMap): void {
  if (map.getSource(CLOSURE_SOURCE_ID)) return;

  map.addSource(CLOSURE_SOURCE_ID, {
    type: 'geojson',
    data: closureFeatureCollection(),
  });
  map.addSource(CLOSURE_JUNCTION_SOURCE_ID, {
    type: 'geojson',
    data: junctionFeatureCollection(),
  });

  map.addLayer({
    id: 'closure-line',
    type: 'line',
    source: CLOSURE_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': CLOSURE_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 5],
      'line-opacity': 0.55,
      // Dashes scale with width, so the line still reads as broken when
      // zoomed in rather than turning into a solid band.
      'line-dasharray': [2, 1.6],
    },
  });

  map.addLayer({
    id: 'closure-line-label',
    type: 'symbol',
    source: CLOSURE_SOURCE_ID,
    minzoom: 14.5,
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

  // Hollow rings: the source says a junction is named on the closure
  // plan, not what happens there, and a filled marker would imply the app
  // knows which.
  map.addLayer({
    id: 'closure-junction',
    type: 'circle',
    source: CLOSURE_JUNCTION_SOURCE_ID,
    minzoom: 13.5,
    paint: {
      'circle-color': '#14100C',
      'circle-opacity': 0.7,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 13.5, 3, 17, 6],
      'circle-stroke-color': CLOSURE_COLOR,
      'circle-stroke-width': 1.4,
      'circle-stroke-opacity': 0.8,
    },
  });

  map.addLayer({
    id: 'closure-junction-label',
    type: 'symbol',
    source: CLOSURE_JUNCTION_SOURCE_ID,
    minzoom: 15,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      // Always collision-managed: a junction name must never take space
      // from a mandal's.
      'text-allow-overlap': false,
      'text-padding': 3,
    },
    paint: {
      'text-color': CLOSURE_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.2,
      'text-opacity': 0.85,
    },
  });
}
