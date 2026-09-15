import type { Map as MapLibreMap } from 'maplibre-gl';
import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';

/**
 * The stretches where the crowd itself walks one way.
 *
 * ---------------------------------------------------------------------
 * Why this is not drawn like a closure.
 *
 * A closure is "you cannot go this way", and it is drawn bone-grey,
 * dashed and mute. This is the opposite kind of fact: the road is open,
 * full of people, and moving — in one direction. Drawing it in the
 * closure's language would tell a walker the lane past Dagdusheth is shut
 * on the busiest evening of the year, which is the reverse of the truth.
 *
 * So it gets its own reading: a continuous line, in a cool blue distinct
 * from both the vermilion route and the grey closure, with chevrons laid
 * along it pointing the way the crowd goes. The direction IS the content
 * here, and a line without arrows carries none of it.
 *
 * `text-keep-upright` is off deliberately. MapLibre's default flips text
 * on a line so it never reads upside-down — correct for a place name, and
 * catastrophic for an arrow, which would then point back up the lane at
 * exactly the people being told not to walk up it.
 *
 * Draws under the route and under every pin, like the closures: if a
 * planned route runs against the flow the route must stay visible, so the
 * conflict is the visitor's to see.
 */

export const FLOW_SOURCE_ID = 'pedestrian-one-ways';

/** Cool cobalt: neither the route's vermilion nor the closure's bone. */
const FLOW_COLOR = '#7FA8D8';

/**
 * Below this the peth lanes overlap and the chevrons collide.
 *
 * Sat at 13.5 to begin with, which is exactly the zoom the map opens at —
 * so these appeared right on their own threshold, as a two-pixel hairline
 * at 40% opacity over the densest part of the city, and read as missing.
 * Four of the six stretches are under 150 m, which is a dozen pixels at
 * this zoom: they have to be drawn boldly to be seen at all.
 */
const MIN_ZOOM = 13;

export function flowFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: PEDESTRIAN_ONE_WAYS.map((w) => ({
      type: 'Feature',
      properties: { name: w.name, note: w.note, arrows: '›  ›  ›' },
      geometry: { type: 'LineString', coordinates: w.path },
    })),
  };
}

/**
 * Adds the one-way stretches to a loaded map.
 *
 * Call inside the map's 'load' handler before the route and mandal
 * layers. Guards on the source, because adding twice throws.
 */
export function addPedestrianFlowLayers(map: MapLibreMap): void {
  if (map.getSource(FLOW_SOURCE_ID)) return;

  map.addSource(FLOW_SOURCE_ID, {
    type: 'geojson',
    data: flowFeatureCollection(),
  });

  map.addLayer({
    id: 'flow-line-casing',
    type: 'line',
    source: FLOW_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      // A dark casing under the line, so it separates from whatever it
      // runs over — the basemap draws its own lanes in a similar weight
      // and the cobalt was reading as part of the road beneath it.
      'line-color': '#14100C',
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 17, 13],
      'line-opacity': 0.75,
    },
  });

  map.addLayer({
    id: 'flow-line',
    type: 'line',
    source: FLOW_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': FLOW_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 7],
      'line-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'flow-arrows',
    type: 'symbol',
    source: FLOW_SOURCE_ID,
    minzoom: MIN_ZOOM,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'arrows'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13, 13, 17, 18],
      'text-rotation-alignment': 'map',
      // See the note above: an upright-corrected arrow is a wrong arrow.
      'text-keep-upright': false,
      'text-allow-overlap': true,
      'symbol-spacing': 70,
    },
    paint: {
      'text-color': FLOW_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 2,
      'text-opacity': 1,
    },
  });

  map.addLayer({
    id: 'flow-line-label',
    type: 'symbol',
    source: FLOW_SOURCE_ID,
    minzoom: 15,
    layout: {
      'symbol-placement': 'line',
      'text-field': 'One way on foot',
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-letter-spacing': 0.05,
      'text-offset': [0, 1.2],
      'symbol-spacing': 320,
    },
    paint: {
      'text-color': FLOW_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.4,
      'text-opacity': 0.85,
    },
  });
}
