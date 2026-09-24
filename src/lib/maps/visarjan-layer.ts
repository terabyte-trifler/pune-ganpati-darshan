import type { Map as MapLibreMap } from 'maplibre-gl';
import { VISARJAN_CLOSURES, DIVERSION_POINTS, MANDAL_ROUTE_PATHS } from '@/content/visarjan';
import { CHECKPOINT_POINTS, TOTAL_CHECKPOINTS } from '@/content/visarjan-checkpoints';
import { RING_POINTS, RING_KM } from '@/content/visarjan-ringroad';
import { POLICE_ROADS, POLICE_PARKING } from '@/content/visarjan-police';
import { EXTRA_ROADS } from '@/content/visarjan-extra-roads';

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
export const VISARJAN_PARKING_SOURCE_ID = 'visarjan-parking';
export const VISARJAN_ROUTE_STOP_SOURCE_ID = 'visarjan-route-stops';

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
 * The app's own parking blue, deliberately unchanged.
 *
 * The general festival parking was taken off this map because the roads
 * reaching most of those places shut through the morning — a suggestion
 * the day could not honour. These twelve are a different list: the
 * police's own choices for visarjan, sited outside the corridor so they
 * stay reachable from the ring. Putting them back is not undoing that
 * decision, it is the same decision applied to better data.
 *
 * Same blue and same P as /parking and every other map in the app, so
 * nobody has to learn a second parking mark for one day.
 */
const PARKING_COLOR = '#6C8AB0';

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

const closures = [
  ...POLICE_ROADS.filter(
    (r) => r.kind !== 'diversion' && !isProcession(r.road) && closureFor(r.road)
  ).map((r) => ({ road: r.road, segments: [r.path] })),
  /**
   * Roads the police tracker has no line for.
   *
   * Their map carries eleven roads; the notice lists seventeen closures.
   * Jangli Maharaj Road is the gap people notice, because it is the
   * spine of Deccan — so it comes from OSM, checked against the junction
   * the notice names. See scripts/emit-extra-roads.mjs.
   */
  ...EXTRA_ROADS.filter((r) => closureFor(r.road)).map((r) => ({
    road: r.road,
    segments: r.segments,
  })),
];

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

export const PARKING_COUNT = POLICE_PARKING.length;

/**
 * Stops on another mandal's route that are not already drawn.
 *
 * Dagdusheth's route crosses Belbaug and Ganpati Chowk, which are
 * already on the map as Kasba's checkpoints and say so when tapped —
 * drawing them twice would stack a mark on a mark. What was missing is
 * the Sambhaji Maharaj bridge, which is where the procession leaves the
 * peths for the river and the only other stop on that route anyone has
 * been able to place.
 *
 * The four that stay off — Nagarkar Talim, Umbrya Ganpati, Lokmanya
 * Tilak Chowk, Panchaleshwar — are in neither OSM nor Nominatim.
 */
/**
 * One junction, two names.
 *
 * Kasba's schedule ends at "Tilak Chowk"; Dagdusheth's route calls the
 * same corner "Lokmanya Tilak Chowk". Left unlinked they would draw as
 * two marks on one corner, and neither would mention the other
 * procession — so the names are folded together here.
 *
 * Explicitly, not by stripping honorifics: "Lokmanya Tilak Putala
 * (Mandai)" is a DIFFERENT place 1,265 m east, and a rule clever enough
 * to fold the first pair would have folded that one too.
 */
const PLACE_ALIASES: Record<string, string> = {
  'lokmanya tilak chowk': 'tilak chowk',
};

const canonicalPlace = (place: string) => {
  const key = place.trim().toLowerCase();
  return PLACE_ALIASES[key] ?? key;
};

const drawnElsewhere = new Set(CHECKPOINT_POINTS.map((c) => canonicalPlace(c.place)));

const routeStops = MANDAL_ROUTE_PATHS.flatMap((r) => [
  // The ghat is where the day ends, so it is drawn even though it is not
  // a numbered stop — and labelled as the ghat rather than a stop, since
  // arriving there is a different thing from passing a corner.
  ...(r.endLat !== undefined && r.endLng !== undefined
    ? [
        {
          mandal: shortMandal(r.mandal),
          place: r.endsAt.replace(/^the /, ''),
          placeMr: r.endsAtMr,
          lat: r.endLat,
          lng: r.endLng,
          order: r.stops.length + 1,
          total: r.stops.length + 1,
          startsAt: r.startsAt,
          isEnd: true,
        },
      ]
    : []),
  ...r.stops
    .filter(
      (s) =>
        s.lat !== undefined &&
        s.lng !== undefined &&
        !drawnElsewhere.has(canonicalPlace(s.place))
    )
    .map((s) => ({
      mandal: shortMandal(r.mandal),
      place: s.place,
      placeMr: s.placeMr,
      lat: s.lat as number,
      lng: s.lng as number,
      order: r.stops.indexOf(s) + 1,
      total: r.stops.length,
      startsAt: r.startsAt,
      isEnd: false,
    })),
]);

export const DRAWN_ROUTE_STOPS = routeStops.length;
export const TOTAL_ROUTE_STOPS = MANDAL_ROUTE_PATHS.reduce(
  (n, r) => n + r.stops.length,
  0
);

export function routeStopFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routeStops.map((s) => ({
      type: 'Feature',
      properties: {
        place: s.place,
        placeMr: s.placeMr,
        mandal: s.mandal,
        label: s.isEnd ? `${s.mandal} · immersion ghat` : `${s.mandal} · stop ${s.order}`,
        startsAt: s.startsAt,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    })),
  };
}

export function visarjanParkingFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: POLICE_PARKING.map((p) => ({
      type: 'Feature',
      properties: { label: p.name },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  };
}

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

/**
 * Other mandals whose published route names this same chowk.
 *
 * Dagdusheth's route crosses Belbaug Chowk, Ganpati Chowk and Umbrya
 * Ganpati, all of which are on Kasba's schedule. Two of the three are
 * already drawn as Kasba checkpoints, so drawing them again for
 * Dagdusheth would stack a second dot on the first and add nothing.
 *
 * What was missing is that the existing mark said nothing about it. A
 * reader standing at Belbaug wants to know that a second procession
 * comes through, and that is a fact we already hold — no new coordinate
 * required, which matters because the rest of Dagdusheth's route
 * (Nagarkar Talim, Lokmanya Tilak Chowk, the Sambhaji Maharaj bridge,
 * Panchaleshwar) is not in OSM and stays unplaced.
 */
function alsoPassedBy(place: string): string[] {
  const target = canonicalPlace(place);
  return MANDAL_ROUTE_PATHS.filter((r) =>
    r.stops.some((s) => canonicalPlace(s.place) === target)
  ).map((r) => shortMandal(r.mandal));
}

/** "Shrimant Dagdusheth Halwai Ganpati" is a lot of pin label. */
function shortMandal(name: string): string {
  return name
    .replace(/^Shri(mant)?\s+/i, '')
    .replace(/\s+Halwai Ganpati$/i, '')
    .replace(/\s+Ganpati$/i, '')
    .trim();
}

export function checkpointFeatureCollection(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: CHECKPOINT_POINTS.map((c) => ({
      type: 'Feature',
      properties: {
        time: c.time,
        place: c.place,
        placeMr: c.placeMr,
        alsoOn: alsoPassedBy(c.place).join(', '),
      },
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
 * The marks on this map a tap should be able to name.
 *
 * Each draws as a bare disc until the zoom brings its label in, which is
 * exactly when someone wants to know what it is. Parking was the one
 * asked for; the checkpoints and diversions have the same problem, and
 * having one of three answer a tap would be the odd result.
 */
export const VISARJAN_TAP_LAYERS = [
  'visarjan-parking',
  'visarjan-checkpoint',
  'visarjan-diversion',
  'visarjan-route-stop',
] as const;

/** Title and subtitle for a tapped mark, or null if it carries neither. */
export function visarjanTapLabel(
  layerId: string,
  props: Record<string, unknown> | null | undefined
): { title: string; subtitle: string | null } | null {
  if (!props) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  if (layerId === 'visarjan-parking') {
    const name = str(props.label);
    return name ? { title: name, subtitle: 'Parking · Pune City Police' } : null;
  }
  if (layerId === 'visarjan-checkpoint') {
    const place = str(props.place);
    const time = str(props.time);
    if (!place) return null;
    const also = str(props.alsoOn);
    const mr = str(props.placeMr);
    // The hour leads: it is why this mark exists. A second procession
    // through the same chowk is the next most useful thing to know.
    return {
      title: time ? `${time} · ${place}` : place,
      subtitle: also ? `${mr ? `${mr} · ` : ''}${also} passes here too` : mr,
    };
  }
  if (layerId === 'visarjan-route-stop') {
    const place = str(props.place);
    if (!place) return null;
    const mandal = str(props.mandal);
    const startsAt = str(props.startsAt);
    return {
      title: place,
      subtitle: [str(props.placeMr), mandal && startsAt ? `${mandal}, from ${startsAt}` : mandal]
        .filter(Boolean)
        .join(' · ') || null,
    };
  }
  if (layerId === 'visarjan-diversion') {
    const name = str(props.name);
    return name ? { title: name, subtitle: str(props.road) } : null;
  }
  return null;
}

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
    'visarjan-route-stop', 'visarjan-route-stop-label',
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
  map.addSource(VISARJAN_PARKING_SOURCE_ID, {
    type: 'geojson',
    data: visarjanParkingFeatureCollection(),
  });
  map.addSource(VISARJAN_ROUTE_STOP_SOURCE_ID, {
    type: 'geojson',
    data: routeStopFeatureCollection(),
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

  // Parking, in the same blue disc with a P that every other map in the
  // app uses. Below the checkpoints and diversions: it answers a
  // question asked before setting out, not one asked at a junction.
  map.addLayer({
    id: 'visarjan-parking',
    type: 'circle',
    source: VISARJAN_PARKING_SOURCE_ID,
    minzoom: 12,
    paint: {
      'circle-color': PARKING_COLOR,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 5, 16, 11],
      'circle-stroke-color': '#14100C',
      'circle-stroke-width': 1.5,
    },
  });

  map.addLayer({
    id: 'visarjan-parking-p',
    type: 'symbol',
    source: VISARJAN_PARKING_SOURCE_ID,
    minzoom: 12,
    layout: {
      'text-field': 'P',
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 8, 16, 14],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#0E1724' },
  });

  map.addLayer({
    id: 'visarjan-parking-label',
    type: 'symbol',
    source: VISARJAN_PARKING_SOURCE_ID,
    minzoom: 14,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-padding': 3,
      'text-max-width': 9,
    },
    paint: {
      'text-color': PARKING_COLOR,
      'text-halo-color': '#14100C',
      'text-halo-width': 1.4,
    },
  });

  // Another mandal's route stop. Brass, the app's colour for a mandal,
  // so it reads as belonging to a procession rather than to the traffic
  // order — and hollow, to say "on a route" rather than "at an hour",
  // which is what the white-ringed checkpoints mean.
  map.addLayer({
    id: 'visarjan-route-stop',
    type: 'circle',
    source: VISARJAN_ROUTE_STOP_SOURCE_ID,
    minzoom: 12.5,
    paint: {
      'circle-color': '#14100C',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 4, 17, 7.5],
      'circle-stroke-color': '#c9a227',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: 'visarjan-route-stop-label',
    type: 'symbol',
    source: VISARJAN_ROUTE_STOP_SOURCE_ID,
    minzoom: 13.5,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 9.5,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-padding': 3,
      'text-max-width': 9,
    },
    paint: {
      'text-color': '#c9a227',
      'text-halo-color': '#14100C',
      'text-halo-width': 1.4,
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
