import type { Map as MapLibreMap } from 'maplibre-gl';
import { VISARJAN_CLOSURES, DIVERSION_POINTS } from '@/content/visarjan';
import { CHECKPOINT_POINTS, TOTAL_CHECKPOINTS } from '@/content/visarjan-checkpoints';
import { RING_POINTS, RING_KM } from '@/content/visarjan-ringroad';
import { POLICE_ROADS } from '@/content/visarjan-police';

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
export const VISARJAN_RING_SOURCE_ID = 'visarjan-ring';

/** Marigold, at low opacity. The procession, not a route. */
const CORRIDOR_COLOR = '#F2A93B';
/** The same bone-grey the after-17:00 closures use. */
const CLOSURE_COLOR = '#C8BCA8';
/** Vermilion-leaning, because a diversion is an instruction to act on. */
const DIVERSION_COLOR = '#E2621B';

/**
 * A dark body with a bright edge.
 *
 * The instinct to make the most important mark the brightest runs into
 * the ground this map is drawn on: it is almost black, so a filled disc
 * — white, saffron, marigold — is a bright blob, and six of them along
 * one road read as noise rather than as points. Colour alone also had
 * the checkpoints competing with the corridor, the mandals and the
 * diversions, all of which are warm.
 *
 * Inverting it solves both. The body takes the map's own ink and
 * disappears into the ground; the ring and the hour carry the contrast.
 * That is already this app's idiom for a reference point — the police
 * closure junctions are drawn the same way, and so are the diversion
 * pins here — so the map gains no new visual language.
 *
 * The ring is white and nothing else here has a white edge, which is
 * what separates a checkpoint from a diversion at a glance: both are
 * dark discs, one ringed white and one vermilion, and only one carries
 * a time.
 */
const CHECKPOINT_COLOR = '#14100C';
const CHECKPOINT_RING = '#FFFFFF';

/**
 * Green, and the only thing on this map that means "go".
 *
 * Everything else here is a restriction — a corridor to keep clear, a
 * road that shuts, a junction you are turned at — and they are drawn
 * warm or grey. A reader scanning for a way across the city needs the
 * one permissive mark to be unmistakable, and green against those is as
 * far as this palette goes.
 *
 * It is the app's own `short` green rather than a new one. The usual
 * objection — that green means "short queue" in the pin language — does
 * not apply on this map: every mandal here is drawn in brass and no
 * queue is claimed at all, so the colour is free.
 */
const RING_COLOR = '#5FB872';

const MIN_ZOOM = 12.5;

/**
 * Geometry now comes from the police, not from our reconstruction.
 *
 * Everything here was previously derived: OSM centrelines matched by
 * name, stretches trimmed by routing between junctions we could locate.
 * diversion.punepolice.gov.in publishes the plan itself, so it is used
 * instead — and the two agree closely enough to trust both readings.
 * Laxmi Road came out at 3.01 km against our 2.98, Tilak at 2.06 against
 * 2.08, their ring at 18.53 km against the 18.96 we routed through five
 * guessed points.
 *
 * The gain is coverage. Six roads we could not place at all — Bajirao,
 * Ganesh, Shastri, FC, Karve, Deccan — are in their data, so the map
 * goes from three drawn closures to ten.
 */
const PROCESSION_ROADS = ['Laxmi Road', 'Tilak Road', 'Kumthekar Road', 'Kelkar Road'];

const isProcession = (road: string) =>
  PROCESSION_ROADS.some((p) => p.toLowerCase() === road.toLowerCase());

/**
 * The two sources name the same roads differently.
 *
 * Case is the easy half — the police write "Shivaji road", the notice
 * "Shivaji Road". The rest is genuine: their map says "FC Road" where
 * the notice says "Fergusson College Road". Matched by hand, because a
 * fuzzy match here would silently pair the wrong road with the wrong
 * closing time, which is worse than leaving one undrawn.
 */
const ROAD_ALIASES: Record<string, string> = {
  'fc road': 'Fergusson College Road',
  'jangli maharaj road': 'Jangli Maharaj Road',
  'jm road': 'Jangli Maharaj Road',
};

const closureFor = (road: string) => {
  const key = road.toLowerCase();
  const canonical = ROAD_ALIASES[key] ?? road;
  return VISARJAN_CLOSURES.find((c) => c.road.toLowerCase() === canonical.toLowerCase());
};

const corridor = POLICE_ROADS.filter((r) => r.kind !== 'diversion' && isProcession(r.road)).map(
  (r) => ({ road: r.road, segments: [r.path] })
);

const closures = POLICE_ROADS.filter(
  (r) => r.kind !== 'diversion' && !isProcession(r.road) && closureFor(r.road)
).map((r) => ({ road: r.road, segments: [r.path] }));

const officialRing = POLICE_ROADS.find((r) => r.kind === 'diversion');

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
export { POLICE_SOURCE } from '@/content/visarjan-police';
export const ALL_CHECKPOINTS = TOTAL_CHECKPOINTS;

/** The closing time for a road, from the notice rather than the geometry. */
function closingTime(road: string): string {
  return closureFor(road)?.from ?? '';
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
export const RING_LENGTH_KM = RING_KM;
export const RING_STOPS = RING_POINTS;

export function ringFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { label: `Ring road · keeps out of the corridor` },
        geometry: {
          type: 'LineString',
          coordinates: officialRing?.path ?? [],
        },
      },
    ],
  };
}

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
        // The notice's spelling, not the police map's. The geometry is
        // theirs but the name has to match the list on the page and the
        // times in the notice — carrying "Shivaji road" here while the
        // page says "Shivaji Road" is how a road ends up looking like
        // two different roads.
        name: closureFor(g.road)?.road ?? g.road,
        label: `Closed from ${closingTime(g.road)}`,
        // The stretch comes from the notice, which states it in words;
        // the police geometry carries the line but not the end points.
        stretch: closureFor(g.road)?.stretch ?? '',
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
  map.addSource(VISARJAN_RING_SOURCE_ID, {
    type: 'geojson',
    data: ringFeatureCollection(),
  });

  // The ring goes down first, under the corridor and the closures: it is
  // the widest thing here and the least urgent to read, and where it
  // meets a shut road the restriction must draw on top of it.
  map.addLayer({
    id: 'visarjan-ring-line',
    type: 'line',
    source: VISARJAN_RING_SOURCE_ID,
    minzoom: 11,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': RING_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 17, 6],
      'line-opacity': 0.8,
    },
  });

  map.addLayer({
    id: 'visarjan-ring-label',
    type: 'symbol',
    source: VISARJAN_RING_SOURCE_ID,
    minzoom: 12.5,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 10,
      'symbol-spacing': 400,
    },
    paint: {
      'text-color': RING_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.6,
    },
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
      // Opaque, unlike the diversion discs: a checkpoint sits ON the
      // corridor, and letting the marigold band show through the body
      // would tint it back into the warm family the ring exists to
      // separate it from.
      'circle-opacity': 1,
      // A shade larger than a mandal pin: on this map the checkpoint is
      // the instruction and the mandal is the context.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 4.5, 17, 8.5],
      'circle-stroke-color': CHECKPOINT_RING,
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'visarjan-checkpoint-label',
    type: 'symbol',
    source: VISARJAN_CHECKPOINT_SOURCE_ID,
    // 13, not 13.5: fitting the ring into the default frame sits the map
    // right on the old threshold, and the hour is the whole point of a
    // checkpoint — a dot with no time on it says nothing.
    minzoom: 13,
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
      // The hour is the one thing here that must survive a glance from
      // arm's length in daylight, so it takes the brightest tone on the
      // map and a halo thick enough to clear the corridor beneath it.
      'text-color': CHECKPOINT_RING,
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
