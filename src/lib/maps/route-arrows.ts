import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Which way round the darshan route goes.
 *
 * The vermilion line says where you walk. It does not say which end you
 * start from, and on a loop through the peths the two readings are a
 * whole evening apart — the stop numbers answer it, but only if you can
 * find them among the pins, and only if you are looking at the list.
 *
 * So the line carries arrowheads, the same way the one-way lanes do. The
 * two are deliberately different sizes and colours: the cobalt chevrons
 * are the crowd's direction, which is fixed and applies to everybody; the
 * cream ones are YOUR direction through your own plan.
 *
 * `text-keep-upright` is off, and that is the whole thing working.
 * MapLibre's default flips glyphs on a line so they never read
 * upside-down — right for a place name, and wrong for an arrow, which
 * would then point back down the route at the person following it.
 */

/** Cream: reads on the vermilion line and on the dark ground alike. */
const ARROW_COLOR = '#FFE9CE';

export const ROUTE_ARROW_LAYER_ID = 'route-arrows';

/**
 * Adds direction arrows over an existing `route-line`.
 *
 * Call straight after adding the route line, so the arrows sit on it and
 * still fall under the mandal pins. Safe to call twice.
 */
export function addRouteArrows(map: MapLibreMap, sourceId = 'route'): void {
  if (map.getLayer(ROUTE_ARROW_LAYER_ID)) return;

  map.addLayer({
    id: ROUTE_ARROW_LAYER_ID,
    type: 'symbol',
    source: sourceId,
    layout: {
      'symbol-placement': 'line',
      // One chevron, repeated tightly, rather than a clump of three.
      //
      // Symbol-spacing anchors are measured along the whole line, not per
      // leg, so a wide interval can skip a leg entirely — at 110 px the
      // longest leg of the Manache Paach walk got no arrow at all while
      // the three short ones did, which is the opposite of useful. Tight
      // single chevrons fill every leg and read as a run of arrowheads.
      'text-field': '>',
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 14, 17, 20],
      'text-rotation-alignment': 'map',
      // See above: an upright-corrected arrow is a wrong arrow.
      'text-keep-upright': false,
      'text-allow-overlap': true,
      // And it must not reserve space either — `allow-overlap` alone lets a
      // symbol ignore what is already placed while still blocking what
      // comes after, which is how the one-way lanes lost their labels.
      'text-ignore-placement': true,
      // Measured in tile units, not screen pixels, so the effective gap
      // shifts with zoom — this is interpolated to keep the run readable
      // at city zoom without turning into a solid bar of arrowheads close
      // in. Values found by eye on the Manache Paach walk.
      'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 12, 10, 17, 34],
    },
    paint: {
      'text-color': ARROW_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 2,
      'text-opacity': 1,
    },
  });
}
