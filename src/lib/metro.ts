import { haversine, type LatLng } from '@/lib/geo';

/**
 * Pune Metro, as far as a darshan walk is concerned.
 *
 * The festival closes most of the peth core to vehicles. Cars were removed
 * from the planner for that reason — offering a mode that ends at a police
 * barricade is worse than offering nothing — and the metro replaces them,
 * because it is the one way into the peths that is unaffected by the
 * closures and, for the three underground stations, actually ends inside
 * them.
 *
 * ---------------------------------------------------------------------
 * The metro is an ANCHOR, not a leg.
 *
 * Nobody rides one stop from Dagdusheth to Tulshibaug — they are six
 * minutes apart on foot and the stations are further apart than the
 * mandals. So "metro" does not mean the route is travelled by train. It
 * means the route STARTS and ENDS at a station and is walked in between,
 * which is what people actually do. Every travel estimate in metro mode is
 * therefore a walking estimate; see MODE_SPEED_MPS in lib/geo.
 *
 * ---------------------------------------------------------------------
 * How accurate these coordinates are, stated plainly.
 *
 * They are station-box centres placed from published station locations, good
 * to roughly a hundred metres — not surveyed entrance positions. That
 * matters less than it sounds, because a metro station has several exits and
 * choosing the wrong one costs more than the error here does: Mandai's exits
 * open on opposite sides of the market. So each station carries an
 * `exitNote` saying which way to walk, and the app never quotes a
 * second-precision walking time from a station.
 *
 * If a coordinate is wrong on the ground, fix it here — this is the only
 * place any of them appear.
 */

export type MetroLine = 'purple' | 'aqua';

/**
 * How much of the peth darshan a station is actually good for.
 *
 * 'primary'   — inside or at the edge of the peths. Real starting points.
 * 'secondary' — on the far side of the river on Jangli Maharaj Road. Usable,
 *               but the walk in is 1.5–2 km, so they are the rare choice
 *               rather than a default, and the map treats them that way.
 */
export type StationTier = 'primary' | 'secondary';

export interface MetroStation {
  id: string;
  name: string;
  nameMr: string;
  line: MetroLine;
  lat: number;
  lng: number;
  tier: StationTier;
  /** What to do at street level. The exits differ more than the coordinates. */
  exitNote: string;
}

/** Line colours, matching Pune Metro's own signage. */
export const LINE_COLOR: Record<MetroLine, string> = {
  purple: '#8C6BB1',
  aqua: '#37A6B8',
};

export const LINE_NAME: Record<MetroLine, string> = {
  purple: 'Purple Line',
  aqua: 'Aqua Line',
};

/**
 * Ordered north to south along the walk, which is how someone reading the
 * list is thinking about them — not alphabetically and not by line.
 */
export const METRO_STATIONS: MetroStation[] = [
  {
    id: 'pmc',
    name: 'PMC',
    nameMr: 'पीएमसी',
    line: 'aqua',
    lat: 18.5272,
    lng: 73.8502,
    tier: 'primary',
    exitNote:
      'Pune Municipal Corporation, at the top of the peths. Walk south over ' +
      'Shivaji Road for Shaniwar Wada and the Shaniwar Peth mandals.',
  },
  {
    id: 'kasba-peth',
    name: 'Kasba Peth',
    nameMr: 'कसबा पेठ',
    line: 'purple',
    lat: 18.5186,
    lng: 73.8562,
    tier: 'primary',
    exitNote:
      'Comes up on Shivaji Road. Kasba Ganpati — the first of the Manache ' +
      'Paach — is a few minutes away, so the ceremonial order starts here.',
  },
  {
    id: 'mandai',
    name: 'Mandai',
    nameMr: 'मंडई',
    line: 'purple',
    lat: 18.5113,
    lng: 73.8563,
    tier: 'primary',
    exitNote:
      'Mahatma Phule Mandai. The densest stretch of the festival is on foot ' +
      'from here — Dagdusheth, Tulshibaug and Tambdi Jogeshwari are all close.',
  },
  {
    id: 'sambhaji-udyan',
    name: 'Sambhaji Udyan',
    nameMr: 'संभाजी उद्यान',
    line: 'aqua',
    lat: 18.5213,
    lng: 73.8437,
    tier: 'secondary',
    exitNote:
      'On Jangli Maharaj Road, across the river from the peths. About a ' +
      '20-minute walk in over Sambhaji Bridge — worth it only if you are ' +
      'already on the Aqua Line.',
  },
  {
    id: 'deccan-gymkhana',
    name: 'Deccan Gymkhana',
    nameMr: 'डेक्कन जिमखाना',
    line: 'aqua',
    lat: 18.5172,
    lng: 73.8414,
    tier: 'secondary',
    exitNote:
      'Deccan. The furthest of these from the mandals — a good half hour on ' +
      'foot to Kasba. Useful coming from the west, not as a starting point.',
  },
];

export const PRIMARY_STATIONS = METRO_STATIONS.filter((s) => s.tier === 'primary');

export function stationById(id: string): MetroStation | null {
  return METRO_STATIONS.find((s) => s.id === id) ?? null;
}

/**
 * Beyond this, a station is not the way you got somewhere.
 *
 * The peth core is about 2 km across, so anything inside 2.5 km is a
 * plausible walk-in. Outside it, anchoring a route to one of these stations
 * would be a fabrication — the Chinchwad temple route is 20 km from Mandai,
 * and quietly labelling it "from Mandai" would be worse than saying nothing.
 * Callers that get null must show no station at all rather than the nearest.
 */
export const ANCHOR_MAX_M = 2_500;

export interface NearestStation {
  station: MetroStation;
  distanceM: number;
}

/**
 * The station someone would actually use for a point.
 *
 * Primary stations are preferred outright rather than by distance: from most
 * of Shaniwar Peth, Sambhaji Udyan is closer as the crow flies than Mandai
 * is, but the crow does not cross the river on Sambhaji Bridge. A secondary
 * station is returned only when no primary one is in range.
 */
export function nearestStation(
  point: LatLng,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  const search = (pool: MetroStation[]): NearestStation | null => {
    let best: NearestStation | null = null;
    for (const station of pool) {
      const distanceM = haversine(point, { lat: station.lat, lng: station.lng });
      if (distanceM > maxDistanceM) continue;
      if (!best || distanceM < best.distanceM) best = { station, distanceM };
    }
    return best;
  };

  return search(PRIMARY_STATIONS) ?? search(METRO_STATIONS);
}

/**
 * The station a whole route should start from.
 *
 * Measured against the first stop rather than the centroid: a route is
 * walked in order, and you get off the train where it begins, not where it
 * averages out.
 */
export function stationForRoute(
  stops: Array<{ location: { lat: number; lng: number } }>,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  const first = stops[0];
  if (!first) return null;
  return nearestStation({ lat: first.location.lat, lng: first.location.lng }, maxDistanceM);
}
