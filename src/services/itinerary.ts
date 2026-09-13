import {
  haversine,
  estimateDurationSeconds,
  type LatLng,
  type TravelMode,
} from '@/lib/geo';
import { optimizeLocally } from '@/services/route-optimizer';
import { chooseParking, type ParkingChoice } from './parking-plan';
import type { Ganpati } from '@/types/ganpati';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Builds a darshan itinerary that actually fits a time budget.
 *
 * The hard part is not distance, it is queues. Dagdusheth alone can take 45
 * minutes at typical times and well over two hours at peak, while the walk
 * from Tulshibaug is six. A planner that only counts travel time will happily
 * tell someone they can do nine mandals in two hours, and be wrong by a
 * factor of three. So the budget is spent on BOTH travel and dwell time.
 */

/** How thoroughly the visitor wants to take darshan. */
export type DarshanPace = 'thorough' | 'balanced' | 'quick';

export type Interest =
  | 'manache'
  | 'famous'
  | 'dekhava'
  | 'historic'
  | 'temple'
  | 'surprise';

export interface ItineraryRequest {
  /** Total time available, in minutes. */
  budgetMinutes: number;
  interests: Interest[];
  pace: DarshanPace;
  mode: TravelMode;
  origin: LatLng;
  mandals: Ganpati[];
  /**
   * Live crowd level per mandal id, from the tracker. Absent or null for a
   * mandal simply means nobody has reported it recently.
   */
  crowdByMandalId?: Record<string, CrowdLevel | null>;
}

export interface ItineraryStop {
  ganpati: Ganpati;
  darshanMinutes: number;
  travelMinutesFromPrevious: number;
  /** What the tracker said when this plan was built, for the UI to show. */
  crowd: CrowdLevel | null;
}

export interface Itinerary {
  stops: ItineraryStop[];
  darshanMinutes: number;
  travelMinutes: number;
  totalMinutes: number;
  budgetMinutes: number;
  /** Mandals that matched the interests but did not fit the budget. */
  skipped: Ganpati[];
  /** True when some chosen mandal has no dwell estimate at all. */
  hasUnknownDwell: boolean;
  /** True when at least one stop's timing was adjusted by a live report. */
  crowdAdjusted: boolean;
  /**
   * Two-wheeler plans only: where to leave the vehicle, and the ride to
   * get there. Null in every other mode, and null when there are no stops.
   *
   * The peths are closed to traffic during the festival, so a two-wheeler
   * plan is one ride and then a walk — see services/parking-plan.
   */
  parking: ParkingChoice | null;
}

/**
 * Dwell time for a mandal under a given pace.
 *
 * 'thorough' assumes queuing at every mandal, so it uses the peak estimate
 * where we have one. 'quick' assumes viewing from the road wherever that is
 * possible, which is genuinely how most people do a long trail.
 */
/**
 * How live crowd stretches or shrinks a dwell estimate.
 *
 * This does not invent a queue time. The catalogue already carries two
 * numbers for every mandal — a typical dwell and a peak one — and the peak
 * fallback in this same file is `typical x 1.6`. All the tracker does is
 * say which end of that existing range applies right now, which is exactly
 * the question a static estimate cannot answer.
 *
 * `null` means nobody has reported recently, and that leaves the estimate
 * untouched. No information is not the same as good news, and a plan that
 * quietly assumed short queues wherever it was ignorant would be wrong in
 * the most expensive direction — someone standing in a forty-minute line
 * with a schedule that budgeted twelve.
 */
const CROWD_DWELL_FACTOR: Record<CrowdLevel, number> = {
  short: 0.7,
  moving: 1,
  long: 1.6,
};

export function dwellMinutes(
  g: Ganpati,
  pace: DarshanPace,
  crowd?: CrowdLevel | null
): number {
  const base = baseDwellMinutes(g, pace);
  if (!crowd) return base;
  // At least a minute: a green mandal is still a stop, not a drive-by.
  return Math.max(1, Math.round(base * CROWD_DWELL_FACTOR[crowd]));
}

function baseDwellMinutes(g: Ganpati, pace: DarshanPace): number {
  const typical = g.darshanMinutes;
  // No estimate: assume a short roadside look rather than skewing the whole
  // plan with a guess. Surfaced via `hasUnknownDwell`.
  if (typical == null) return 5;

  switch (pace) {
    case 'thorough':
      return g.peakDarshanMinutes ?? Math.round(typical * 1.6);
    case 'quick':
      // Viewing from outside skips the queue, which is nearly all of the time
      // at the big mandals.
      return g.darshanStyle === 'inside' ? Math.max(4, Math.round(typical * 0.35)) : Math.max(3, Math.round(typical * 0.6));
    case 'balanced':
    default:
      return typical;
  }
}

const INTEREST_TAGS: Record<Interest, string[]> = {
  manache: ['manache'],
  famous: ['famous', 'temple', 'aarti'],
  dekhava: ['dekhava', 'decoration', 'night'],
  historic: ['historic', 'heritage', 'early-mandal', 'talim', 'tilak'],
  temple: ['temple', 'park', 'family'],
  surprise: [],
};

/**
 * Whether a year-round temple may be put in a built route.
 *
 * Only when the visitor asked for temples. Someone who picked "the famous
 * ones" or "dekhava & light shows" is planning a pandal crawl — the mandap,
 * the lights, the ten-day queue — and a permanent temple is a different
 * kind of outing that happens to have a Ganpati in it. Sarasbaug and
 * Trishund were being folded into those routes because they carry 'famous'
 * and 'historic' categories, so the plan quietly swapped a pandal for a
 * temple and spent the budget walking there.
 *
 * 'surprise' does not qualify. It means "anything from the festival", and
 * it is the one option where the visitor has expressed no preference at all
 * — so it should not spend their time on the category they did not ask for.
 *
 * Temples are not hidden anywhere else: they stay in the catalogue, on the
 * map, in search and in the planner if someone adds one by hand. This is
 * about what the route BUILDER reaches for unprompted.
 */
function allowsTemples(interests: Interest[]): boolean {
  return interests.includes('temple');
}

/** 0–1 relevance of a mandal to the chosen interests. */
function interestScore(g: Ganpati, interests: Interest[]): number {
  if (interests.length === 0 || interests.includes('surprise')) return 0.5;

  let best = 0;
  for (const interest of interests) {
    if (interest === 'manache' && g.category === 'maanache') best = Math.max(best, 1);
    if (interest === 'famous' && g.category === 'famous') best = Math.max(best, 0.9);
    if (interest === 'historic' && g.category === 'historic') best = Math.max(best, 0.9);

    const tags = INTEREST_TAGS[interest];
    if (tags.some((t) => g.tags.includes(t))) best = Math.max(best, 0.8);
  }
  return best;
}

/** Total minutes for an ordered set of stops, including travel from origin. */
function costOf(
  ordered: Ganpati[],
  origin: LatLng,
  mode: TravelMode,
  pace: DarshanPace,
  crowd: Record<string, CrowdLevel | null>
): { travel: number; darshan: number; total: number; parking?: ParkingChoice | null } {
  // A two-wheeler cannot be ridden between mandals during the festival:
  // the peth core is barricaded. So the journey is a ride to parking and a
  // walk from it, and the budget has to be spent that way or the plan
  // promises a trip the police have closed.
  if (mode === 'two_wheeler' && ordered.length > 0) {
    const parking = chooseParking(origin, ordered);
    if (parking) {
      const darshan = ordered.reduce(
        (sum, g) => sum + dwellMinutes(g, pace, crowd[g.id]),
        0
      );
      return {
        travel: parking.travelMinutes,
        darshan,
        total: parking.travelMinutes + darshan,
        parking,
      };
    }
  }

  let travelSeconds = 0;
  let previous = origin;
  for (const g of ordered) {
    const point = { lat: g.location.lat, lng: g.location.lng };
    travelSeconds += estimateDurationSeconds(haversine(previous, point), mode);
    previous = point;
  }

  const travel = Math.round(travelSeconds / 60);
  const darshan = ordered.reduce(
    (sum, g) => sum + dwellMinutes(g, pace, crowd[g.id]),
    0
  );
  return { travel, darshan, total: travel + darshan };
}

/** Orders a set of stops for the shortest walk from the origin. */
function order(mandals: Ganpati[], origin: LatLng, mode: TravelMode): Ganpati[] {
  if (mandals.length < 2) return mandals;

  // On a two-wheeler the walk starts at the parking, so the order has to
  // be optimised from there. Ordering from the rider's own position would
  // sequence a walk nobody takes.
  if (mode === 'two_wheeler') {
    const parking = chooseParking(origin, mandals);
    if (parking) return parking.order.map((i) => mandals[i]);
  }

  const result = optimizeLocally(
    origin,
    mandals.map((g) => ({ lat: g.location.lat, lng: g.location.lng })),
    mode
  );
  return result.order.map((i) => mandals[i]);
}

/**
 * Greedy construction against the budget.
 *
 * At each step it adds the candidate with the best relevance-per-minute, then
 * re-optimises the whole order — because inserting a stop can shorten the
 * route by sitting between two existing ones, and a fixed insertion order
 * would miss that.
 */
export function buildItinerary(request: ItineraryRequest): Itinerary {
  const {
    budgetMinutes, interests, pace, mode, origin, mandals,
    crowdByMandalId = {},
  } = request;

  const templesWanted = allowsTemples(interests);

  const candidates = mandals
    .filter((g) => !g.isTemple || templesWanted)
    .map((g) => ({ g, score: interestScore(g, interests) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.g.prominence - a.g.prominence);

  const chosen: Ganpati[] = [];
  const skipped: Ganpati[] = [];

  for (const { g } of candidates) {
    const trial = order([...chosen, g], origin, mode);
    const cost = costOf(trial, origin, mode, pace, crowdByMandalId);

    if (cost.total <= budgetMinutes) {
      chosen.splice(0, chosen.length, ...trial);
    } else {
      skipped.push(g);
    }
  }

  const finalOrder = order(chosen, origin, mode);
  const cost = costOf(finalOrder, origin, mode, pace, crowdByMandalId);
  const parking = cost.parking ?? null;

  // Per-stop breakdown, so the UI can show where the time goes. On a
  // two-wheeler the legs start at the parking and are walked, because that
  // is the journey the plan actually describes.
  const stops: ItineraryStop[] = [];
  const legMode: TravelMode = parking ? 'walk' : mode;
  let previous: LatLng = parking
    ? { lat: parking.spot.lat, lng: parking.spot.lng }
    : origin;
  for (const g of finalOrder) {
    const point = { lat: g.location.lat, lng: g.location.lng };
    stops.push({
      ganpati: g,
      // Same call the budget was spent against, so the per-stop numbers add
      // up to the total the user was shown rather than drifting from it.
      darshanMinutes: dwellMinutes(g, pace, crowdByMandalId[g.id]),
      travelMinutesFromPrevious: Math.round(
        estimateDurationSeconds(haversine(previous, point), legMode) / 60
      ),
      crowd: crowdByMandalId[g.id] ?? null,
    });
    previous = point;
  }

  return {
    stops,
    darshanMinutes: cost.darshan,
    travelMinutes: cost.travel,
    totalMinutes: cost.total,
    budgetMinutes,
    skipped,
    hasUnknownDwell: finalOrder.some((g) => g.darshanMinutes == null),
    crowdAdjusted: finalOrder.some((g) => crowdByMandalId[g.id] != null),
    parking,
  };
}
