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
 * 'primary'   — inside or at the edge of the peths. The default answers.
 * 'secondary' — on the far side of the river on Jangli Maharaj Road. Usable,
 *               but the walk in is 1.5–2 km, so they are the rare choice
 *               rather than a default, and the map treats them that way.
 * 'network'   — everywhere else on the two lines. Never somewhere you get
 *               off FOR darshan, but very often where you get on: someone
 *               in Kalyani Nagar boards at Kalyani Nagar. These are carried
 *               so the app can name the train to take, and are deliberately
 *               kept out of the map and the alighting search.
 *
 * Tier ranks a station for ARRIVING. Whether you may arrive there at all is
 * a separate question — see `canAlight`.
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
   * What to do at street level. Only the darshan stations carry one; for
   * the rest it is the empty string, because we have nothing useful to say
   * about an exit nobody is taking towards a mandal.
   */
  exitNote: string;
  /**
   * Whether you may get OFF here to walk to the mandals.
   *
   * Separate from tier because it is an operational rule rather than a
   * judgement about walking distance, and it can be false for a station
   * that is otherwise the obvious choice. Mandai is exactly that: it is the
   * nearest station to thirteen of the twenty-three mandals — Tulshibaug,
   * Akhil Mandai, Hutatma Babu Genu and the rest of the southern peths —
   * and you cannot arrive at it.
   *
   * Boarding is never restricted — see `nearestBoardingStation`. A station
   * you cannot arrive at is still a station you can leave from, which is
   * the whole point of Mandai during the festival.
   */
  canAlight: boolean;
  /** Why you cannot arrive here. Shown to the visitor, so it must read plainly. */
  alightNote?: string;
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
 * The five darshan stations — PMC, Kasba Peth, Mandai, Chhatrapati
 * Sambhaji Udyan and
 * Deccan Gymkhana — are EXACT, supplied by the site owner from the ground.
 * They replaced approximations of mine that were wrong by 200 to 590
 * metres, which is worth recording because those approximations had been
 * described in this file as good to about a hundred metres. They were not,
 * and the error was large enough to change which station the app sent
 * people to: see PRIMARY_PREFERENCE_M, which exists because of what the
 * corrected positions revealed.
 *
 * The rest of the network is still approximate — station-box centres from
 * published locations. That is tolerable there and nowhere else, because
 * those stations are only ever used to answer "which station is nearest to
 * you", and consecutive stations are roughly a kilometre apart, so a few
 * hundred metres does not change the answer. They must not be used to
 * quote a walking distance to anything.
 *
 * Even for the exact five, the app does not quote a second-precision walk
 * from a platform: a station has several exits and choosing the wrong one
 * costs more than any of this: Mandai's open on opposite sides of the
 * market. That is what exitNote is for.
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
 * The six with an exitNote are the ones you get off at for darshan. The
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
    lat: 18.522746839064048,
    lng: 73.85325942858569,
    tier: 'primary',
    canAlight: true,
    exitNote:
      'Pune Municipal Corporation, at the top of the peths. Walk south over ' +
      'Shivaji Road for Shaniwar Wada and the Shaniwar Peth mandals.',
  },
  {
    id: 'kasba-peth',
    name: 'Kasba Peth',
    nameMr: 'कसबा पेठ',
    lines: ['purple'],
    lat: 18.521395075715304,
    lng: 73.85953413813881,
    tier: 'primary',
    canAlight: true,
    exitNote:
      'Comes up on Shivaji Road. Kasba Ganpati — the first of the Manache ' +
      'Paach — is about 350 m away, so the ceremonial order starts here. ' +
      'It is also the arrival station for the Budhwar Peth mandals now ' +
      'that Mandai is exit-only, though Dagdusheth is a 770 m walk down.',
  },
  {
    id: 'mandai',
    name: 'Mandai',
    nameMr: 'मंडई',
    lines: ['purple'],
    lat: 18.51270306154373,
    lng: 73.85748863114874,
    // Still 'primary' — it is prominent, central, and the station most
    // people will head for. It is simply not one you can arrive at.
    tier: 'primary',
    canAlight: false,
    alightNote:
      'Mandai runs one way during the festival: you can board here to go ' +
      'home, but trains do not let passengers off. Get off at Kasba Peth ' +
      'and walk down instead — Tulshibaug is about 900 m from there.',
    exitNote:
      'Mahatma Phule Mandai. Boarding only during the festival — this is ' +
      'where you catch the train back, not where you arrive. Closest ' +
      'station to the Mandai and Tulshibaug mandals, which is exactly why ' +
      'its being one-way costs so much.',
  },
  {
    id: 'swargate',
    name: 'Swargate',
    nameMr: 'स्वारगेट',
    lines: ['purple'],
    lat: 18.5010,
    lng: 73.8580,
    // The southern terminus, and the answer to the hole Mandai leaves.
    // Sarasbaug and Hira Bagh were being sent to Deccan Gymkhana, 1.8 km
    // away across the river, when Swargate is 430 m from one and 530 m
    // from the other.
    tier: 'primary',
    canAlight: true,
    exitNote:
      'The Purple Line’s southern end, under the bus stand. Sarasbaug and ' +
      'Hira Bagh are the closest mandals — both around 500 m — and it is ' +
      'the nearest station you can arrive at for the Sadashiv Peth ' +
      'mandals now that Mandai is exit-only.',
  },
  {
    id: 'sambhaji-udyan',
    name: 'Chhatrapati Sambhaji Udyan',
    nameMr: 'छत्रपती संभाजी उद्यान',
    lines: ['aqua'],
    lat: 18.520226794497926,
    lng: 73.84798920582429,
    tier: 'secondary',
    canAlight: true,
    exitNote:
      'On Jangli Maharaj Road. Around a kilometre from the Budhwar Peth ' +
      'mandals — worth it if you are already on the Aqua Line, though ' +
      'Deccan Gymkhana is closer to the western peths.',
  },
  {
    id: 'deccan-gymkhana',
    name: 'Deccan Gymkhana',
    nameMr: 'डेक्कन जिमखाना',
    lines: ['aqua'],
    lat: 18.516326,
    lng: 73.844411,
    tier: 'secondary',
    canAlight: true,
    exitNote:
      'Deccan. A long way from Kasba and Dagdusheth, but the closest ' +
      'station by some distance to the western peths — Garud, Mati, Hatti ' +
      'and Rajaram are all within 600 m of here.',
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
    canAlight: false,
    exitNote: '',
  },

  /* ---------------- Purple Line, north of Civil Court ---------------- */
  { id: 'pcmc', name: 'PCMC', nameMr: 'पिंपरी चिंचवड', lines: ['purple'], lat: 18.6285, lng: 73.8000, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'sant-tukaram-nagar', name: 'Sant Tukaram Nagar', nameMr: 'संत तुकाराम नगर', lines: ['purple'], lat: 18.6220, lng: 73.8100, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'bhosari', name: 'Bhosari', nameMr: 'भोसरी', lines: ['purple'], lat: 18.6145, lng: 73.8190, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'kasarwadi', name: 'Kasarwadi', nameMr: 'कासारवाडी', lines: ['purple'], lat: 18.6035, lng: 73.8250, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'phugewadi', name: 'Phugewadi', nameMr: 'फुगेवाडी', lines: ['purple'], lat: 18.5940, lng: 73.8290, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'dapodi', name: 'Dapodi', nameMr: 'दापोडी', lines: ['purple'], lat: 18.5800, lng: 73.8330, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'bopodi', name: 'Bopodi', nameMr: 'बोपोडी', lines: ['purple'], lat: 18.5695, lng: 73.8360, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'khadki', name: 'Khadki', nameMr: 'खडकी', lines: ['purple'], lat: 18.5620, lng: 73.8400, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'range-hills', name: 'Range Hills', nameMr: 'रेंज हिल्स', lines: ['purple'], lat: 18.5545, lng: 73.8420, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'shivajinagar', name: 'Shivajinagar', nameMr: 'शिवाजीनगर', lines: ['purple'], lat: 18.5310, lng: 73.8480, tier: 'network', canAlight: false, exitNote: '' },

  /* ---------------- Aqua Line, west of Deccan ---------------- */
  { id: 'vanaz', name: 'Vanaz', nameMr: 'वनाझ', lines: ['aqua'], lat: 18.5075, lng: 73.8065, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'anand-nagar', name: 'Anand Nagar', nameMr: 'आनंद नगर', lines: ['aqua'], lat: 18.5090, lng: 73.8125, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'ideal-colony', name: 'Ideal Colony', nameMr: 'आयडियल कॉलनी', lines: ['aqua'], lat: 18.5105, lng: 73.8195, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'nal-stop', name: 'Nal Stop', nameMr: 'नळ स्टॉप', lines: ['aqua'], lat: 18.5115, lng: 73.8280, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'garware-college', name: 'Garware College', nameMr: 'गरवारे कॉलेज', lines: ['aqua'], lat: 18.5135, lng: 73.8345, tier: 'network', canAlight: false, exitNote: '' },

  /* ---------------- Aqua Line, east of Civil Court ---------------- */
  { id: 'mangalwar-peth', name: 'Mangalwar Peth', nameMr: 'मंगळवार पेठ', lines: ['aqua'], lat: 18.5290, lng: 73.8620, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'pune-railway-station', name: 'Pune Railway Station', nameMr: 'पुणे रेल्वे स्टेशन', lines: ['aqua'], lat: 18.5285, lng: 73.8740, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'ruby-hall-clinic', name: 'Ruby Hall Clinic', nameMr: 'रुबी हॉल क्लिनिक', lines: ['aqua'], lat: 18.5340, lng: 73.8790, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'bund-garden', name: 'Bund Garden', nameMr: 'बंड गार्डन', lines: ['aqua'], lat: 18.5375, lng: 73.8830, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'yerawada', name: 'Yerawada', nameMr: 'येरवडा', lines: ['aqua'], lat: 18.5480, lng: 73.8830, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'kalyani-nagar', name: 'Kalyani Nagar', nameMr: 'कल्याणी नगर', lines: ['aqua'], lat: 18.5480, lng: 73.9010, tier: 'network', canAlight: false, exitNote: '' },
  { id: 'ramwadi', name: 'Ramwadi', nameMr: 'रामवाडी', lines: ['aqua'], lat: 18.5510, lng: 73.9130, tier: 'network', canAlight: false, exitNote: '' },
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

/** The peth stations. The map shows these; the picker shows the arrivals. */
export const DARSHAN_STATIONS = METRO_STATIONS.filter((s) => s.tier !== 'network');

/**
 * Where you may actually get off to walk to the mandals.
 *
 * Five of them: Kasba Peth, PMC and Swargate on the peth side, Deccan
 * Gymkhana and Chhatrapati Sambhaji Udyan across the river. Mandai is
 * deliberately absent — it runs one way during the festival, so a route
 * that ends there is a route nobody can take.
 *
 * Its absence costs more than the list suggests. Mandai is the nearest
 * station to thirteen of the twenty-three mandals in the catalogue, so for
 * most of the southern peths the app is now sending people to their second
 * choice. That is the right answer and it needs saying out loud, which is
 * what blockedNearerStation is for.
 *
 * Swargate absorbs five of those: Sarasbaug, Hira Bagh, Seva Mitra, Natu
 * Baug and Chinchechi Talim are all closer to it than to any other station
 * you can get off at.
 */
export const ARRIVAL_STATIONS = DARSHAN_STATIONS.filter((s) => s.canAlight);


/** The default answers: in the peths, and you can get off. */
export const PRIMARY_STATIONS = ARRIVAL_STATIONS.filter((s) => s.tier === 'primary');

/**
 * Stations you can reach but not leave the train at.
 *
 * Kept as a list rather than a special case for Mandai, because if a second
 * station goes one-way mid-festival the app should absorb it as data.
 */
export const EXIT_ONLY_STATIONS = DARSHAN_STATIONS.filter((s) => !s.canAlight);

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
 * How much further a primary station may be before a secondary one wins.
 *
 * The rule used to be absolute: a primary station beat a secondary one
 * however much closer the secondary was. The stated reason was that
 * straight-line distance flatters the Aqua Line stations because the crow
 * does not cross the river on Sambhaji Bridge — and that reason was built
 * on coordinates of mine that put Deccan Gymkhana and Chhatrapati
 * Sambhaji Udyan some
 * 330–470 m west of where they actually are.
 *
 * With the real positions the absolute rule is indefensible. It would send
 * someone to Garud Ganpati out at PMC, 1,290 m away, when Deccan Gymkhana
 * is 318 m from the mandal. Measured across the catalogue it costs seven
 * mandals between 400 m and 970 m of unnecessary walking — Garud, Hatti,
 * Mati, Rajaram, Perugate, Kesariwada and Sarasbaug.
 *
 * So the preference survives but stops being absolute. Inside this margin
 * the primary station still wins: the difference is within the error of
 * using straight lines near a river, and a station in the peths is the
 * better answer when the distances are comparable. Beyond it the secondary
 * is genuinely closer by more than the method's own uncertainty, and
 * pretending otherwise is just the old bug with better coordinates.
 *
 * This is a judgement, not a measurement. Raise it towards Infinity to get
 * the old always-primary behaviour back.
 */
export const PRIMARY_PREFERENCE_M = 400;

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
 * Considers only stations you may ARRIVE at. Two exclusions, for different
 * reasons: getting off at Shivajinagar for Dagdusheth is not an answer even
 * on the days it is nearest, and getting off at Mandai is not possible at
 * all — it is one-way during the festival. Both would otherwise win on
 * distance, which is why this filters by role rather than sorting by it.
 *
 * Primary stations are preferred, but no longer at any cost — a secondary
 * one wins when it is closer by more than PRIMARY_PREFERENCE_M. See that
 * constant for why the preference is not absolute any more; the short
 * version is that it was calibrated against coordinates that turned out to
 * be several hundred metres wrong.
 */
export function nearestStation(
  point: LatLng,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  const primary = nearestIn(PRIMARY_STATIONS, point, maxDistanceM);
  const any = nearestIn(ARRIVAL_STATIONS, point, maxDistanceM);
  if (!primary) return any;
  if (!any) return primary;
  // `any` includes the primaries, so this is only a real choice when the
  // winner is a secondary station.
  return any.distanceM + PRIMARY_PREFERENCE_M < primary.distanceM ? any : primary;
}

/**
 * The station that is closest but cannot be used, when there is one.
 *
 * Exists so the app can explain itself. Someone standing at Tulshibaug
 * knows Mandai is the near one, and being routed to Kasba Peth without a
 * word looks like the app is wrong rather than like the station is shut to
 * arrivals. Returns null when the nearest station is one you can use, so
 * the explanation only appears where it is needed — which, given Mandai is
 * nearest for thirteen of twenty-three mandals, is often.
 */
export function blockedNearerStation(
  point: LatLng,
  chosen: MetroStation,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  const chosenDistance = haversine(point, { lat: chosen.lat, lng: chosen.lng });
  const blocked = nearestIn(EXIT_ONLY_STATIONS, point, maxDistanceM);
  if (!blocked || blocked.distanceM >= chosenDistance) return null;
  return blocked;
}

/**
 * Where to catch the train home, once the darshan is done.
 *
 * Boarding is never restricted, so this searches every station and quite
 * often lands on the one you could not arrive at. That asymmetry is the
 * point: Mandai is a perfectly good way to leave the peths and no way at
 * all to enter them, and a visitor who is told only the first half of that
 * ends up walking back to Kasba Peth for no reason.
 */
export function returnStation(
  stops: Array<{ location: { lat: number; lng: number } }>,
  maxDistanceM = ANCHOR_MAX_M
): NearestStation | null {
  const last = stops[stops.length - 1];
  if (!last) return null;
  return nearestBoardingStation(
    { lat: last.location.lat, lng: last.location.lng },
    maxDistanceM
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
