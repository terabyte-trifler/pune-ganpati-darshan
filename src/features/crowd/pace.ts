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
 * less a margin, capped. Inside it, no other mandal can be nearer.
 *
 * ---------------------------------------------------------------------
 * When two mandals are too close for ANY radius: the bigger one takes it.
 *
 * Two pairs sit closer than twice the minimum radius — Kasba and Phani
 * Ali at 30 m, Bhausaheb Rangari and Balvikas at 37 m. There is no circle
 * around either member that excludes the other, so the first version of
 * this excluded all four. That threw away Kasba, which is the gramdaivat
 * and the first of the Manache Paach, to protect a record it is 30 m from.
 *
 * The better answer uses the asymmetry that is already in the data. Kasba
 * carries prominence 980 against Phani Ali's 300; Bhausaheb 720 against
 * Balvikas's 120. A device dwelling in that overlap is far more likely at
 * the prominent one, by roughly that ratio — so where the gap exceeds
 * PACE_DOMINANCE_RATIO the dominant mandal ABSORBS its neighbour: it gets
 * a zone, the neighbour gets none, and the zone records what it absorbed.
 *
 * The radius is then computed against the nearest mandal that still has a
 * zone, which is why Kasba's is 75 m rather than 10 m — its nearest
 * surviving neighbour is Bhausaheb, 255 m away. The no-overlap guarantee
 * between zones is untouched.
 *
 * What this costs, stated plainly: dwell recorded for Kasba includes
 * people who were actually at Phani Ali, 30 m away, and the same for
 * Balvikas inside Bhausaheb. That contamination is bounded by the
 * prominence ratio, it is named in `absorbs` on the zone, and any
 * comparison against human reports has to read Kasba's dwell as
 * "Kasba and Phani Ali together". It is not a hidden error; it is a
 * declared one.
 *
 * On the current catalogue this admits 27 of 29 mandals with nothing
 * excluded, Dagdusheth at 65 m and Kasba at 75 m.
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
 * How much more prominent a mandal must be to absorb a too-close
 * neighbour rather than both being excluded.
 *
 * 2.5 is deliberately well clear of the two real cases (3.3x and 6.0x),
 * so this never fires on a pair of peers. Two equally prominent mandals
 * 30 m apart would still both be excluded, which is right: there the
 * overlap genuinely is a coin flip and there is no bigger one to give it
 * to.
 */
export const PACE_DOMINANCE_RATIO = 2.5;

/**
 * Below this separation no valid radius exists for either mandal, so one
 * of them must absorb the other or both must go. It is twice the smallest
 * usable radius plus the margin, by definition.
 */
export const PACE_BLOCK_DISTANCE_M = 2 * (PACE_MIN_RADIUS_M + 5);

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
  /** Used only to settle which of two too-close mandals takes the zone. */
  prominence: number;
}

export interface PaceZone {
  mandalId: string;
  lat: number;
  lng: number;
  /** Derived from geometry; see the note above. */
  radiusM: number;
  /** Distance to the nearest other mandal WITH A ZONE. */
  nearestNeighbourM: number;
  /**
   * Ids of mandals too close to distinguish, whose visitors will be
   * counted here. Empty for almost every zone. Never ignore it when
   * comparing dwell against human reports.
   */
  absorbs: string[];
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
  const between = (a: PaceMandal, b: PaceMandal) =>
    haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });

  // Pass one: who is absorbed. A mandal surrenders its zone when some
  // neighbour is too close for any radius to separate them AND is
  // decisively more prominent. Computed before any radius, because a
  // surrendered mandal must not influence anyone else's geometry.
  const absorbedBy = new Map<string, string>();
  for (const m of mandals) {
    for (const other of mandals) {
      if (other.id === m.id) continue;
      if (between(m, other) >= PACE_BLOCK_DISTANCE_M) continue;
      if (other.prominence >= PACE_DOMINANCE_RATIO * m.prominence) {
        absorbedBy.set(m.id, other.id);
        break;
      }
    }
  }

  const live = mandals.filter((m) => !absorbedBy.has(m.id));

  // Pass two: radii, measured only against mandals that still have a
  // zone. This is what lets Kasba have 75 m instead of 10 m.
  const zones: PaceZone[] = [];
  for (const m of live) {
    let nearestNeighbourM = Infinity;
    for (const other of live) {
      if (other.id === m.id) continue;
      nearestNeighbourM = Math.min(nearestNeighbourM, between(m, other));
    }
    const radiusM = paceRadiusFor(nearestNeighbourM);
    if (radiusM === null) continue;

    zones.push({
      mandalId: m.id,
      lat: m.lat,
      lng: m.lng,
      radiusM,
      nearestNeighbourM,
      absorbs: [...absorbedBy.entries()]
        .filter(([, dominant]) => dominant === m.id)
        .map(([absorbed]) => absorbed),
    });
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
  emit: {
    mandalId: string;
    dwell: DwellClass;
    dwellSeconds: number;
    /**
     * True for the one sample written when the device is confirmed to
     * have left, which carries the whole visit's duration.
     *
     * False for a threshold marker, whose duration is the threshold
     * rather than an observation — the clock is quantised to 30s and
     * both thresholds are multiples of 30, so those rows always read
     * exactly 90 or 360. Only `isFinal` rows are usable for a
     * distribution; see the migration.
     */
    isFinal: boolean;
  } | null;
}

/**
 * Advance the tracker by one fix.
 *
 * `position` is null when there is no usable fix at all — permission
 * refused, or still acquiring. That is treated as "outside", because a
 * device we cannot locate is a device we cannot attribute.
 *
 * Two kinds of sample come out of this.
 *
 * THRESHOLD MARKERS (isFinal false) fire on crossing into a class, once
 * per class per visit, so one queue produces at most two rather than one
 * every thirty seconds. Their duration is the threshold, not a
 * measurement — the clock is quantised to 30s and both thresholds are
 * multiples of 30, so they always read exactly 90 or 360.
 *
 * A FINAL SAMPLE (isFinal true) fires once, when departure is confirmed,
 * and carries the whole visit's duration measured to the last fix seen
 * inside. This is the only row with a usable magnitude, and magnitude is
 * the part of the signal that does not scale with how many users the app
 * has.
 *
 * Both are kept because a visit only produces a final sample if the page
 * is still open when the device leaves — and the longest queues are
 * exactly where someone gives up and closes the tab. Dropping the markers
 * would bias the data against the heaviest crowds.
 *
 * `passing` is never emitted in either form: walking past a mandal is not
 * evidence about its queue, and it is the overwhelming majority case.
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

    // Departure confirmed. This is the one sample that carries a real
    // duration: measured to when the device was LAST SEEN INSIDE, not to
    // now, so the grace period is not counted as time in the queue.
    const total =
      prev.enteredAtMs === null ? 0 : Math.max(0, (leftAtMs - prev.enteredAtMs) / 1000);
    const dwell = classifyDwell(total);

    // A walk-past is still not worth recording, however it ended.
    if (dwell === 'passing') return { state: initialDwellState, emit: null };

    return {
      state: initialDwellState,
      emit: {
        mandalId: prev.mandalId,
        dwell,
        dwellSeconds: Math.round(total),
        isFinal: true,
      },
    };
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
    emit: {
      mandalId: hit.zone.mandalId,
      dwell,
      dwellSeconds: Math.round(dwellSeconds),
      isFinal: false,
    },
  };
}
