import type { Map as MapLibreMap, FilterSpecification } from 'maplibre-gl';
import { DARSHAN_STATIONS, LINE_COLOR, primaryLine } from '@/lib/metro';

/**
 * Metro stations, on every map in the app.
 *
 * One definition shared by the full-screen map and the embedded ones. It
 * lived in MapCanvas alone, so the route maps, the planner, the wizard and
 * every mandal page drew the peths with no way in marked on them — which is
 * the half of the question people arriving by train are actually asking.
 * Two copies of this would have drifted the first time a colour changed.
 *
 * They are context, not destinations: the question a map here answers is
 * "which Ganpati next", and a station competing with the pins for attention
 * would get in the way of it. So they sit below the mandal layers, use the
 * line's own colour rather than the app's vermilion, and never take a tap.
 *
 * The two Aqua Line stations across the river appear two zoom levels later
 * than the ones in the peths — the "rare" expressed as geometry rather than
 * as a caption. At the zoom where you are choosing between mandals they are
 * not part of the decision; they fade in once you have pulled back far
 * enough to be thinking about getting there.
 */

export const METRO_SOURCE = 'metro-stations';

const METRO_MIN_ZOOM = { primary: 11.5, secondary: 13.5 } as const;

/** The map's own ground, used to draw an exit-only station hollow. */
const GROUND = '#14100C';

export function metroFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: DARSHAN_STATIONS.map((s) => ({
      type: 'Feature',
      properties: {
        name: s.name,
        tier: s.tier,
        color: LINE_COLOR[primaryLine(s)],
        // Drawn hollow. A station you cannot get off at is not the same
        // kind of thing as one you can, and colouring them identically
        // would send people towards the platform the app is steering them
        // away from — Mandai is the nearest station to most of the
        // southern peths and is boarding-only during the festival.
        canAlight: s.canAlight,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  };
}

/**
 * Adds the source and the six layers to a loaded map.
 *
 * Call inside the map's own 'load' handler, and before the mandal layers,
 * so the pins draw on top. Safe to call once per map; calling twice throws
 * from MapLibre, so it guards on the source already existing.
 */
export function addMetroLayers(map: MapLibreMap): void {
  if (map.getSource(METRO_SOURCE)) return;

  map.addSource(METRO_SOURCE, { type: 'geojson', data: metroFeatureCollection() });

  for (const tier of ['primary', 'secondary'] as const) {
    const minzoom = METRO_MIN_ZOOM[tier];
    const filter: FilterSpecification = ['==', ['get', 'tier'], tier];

    // A soft ring reading as "the station is somewhere in here" — which is
    // honest, because these are station boxes and the exits are up to a
    // couple of hundred metres apart.
    map.addLayer({
      id: `metro-halo-${tier}`,
      type: 'circle',
      source: METRO_SOURCE,
      minzoom,
      filter,
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': [
          'case',
          ['get', 'canAlight'],
          tier === 'primary' ? 0.14 : 0.09,
          // Barely there: the halo reads as "you can arrive around here",
          // which is the one thing this station is not.
          0.04,
        ],
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
        // Filled where you can get off, hollow where you cannot: the ring
        // is drawn by giving the circle the map's own ground colour and
        // moving the line colour into the stroke.
        'circle-color': ['case', ['get', 'canAlight'], ['get', 'color'], GROUND],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 6],
        'circle-stroke-color': ['get', 'color'],
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
        // Exit-only stations say so on the map. "Mandai" alone reads as
        // somewhere to head for.
        'text-field': [
          'case',
          ['get', 'canAlight'],
          ['get', 'name'],
          ['concat', ['get', 'name'], ' (exit only)'],
        ],
        'text-font': ['Noto Sans Bold'],
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        // The peth stations keep their names whatever else wants the space.
        // Left to collision they lost to OpenStreetMap's own place labels —
        // "PUNE", "SHANIWAR PETH" — and the map showed anonymous coloured
        // dots, which answers nothing. The Aqua Line ones stay
        // collision-managed: they are the rare choice, and not worth
        // crowding the peths for.
        'text-allow-overlap': tier === 'primary',
        'text-padding': 3,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': GROUND,
        'text-halo-width': 1.6,
        'text-opacity': tier === 'primary' ? 0.95 : 0.7,
      },
    });
  }
}
