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
 * 'primary'   — inside or at the edge of the peths. Real places to get off.
 * 'secondary' — on the far side of the river on Jangli Maharaj Road. Usable,
 *               but the walk in is 1.5–2 km, so they are the rare choice
 *               rather than a default, and the map treats them that way.
 * 'network'   — everywhere else on the two lines. Never somewhere you get
 *               off FOR darshan, but very often where you get on: someone
 *               in Kalyani Nagar boards at Kalyani Nagar. These are carried
 *               so the app can name the train to take, and are deliberately
 *               kept out of the map and the alighting search.
 */
export type StationTier = 'primary' | 'secondary' | 'network';

export interface MetroStation {
  id: string;
  name: string;
  nameMr: string;
  /** Usually one. Civil Court is on both — it is the only interchange. */
  lines: MetroLine[];
  lat: number;
  lng: number;
  tier: StationTier;
  /**
   * What to do at street level. Only the five darshan stations carry one;
   * for the rest it is the empty string, because we have nothing useful to
   * say about an exit nobody is taking towards a mandal.
   */
  exitNote: string;
}

/** Line colours and names, matching Pune Metro's own signage. */
export const LINE_COLOR: Record<MetroLine, string> = {
  purple: '#8C6BB1',
  aqua: '#37A6B8',
};

export const LINE_NAME: Record<MetroLine, string> = {
  purple: 'Purple Line',
  aqua: 'Aqua Line',
};

/**
 * ---------------------------------------------------------------------
 * How accurate these coordinates are, stated plainly.
 *
 * They are station-box centres placed from published station locations,
 * good to roughly a hundred metres — not surveyed entrance positions.
 *
 * For the five darshan stations that matters less than it sounds, because
 * a station has several exits and choosing the wrong one costs more than
 * the error here does: Mandai's open on opposite sides of the market. So
 * each carries an exitNote, and the app never quotes a second-precision
 * walking time from a platform.
 *
 * For the rest of the network it matters even less: they are used only to
 * answer "which station is nearest to you", and consecutive stations are
 * roughly a kilometre apart, so a hundred metres does not change the
 * answer. Where it could — two stations close together, like Deccan
 * Gymkhana and Sambhaji Udyan — both are in the same place going the same
 * way, so either answer gets you on the right train.
 *
 * If a coordinate is wrong on the ground, fix it here. This is the only
 * place any of them appear.
 * ---------------------------------------------------------------------
 */

/** Terminus at each end, used to say which way the train is going. */
export const LINE_TERMINI: Record<MetroLine, [string, string]> = {
  purple: ['pcmc', 'swargate'],
  aqua: ['vanaz', 'ramwadi'],
};

/**
 * Every station, ordered along the walk for the five that matter and
 * along the line for the rest.
 *
 * The five with an exitNote are the ones you get off at for darshan. The
 * rest exist so the app can tell someone in Kalyani Nagar or Vanaz which
 * train to board — that is all they are for, and they are kept out of the
 * map and out of the alighting search.
 */
export const METRO_STATIONS: MetroStation[] = [
  /* ---------------- The peths: where you get off ---------------- */
  {
    id: 'pmc',
    name: 'PMC',
    nameMr: 'पीएमसी',
    lines: ['aqua'],
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
    lines: ['purple'],
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
    lines: ['purple'],
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
    lines: ['aqua'],
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
    lines: ['aqua'],
    lat: 18.5172,
    lng: 73.8414,
    tier: 'secondary',
    exitNote:
      'Deccan. The furthest of these from the mandals — a good half hour on ' +
      'foot to Kasba. Useful coming from the west, not as a starting point.',
  },

  /* ---------------- The interchange ---------------- */
  {
    id: 'civil-court',
    name: 'Civil Court',
    nameMr: 'सिव्हिल कोर्ट',
    lines: ['purple', 'aqua'],
    lat: 18.5295,
    lng: 73.8535,
    tier: 'network',
    exitNote: '',
  },

  /* ---------------- Purple Line, north of Civil Court ---------------- */
  { id: 'pcmc', name: 'PCMC', nameMr: 'पिंपरी चिंचवड', lines: ['purple'], lat: 18.6285, lng: 73.8000, tier: 'network', exitNote: '' },
  { id: 'sant-tukaram-nagar', name: 'Sant Tukaram Nagar', nameMr: 'संत तुकाराम नगर', lines: ['purple'], lat: 18.6220, lng: 73.8100, tier: 'network', exitNote: '' },
  { id: 'bhosari', name: 'Bhosari', nameMr: 'भोसरी', lines: ['purple'], lat: 18.6145, lng: 73.8190, tier: 'network', exitNote: '' },
  { id: 'kasarwadi', name: 'Kasarwadi', nameMr: 'कासारवाडी', lines: ['purple'], lat: 18.6035, lng: 73.8250, tier: 'network', exitNote: '' },
  { id: 'phugewadi', name: 'Phugewadi', nameMr: 'फुगेवाडी', lines: ['purple'], lat: 18.5940, lng: 73.8290, tier: 'network', exitNote: '' },
  { id: 'dapodi', name: 'Dapodi', nameMr: 'दापोडी', lines: ['purple'], lat: 18.5800, lng: 73.8330, tier: 'network', exitNote: '' },
  { id: 'bopodi', name: 'Bopodi', nameMr: 'बोपोडी', lines: ['purple'], lat: 18.5695, lng: 73.8360, tier: 'network', exitNote: '' },
  { id: 'khadki', name: 'Khadki', nameMr: 'खडकी', lines: ['purple'], lat: 18.5620, lng: 73.8400, tier: 'network', exitNote: '' },
  { id: 'range-hills', name: 'Range Hills', nameMr: 'रेंज हिल्स', lines: ['purple'], lat: 18.5545, lng: 73.8420, tier: 'network', exitNote: '' },
  { id: 'shivajinagar', name: 'Shivajinagar', nameMr: 'शिवाजीनगर', lines: ['purple'], lat: 18.5310, lng: 73.8480, tier: 'network', exitNote: '' },

  /* ---------------- Purple Line, south of Mandai ---------------- */
  { id: 'swargate', name: 'Swargate', nameMr: 'स्वारगेट', lines: ['purple'], lat: 18.5010, lng: 73.8580, tier: 'network', exitNote: '' },

  /* ---------------- Aqua Line, west of Deccan ---------------- */
  { id: 'vanaz', name: 'Vanaz', nameMr: 'वनाझ', lines: ['aqua'], lat: 18.5075, lng: 73.8065, tier: 'network', exitNote: '' },
  { id: 'anand-nagar', name: 'Anand Nagar', nameMr: 'आनंद नगर', lines: ['aqua'], lat: 18.5090, lng: 73.8125, tier: 'network', exitNote: '' },
  { id: 'ideal-colony', name: 'Ideal Colony', nameMr: 'आयडियल कॉलनी', lines: ['aqua'], lat: 18.5105, lng: 73.8195, tier: 'network', exitNote: '' },
  { id: 'nal-stop', name: 'Nal Stop', nameMr: 'नळ स्टॉप', lines: ['aqua'], lat: 18.5115, lng: 73.8280, tier: 'network', exitNote: '' },
  { id: 'garware-college', name: 'Garware College', nameMr: 'गरवारे कॉलेज', lines: ['aqua'], lat: 18.5135, lng: 73.8345, tier: 'network', exitNote: '' },

  /* ---------------- Aqua Line, east of Civil Court ---------------- */
  { id: 'mangalwar-peth', name: 'Mangalwar Peth', nameMr: 'मंगळवार पेठ', lines: ['aqua'], lat: 18.5290, lng: 73.8620, tier: 'network', exitNote: '' },
  { id: 'pune-railway-station', name: 'Pune Railway Station', nameMr: 'पुणे रेल्वे स्टेशन', lines: ['aqua'], lat: 18.5285, lng: 73.8740, tier: 'network', exitNote: '' },
  { id: 'ruby-hall-clinic', name: 'Ruby Hall Clinic', nameMr: 'रुबी हॉल क्लिनिक', lines: ['aqua'], lat: 18.5340, lng: 73.8790, tier: 'network', exitNote: '' },
  { id: 'bund-garden', name: 'Bund Garden', nameMr: 'बंड गार्डन', lines: ['aqua'], lat: 18.5375, lng: 73.8830, tier: 'network', exitNote: '' },
  { id: 'yerawada', name: 'Yerawada', nameMr: 'येरवडा', lines: ['aqua'], lat: 18.5480, lng: 73.8830, tier: 'network', exitNote: '' },
  { id: 'kalyani-nagar', name: 'Kalyani Nagar', nameMr: 'कल्याणी नगर', lines: ['aqua'], lat: 18.5480, lng: 73.9010, tier: 'network', exitNote: '' },
  { id: 'ramwadi', name: 'Ramwadi', nameMr: 'रामवाडी', lines: ['aqua'], lat: 18.5510, lng: 73.9130, tier: 'network', exitNote: '' },
];

/**
 * Station ids in order along each line, terminus to terminus.
 *
 * This, not the coordinates, is what decides direction and how many stops
 * a journey is. Coordinates are approximate; the sequence is not.
 */
export const LINE_ORDER: Record<MetroLine, string[]> = {
  purple: [
    'pcmc', 'sant-tukaram-nagar', 'bhosari', 'kasarwadi', 'phugewadi',
    'dapodi', 'bopodi', 'khadki', 'range-hills', 'shivajinagar',
    'civil-court', 'kasba-peth', 'mandai', 'swargate',
  ],
  aqua: [
    'vanaz', 'anand-nagar', 'ideal-colony', 'nal-stop', 'garware-college',
    'deccan-gymkhana', 'sambhaji-udyan', 'pmc', 'civil-court',
    'mangalwar-peth', 'pune-railway-station', 'ruby-hall-clinic',
    'bund-garden', 'yerawada', 'kalyani-nagar', 'ramwadi',
  ],
};

/** The only interchange between the two lines. */
export const INTERCHANGE_ID = 'civil-court';

/** The five you get off at. The map and the picker show only these. */
export const DARSHAN_STATIONS = METRO_STATIONS.filter((s) => s.tier !== 'network');
export const PRIMARY_STATIONS = METRO_STATIONS.filter((s) => s.tier === 'primary');

/**
 * The one line to colour a station by. Every station has exactly one
 * except Civil Court, which is the interchange; there the Purple Line is
 * shown, because that is the one that reaches the peths.
 */
export function primaryLine(station: MetroStation): MetroLine {
  return station.lines[0];
}

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

/**
 * How far someone will plausibly walk to a station they are boarding at.
 *
 * More generous than ANCHOR_MAX_M, and for a different reason: the walk to
 * the station is a choice the traveller makes knowing the alternative,
 * whereas the walk from the station is one the app is imposing on them.
 * Past this we say nothing rather than suggesting a 6 km hike to a platform.
 */
export const BOARD_MAX_M = 4_000;

export interface NearestStation {
  station: MetroStation;
  distanceM: number;
}

function nearestIn(
  pool: MetroStation[],
  point: LatLng,
  maxDistanceM: number
): NearestStation | null {
  let best: NearestStation | null = null;
  for (const station of pool) {
    const distanceM = haversine(point, { lat: station.lat, lng: station.lng });
    if (distanceM > maxDistanceM) continue;
    if (!best || distanceM < best.distanceM) best = { station, distanceM };
  }
  return best;
}

/**
 * The station someone would actually get off at for a point.
 *
 * Considers only the five darshan stations — getting off at Shivajinagar
 * for Dagdusheth is not an answer, even on the days it is nearest.
 *
 * Primary stations are preferred outright rather than by distance: from
 * most of Shaniwar Peth, Sambhaji Udyan is closer as the crow flies than
 * Mandai is, but the crow does not cross the river on Sambhaji Bridge. A
 * secondary station is returned only when no primary one is in range.
 */
export function nearestStation(
  point: LatLng,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  return (
    nearestIn(PRIMARY_STATIONS, point, maxDistanceM) ??
    nearestIn(DARSHAN_STATIONS, point, maxDistanceM)
  );
}

/**
 * The station someone would board at, which is any station at all.
 *
 * Unlike alighting, there is no preference here — you get on wherever you
 * are. Someone in Kalyani Nagar boards at Kalyani Nagar.
 */
export function nearestBoardingStation(
  point: LatLng,
  maxDistanceM = BOARD_MAX_M
): NearestStation | null {
  return nearestIn(METRO_STATIONS, point, maxDistanceM);
}

/**
 * The station a whole route should be reached from.
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

/* =====================================================================
 * Which train to take.
 * ===================================================================== */

export interface MetroLeg {
  line: MetroLine;
  from: MetroStation;
  to: MetroStation;
  /** The terminus shown on the front of the train, so the platform is obvious. */
  towards: string;
  stops: number;
}

export interface MetroJourney {
  board: MetroStation;
  /** Straight-line metres from the traveller to the boarding station. */
  boardDistanceM: number;
  alight: MetroStation;
  legs: MetroLeg[];
  /** Where you change, when the journey needs it. */
  interchange: MetroStation | null;
  totalStops: number;
  /**
   * True when the traveller is already at the station they would get off
   * at — no train is involved and the UI should say so rather than
   * printing a zero-stop journey.
   */
  alreadyThere: boolean;
}

function lineIndex(line: MetroLine, id: string): number {
  return LINE_ORDER[line].indexOf(id);
}

function sharedLine(a: MetroStation, b: MetroStation): MetroLine | null {
  return a.lines.find((l) => b.lines.includes(l)) ?? null;
}

function makeLeg(line: MetroLine, from: MetroStation, to: MetroStation): MetroLeg {
  const i = lineIndex(line, from.id);
  const j = lineIndex(line, to.id);
  const [start, end] = LINE_TERMINI[line];
  const terminusId = j > i ? end : start;
  return {
    line,
    from,
    to,
    towards: stationById(terminusId)?.name ?? terminusId,
    stops: Math.abs(j - i),
  };
}

/**
 * Plans the actual train journey: where to get on, which direction, where
 * to change, where to get off.
 *
 * Two lines and one interchange make this small enough to solve directly
 * rather than with a graph search — if the two stations share a line it is
 * one leg, and if they do not it is two legs through Civil Court, because
 * that is the only place the lines meet. A general router here would be
 * more code hiding the same two cases.
 *
 * Returns null when there is no station within walking distance of the
 * traveller, which is the honest answer for most of Pune: the network is
 * two lines, and plenty of the city is nowhere near either.
 */
export function planMetroJourney(
  from: LatLng,
  alight: MetroStation,
  maxBoardDistanceM = BOARD_MAX_M
): MetroJourney | null {
  const boarding = nearestBoardingStation(from, maxBoardDistanceM);
  if (!boarding) return null;

  const board = boarding.station;
  const base = {
    board,
    boardDistanceM: boarding.distanceM,
    alight,
  };

  if (board.id === alight.id) {
    return { ...base, legs: [], interchange: null, totalStops: 0, alreadyThere: true };
  }

  const direct = sharedLine(board, alight);
  if (direct) {
    const leg = makeLeg(direct, board, alight);
    return {
      ...base,
      legs: [leg],
      interchange: null,
      totalStops: leg.stops,
      alreadyThere: false,
    };
  }

  const interchange = stationById(INTERCHANGE_ID);
  const boardLine = board.lines.find((l) => interchange?.lines.includes(l));
  const alightLine = alight.lines.find((l) => interchange?.lines.includes(l));
  if (!interchange || !boardLine || !alightLine) return null;

  const first = makeLeg(boardLine, board, interchange);
  const second = makeLeg(alightLine, interchange, alight);
  return {
    ...base,
    legs: [first, second],
    interchange,
    totalStops: first.stops + second.stops,
    alreadyThere: false,
  };
}

/**
 * Roughly how long the train takes.
 *
 * Deliberately coarse. Pune Metro runs about a stop every two minutes
 * including dwell, and a change at Civil Court is a walk between platforms
 * plus a wait. There is no live timetable behind this, so it is presented
 * as "about" and never to the minute — quoting 14 minutes from a constant
 * would be inventing precision the app does not have.
 */
export const SECONDS_PER_STOP = 120;
export const INTERCHANGE_SECONDS = 300;

export function journeySeconds(journey: MetroJourney): number {
  const changes = Math.max(0, journey.legs.length - 1);
  return journey.totalStops * SECONDS_PER_STOP + changes * INTERCHANGE_SECONDS;
}
