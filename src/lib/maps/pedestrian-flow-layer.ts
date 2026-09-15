import type { Map as MapLibreMap } from 'maplibre-gl';
import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';
import { haversine } from '@/lib/geo';

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
export const FLOW_LABEL_SOURCE_ID = 'pedestrian-one-way-labels';

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
      properties: {
        name: w.name,
        note: w.note,
        arrows: '›  ›  ›',
        // Named, not generic. "One way on foot" tells a walker the rule;
        // it does not tell them where this lane goes, which is the part
        // they can act on while standing in a crowd. Kept short so it
        // survives collision against the pins in the peth cluster —
        // a label that is culled says nothing at all.
        label: `One way to ${w.towards}`,
      },
      geometry: { type: 'LineString', coordinates: w.path },
    })),
  };
}

/**
 * The point halfway along a stretch, by distance walked.
 *
 * Not the middle of the coordinate list — one of these lanes turns, and
 * its two segments are 31 m and 80 m, so the list's midpoint sits in the
 * corner rather than halfway down the walk.
 */
function midpoint(path: [number, number][]): [number, number] {
  const at = (i: number) => ({ lat: path[i][1], lng: path[i][0] });
  const legs = path.slice(1).map((_, i) => haversine(at(i), at(i + 1)));
  let remaining = legs.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < legs.length; i++) {
    if (remaining > legs[i]) { remaining -= legs[i]; continue; }
    const t = legs[i] === 0 ? 0 : remaining / legs[i];
    return [
      path[i][0] + (path[i + 1][0] - path[i][0]) * t,
      path[i][1] + (path[i + 1][1] - path[i][1]) * t,
    ];
  }
  return path[path.length - 1];
}

/**
 * Label anchors, as points rather than along the line.
 *
 * Line placement cannot label these. At zoom 16 a metre is about 2.3
 * pixels here, so a 93 m lane is 41 pixels long — shorter than the word
 * "Tulshibaug", let alone a sentence. MapLibre will not place a label it
 * cannot fit along the geometry, so four of the five stretches silently
 * had no label at any zoom, and the shortest lanes are exactly the ones
 * in the tightest part of the walk.
 *
 * Anchored at the midpoint, the label is free of the line's length.
 */
export function flowLabelFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: PEDESTRIAN_ONE_WAYS.map((w) => ({
      type: 'Feature',
      properties: { label: `One way to ${w.towards}` },
      geometry: { type: 'Point', coordinates: midpoint(w.path) },
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
  map.addSource(FLOW_LABEL_SOURCE_ID, {
    type: 'geojson',
    data: flowLabelFeatureCollection(),
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
      // And they must not reserve space either. `allow-overlap` alone only
      // lets a symbol ignore what is already placed — it still blocks what
      // comes after, and the arrows run the whole length of the line at 70
      // px apart. That silently culled the destination label on every
      // stretch, because line-center puts it straight on top of an arrow.
      'text-ignore-placement': true,
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
    source: FLOW_LABEL_SOURCE_ID,
    minzoom: 15,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10.5,
      'text-letter-spacing': 0.02,
      'text-max-width': 9,
      'text-padding': 2,
      // Let it move rather than disappear. Five of these sit within a few
      // hundred metres of each other in the peths, and a label dropped for
      // want of one position is a stretch left unnamed.
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 0.9,
      'text-justify': 'auto',
    },
    paint: {
      'text-color': FLOW_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.8,
    },
  });
}
