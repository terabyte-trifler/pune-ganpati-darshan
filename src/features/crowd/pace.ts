import { haversine, type LatLng } from '@/lib/geo';

/**
 * The passive dwell signal. Shadow mode — nothing it produces is shown.
 *
 * ---------------------------------------------------------------------
 * Why dwell and not speed.
 *
 * The idea was a "pace" signal: read how fast devices are moving, because
 * speed is sample-size independent in a way a headcount is not — three
 * devices crawling tells you something, a count of three tells you
 * nothing.
 *
 * Speed turned out to be the wrong measurement of that idea. GPS in a
 * peth lane between four-storey buildings is noisy enough that derived
 * speed is mostly jitter, and useGeolocation drops fixes inside
 * SIGNIFICANT_MOVE_M (12 m) before they reach React — so a device
 * standing still produces no updates at all, which is precisely the state
 * we most want to detect.
 *
 * Dwell is the same information, measured robustly: how long has this
 * device been inside the mandal's radius. Someone walking past clears it
 * in under a minute. Someone in a queue is there for ten. It needs no
 * speed, tolerates jitter, and the absence of updates while stationary
 * becomes evidence instead of a blind spot.
 *
 * ---------------------------------------------------------------------
 * The constraint that makes this defensible: one mandal, unambiguously.
 *
 * A passive signal has to answer "which mandal", and at this density that
 * is the hard part — the median gap between mandals is 142 m and eight
 * have a neighbour inside 100 m. A human reporting solves it by knowing
 * where they are standing; a GPS fix does not.
 *
 * So the radius is not a global constant. It is derived per mandal from
 * that mandal's own geometry: half the distance to its nearest neighbour,
 * less a margin, capped. Inside it, no other mandal can be nearer. Where
 * that radius falls below PACE_MIN_RADIUS_M the mandal is excluded
 * entirely — you can never be sure, so it never reports.
 *
 * On the current catalogue that admits 25 of 29 mandals, Dagdusheth among
 * them at 65 m. The four excluded are two pairs 30 m and 37 m apart
 * (Kasba/Phani Ali, Bhausaheb Rangari/Balvikas) — which are also the two
 * pairs already flagged as possible duplicate records.
 */

/** What the dwell time suggests the device is doing. */
export type DwellClass =
  /** Through the radius quickly. Walking past, not queueing. */
  | 'passing'
  /** Long enough to be stopped, short of a real queue. */
  | 'lingering'
  /** Long enough that a queue is the plain explanation. */
  | 'queueing';

/** Never wider than this, however isolated the mandal. */
export const PACE_MAX_RADIUS_M = 75;

/**
 * Below this the mandal is excluded.
 *
 * A radius under 25 m cannot be occupied with any confidence by a
 * consumer GPS fix in a built-up lane, so a signal from one would be
 * indistinguishable from noise.
 */
export const PACE_MIN_RADIUS_M = 25;

/**
 * Taken off half the nearest-neighbour distance.
 *
 * Half the gap is the point where the two mandals are equidistant. The
 * margin keeps the boundary off that line, so a fix on the edge is not a
 * coin flip between two mandals.
 */
export const PACE_RADIUS_MARGIN_M = 5;

/** Seconds inside the radius above which this stops being a walk-past. */
export const DWELL_LINGERING_S = 90;
/** Seconds above which a queue is the ordinary explanation. */
export const DWELL_QUEUEING_S = 360;

/**
 * Leaving is only believed after this long outside.
 *
 * A single wild fix — and in these lanes there are many — would otherwise
 * reset a ten-minute dwell to zero and lose the observation. Departure has
 * to persist to count.
 */
export const DWELL_EXIT_GRACE_S = 120;

export interface PaceMandal {
  id: string;
  lat: number;
  lng: number;
}

export interface PaceZone {
  mandalId: string;
  lat: number;
  lng: number;
  /** Derived from geometry; see the note above. */
  radiusM: number;
  /** Distance to the nearest other mandal, kept for the admin view. */
  nearestNeighbourM: number;
}

/**
 * The radius for one mandal, or null if it can never be unambiguous.
 */
export function paceRadiusFor(nearestNeighbourM: number): number | null {
  const r = Math.min(PACE_MAX_RADIUS_M, nearestNeighbourM / 2 - PACE_RADIUS_MARGIN_M);
  return r >= PACE_MIN_RADIUS_M ? r : null;
}

/**
 * Zones for every mandal that can produce an unambiguous signal.
 *
 * O(n²) over 29 mandals, which is nothing, and the result is stable for
 * the life of the catalogue — callers compute it once.
 */
export function paceZones(mandals: PaceMandal[]): PaceZone[] {
  const zones: PaceZone[] = [];
  for (const m of mandals) {
    let nearestNeighbourM = Infinity;
    for (const other of mandals) {
      if (other.id === m.id) continue;
      nearestNeighbourM = Math.min(
        nearestNeighbourM,
        haversine({ lat: m.lat, lng: m.lng }, { lat: other.lat, lng: other.lng })
      );
    }
    const radiusM = paceRadiusFor(nearestNeighbourM);
    if (radiusM === null) continue;
    zones.push({ mandalId: m.id, lat: m.lat, lng: m.lng, radiusM, nearestNeighbourM });
  }
  return zones;
}

/**
 * Which zone, if any, this fix is unambiguously inside.
 *
 * Three tests, all of which must pass:
 *
 *   1. The fix is inside the zone's radius.
 *   2. The accuracy circle FITS inside that radius. A fix 40 m from the
 *      centre of a 65 m zone with 120 m of error is not in the zone; it
 *      is somewhere in a 120 m blur that happens to include it. This is
 *      the test a naive distance check gets wrong, and it is why the
 *      signal is rare rather than constant.
 *   3. Exactly one zone qualifies. Impossible to violate by construction,
 *      and checked anyway — a coordinate correction could move two
 *      mandals together without anyone recomputing the radii, and the
 *      failure mode of that is silently attributing a queue to the wrong
 *      mandal.
 */
export function resolvePaceZone(
  position: LatLng,
  accuracyM: number,
  zones: PaceZone[]
): { zone: PaceZone; distanceM: number } | null {
  const candidates: { zone: PaceZone; distanceM: number }[] = [];
  for (const zone of zones) {
    const distanceM = haversine(position, { lat: zone.lat, lng: zone.lng });
    if (distanceM <= zone.radiusM && accuracyM <= zone.radiusM) {
      candidates.push({ zone, distanceM });
    }
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export function classifyDwell(seconds: number): DwellClass {
  if (seconds >= DWELL_QUEUEING_S) return 'queueing';
  if (seconds >= DWELL_LINGERING_S) return 'lingering';
  return 'passing';
}

/**
 * The dwell tracker, as a pure reducer.
 *
 * Kept as a reducer rather than hidden in a hook's refs so the whole
 * behaviour — entry, the exit grace period, and the decision to emit — is
 * testable without a browser, geolocation or a clock. The hook around it
 * only supplies fixes and time.
 */
export interface DwellState {
  /** The zone currently being dwelt in, or null. */
  mandalId: string | null;
  /** When the device was first seen inside, in ms. */
  enteredAtMs: number | null;
  /** When it was first seen outside, in ms. Null while inside. */
  leftAtMs: number | null;
  /** Dwell seconds at the last emission, so each class is sent once. */
  lastEmittedAtS: number | null;
}

export const initialDwellState: DwellState = {
  mandalId: null,
  enteredAtMs: null,
  leftAtMs: null,
  lastEmittedAtS: null,
};

export interface DwellStep {
  state: DwellState;
  /**
   * Set when this step crossed into a new class and the caller should
   * record it. Null the rest of the time, which is almost always.
   */
  emit: { mandalId: string; dwell: DwellClass; dwellSeconds: number } | null;
}

/**
 * Advance the tracker by one fix.
 *
 * `position` is null when there is no usable fix at all — permission
 * refused, or still acquiring. That is treated as "outside", because a
 * device we cannot locate is a device we cannot attribute.
 *
 * Emission happens on crossing INTO a class, once per class per visit, so
 * one queue produces at most two records (lingering, then queueing) rather
 * than one every thirty seconds. `passing` is never emitted: someone
 * walking past a mandal is not evidence about its queue, and recording it
 * would bury the signal in the majority case.
 */
export function stepDwell(
  prev: DwellState,
  nowMs: number,
  position: LatLng | null,
  accuracyM: number | null,
  zones: PaceZone[]
): DwellStep {
  const hit =
    position && accuracyM !== null
      ? resolvePaceZone(position, accuracyM, zones)
      : null;

  // ---- outside every zone, or unattributable ----
  if (!hit) {
    if (prev.mandalId === null) return { state: prev, emit: null };
    const leftAtMs = prev.leftAtMs ?? nowMs;
    // Only believe a departure once it has persisted: one wild fix must
    // not discard a ten-minute observation.
    if (nowMs - leftAtMs < DWELL_EXIT_GRACE_S * 1000) {
      return { state: { ...prev, leftAtMs }, emit: null };
    }
    return { state: initialDwellState, emit: null };
  }

  // ---- inside a different zone than before ----
  if (prev.mandalId !== hit.zone.mandalId) {
    return {
      state: {
        mandalId: hit.zone.mandalId,
        enteredAtMs: nowMs,
        leftAtMs: null,
        lastEmittedAtS: null,
      },
      emit: null,
    };
  }

  // ---- still inside the same zone ----
  const enteredAtMs = prev.enteredAtMs ?? nowMs;
  const dwellSeconds = Math.max(0, (nowMs - enteredAtMs) / 1000);
  const dwell = classifyDwell(dwellSeconds);
  const state: DwellState = { ...prev, enteredAtMs, leftAtMs: null };

  if (dwell === 'passing') return { state, emit: null };
  const already = prev.lastEmittedAtS === null ? 'passing' : classifyDwell(prev.lastEmittedAtS);
  if (already === dwell) return { state, emit: null };

  return {
    state: { ...state, lastEmittedAtS: dwellSeconds },
    emit: { mandalId: hit.zone.mandalId, dwell, dwellSeconds: Math.round(dwellSeconds) },
  };
}
