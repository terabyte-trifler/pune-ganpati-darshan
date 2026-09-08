import {
  haversine,
  estimateDurationSeconds,
  type LatLng,
  type TravelMode,
} from '@/lib/geo';
import { optimizeLocally } from '@/services/route-optimizer';
import type { Ganpati } from '@/types/ganpati';

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
}

export interface ItineraryStop {
  ganpati: Ganpati;
  darshanMinutes: number;
  travelMinutesFromPrevious: number;
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
}

/**
 * Dwell time for a mandal under a given pace.
 *
 * 'thorough' assumes queuing at every mandal, so it uses the peak estimate
 * where we have one. 'quick' assumes viewing from the road wherever that is
 * possible, which is genuinely how most people do a long trail.
 */
export function dwellMinutes(g: Ganpati, pace: DarshanPace): number {
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
  pace: DarshanPace
): { travel: number; darshan: number; total: number } {
  let travelSeconds = 0;
  let previous = origin;
  for (const g of ordered) {
    const point = { lat: g.location.lat, lng: g.location.lng };
    travelSeconds += estimateDurationSeconds(haversine(previous, point), mode);
    previous = point;
  }

  const travel = Math.round(travelSeconds / 60);
  const darshan = ordered.reduce((sum, g) => sum + dwellMinutes(g, pace), 0);
  return { travel, darshan, total: travel + darshan };
}

/** Orders a set of stops for the shortest walk from the origin. */
function order(mandals: Ganpati[], origin: LatLng, mode: TravelMode): Ganpati[] {
  if (mandals.length < 2) return mandals;
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
  const { budgetMinutes, interests, pace, mode, origin, mandals } = request;

  const candidates = mandals
    .map((g) => ({ g, score: interestScore(g, interests) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.g.prominence - a.g.prominence);

  const chosen: Ganpati[] = [];
  const skipped: Ganpati[] = [];

  for (const { g } of candidates) {
    const trial = order([...chosen, g], origin, mode);
    const cost = costOf(trial, origin, mode, pace);

    if (cost.total <= budgetMinutes) {
      chosen.splice(0, chosen.length, ...trial);
    } else {
      skipped.push(g);
    }
  }

  const finalOrder = order(chosen, origin, mode);
  const cost = costOf(finalOrder, origin, mode, pace);

  // Per-stop breakdown, so the UI can show where the time goes.
  const stops: ItineraryStop[] = [];
  let previous = origin;
  for (const g of finalOrder) {
    const point = { lat: g.location.lat, lng: g.location.lng };
    stops.push({
      ganpati: g,
      darshanMinutes: dwellMinutes(g, pace),
      travelMinutesFromPrevious: Math.round(
        estimateDurationSeconds(haversine(previous, point), mode) / 60
      ),
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
  };
}
