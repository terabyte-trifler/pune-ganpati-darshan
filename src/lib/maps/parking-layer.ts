import type { Map as MapLibreMap } from 'maplibre-gl';
import { PARKING } from '@/content/parking';

/**
 * Festival parking on the map.
 *
 * The police publish 23 places to leave a vehicle, and until now the app
 * answered "which mandal" and said nothing about the question everyone
 * arriving by car or two-wheeler asks first. The data is theirs — see
 * content/parking.ts for the source and what it does and does not claim.
 *
 * Drawn below the mandal pins and in a colour used nowhere else. Parking
 * is context, like the metro: it must be findable when looked for and
 * must never compete with the pins that answer the question the map is
 * for. It also stays out of the crowd palette entirely — green, amber and
 * red mean queue length on every other surface, and a parking marker
 * borrowing one of them would read as "this lot is full".
 *
 * A stretch of road says so in its label. Sending someone to the
 * midpoint of a 400 m stretch as though it were a gate is how a map
 * loses trust.
 */

export const PARKING_SOURCE_ID = 'festival-parking';

/** Steel blue: cool, legible on the dark ground, and not a crowd colour. */
const PARKING_COLOR = '#6C8AB0';

/** Below this the peths are a smudge and a P adds nothing. */
const MIN_ZOOM = 12.5;

export function parkingFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: PARKING.map((p) => ({
      type: 'Feature',
      properties: {
        name: p.name,
        // The label carries the caveat, because the marker cannot.
        label: p.kind === 'stretch' ? `${p.name} (along the road)` : p.name,
        kind: p.kind,
      },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

/**
 * Adds the parking source and layers to a loaded map.
 *
 * Call inside the map's own 'load' handler and before the mandal layers,
 * so the pins draw on top. Guards on the source, because calling twice
 * throws from MapLibre.
 */
export function addParkingLayers(map: MapLibreMap): void {
  if (map.getSource(PARKING_SOURCE_ID)) return;

  map.addSource(PARKING_SOURCE_ID, {
    type: 'geojson',
    data: parkingFeatureCollection(),
  });

  map.addLayer({
    id: 'parking-dot',
    type: 'circle',
    source: PARKING_SOURCE_ID,
    minzoom: MIN_ZOOM,
    paint: {
      'circle-color': PARKING_COLOR,
      'circle-opacity': 0.9,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 5, 16, 11],
      'circle-stroke-color': '#14100C',
      'circle-stroke-width': 1,
    },
  });

  // The P sits inside the disc, so the marker reads as parking without a
  // legend. Only from the zoom where the disc is big enough to hold it.
  map.addLayer({
    id: 'parking-glyph',
    type: 'symbol',
    source: PARKING_SOURCE_ID,
    minzoom: 13.5,
    layout: {
      'text-field': 'P',
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 13.5, 8, 16, 12],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#0E1724' },
  });

  map.addLayer({
    id: 'parking-label',
    type: 'symbol',
    source: PARKING_SOURCE_ID,
    // Two levels after the disc. The disc is orientation; the name is
    // only worth the clutter once someone is deciding where to turn.
    minzoom: 14.5,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      // Collision-managed on purpose: unlike the peth metro stations,
      // these must never win space from a mandal's own label.
      'text-allow-overlap': false,
      'text-padding': 3,
    },
    paint: {
      'text-color': PARKING_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.2,
    },
  });
}
