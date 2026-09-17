import {
  crowdExpectation, waitForLevel, waitBounds, type PriorInput,
} from '@/services/crowd/crowd-prior';
import type { FestivalPhase } from '@/lib/festival';
import type { CrowdLevel, CrowdStatus } from '@/types/crowd';

/**
 * What colour a mandal shows, and whether anybody reported it.
 *
 * ---------------------------------------------------------------------
 * The grey problem, and the owner's call on it.
 *
 * Lane B — the "usually" prior — used to live on one surface only: the
 * mandal's own panel. Everywhere else, a mandal nobody had reported was
 * grey, and grey is most mandals most of the time. Somebody opening the
 * map at 9pm saw three coloured pins in a field of stone and learned
 * nothing about the other twenty-six, even though the clock, the day of
 * the festival and the mandal's own curated wait times say something
 * useful about every one of them.
 *
 * So the prior now paints the grey ones too — as the LAST resort, never
 * over a reading, and never in the same clothes:
 *
 *   - A report always wins. This is consulted only where `status` is
 *     null, exactly as before.
 *   - It still carries no mass. It cannot tip, strengthen or outvote a
 *     measurement; `crowd-aggregation` does not import the prior and this
 *     module is downstream of both.
 *   - It is always labelled. "Estimated short", not "Short" — and a
 *     hollow pin, not a filled one. A visitor must be able to tell in one
 *     glance which of the two they are looking at, without reading the
 *     word.
 *
 * Grey survives as a real state: before and after the festival, and on
 * visarjan afternoon, the prior declines to speak and a mandal with no
 * reports is grey again. That is the honest answer at those times.
 * ---------------------------------------------------------------------
 */

/**
 * The suffix that selects a pin image, on every map in the app.
 *
 * `none` is still grey. The `est-` variants draw the same colour hollow.
 */
export type CrowdPinKey =
  | 'none'
  | CrowdLevel
  | 'obs-short' | 'obs-moving' | 'obs-long'
  | 'est-short' | 'est-moving' | 'est-long';

/**
 * Three tiers, and the whole app orders on them.
 *
 * override  — an admin asserted it. Outranks everything, drawn filled.
 * reported  — somebody said something. The only tier worded as a report.
 * observed  — nobody said anything, but enough independent devices were
 *             seen dwelling to say something anyway. Half-filled.
 * estimated — nobody said anything and nothing was seen; the clock model
 *             speaks. Hollow.
 */
export type CrowdSource = 'override' | 'reported' | 'observed' | 'estimated';

/**
 * Lower sorts first.
 *
 * `override` above `reported` because it is a person with the app's own
 * account asserting a value, and for its half-hour it is the answer —
 * there is nothing for a report to add to it. It draws exactly like a
 * report; only the wording differs, because nobody reported it.
 */
export const SOURCE_RANK: Record<CrowdSource, number> = {
  override: 0,
  reported: 1,
  observed: 2,
  estimated: 3,
};

export interface CrowdDisplay {
  level: CrowdLevel;
  /** Badge and row wording. Names its own tier: "Observed", "Estimated". */
  label: string;
  source: CrowdSource;
  /** True only for the clock model. Kept because it reads better at use. */
  estimated: boolean;
  /** How long the queue is, in minutes. Null when nothing can say. */
  estimatedWaitMinutes: number | null;
  /**
   * Where that figure came from, so the UI never implies a measurement.
   *
   * 'reported' is the median of what people standing there actually
   * waited. 'modelled' is this mandal's own darshan bounds read against
   * the level — a figure, not a measurement. Null when there is no wait.
   */
  waitSource: 'reported' | 'observed' | 'modelled' | 'override' | null;
  /** Newest report, ISO. Null for an estimate — there is no report. */
  lastUpdated: string | null;
  pinKey: CrowdPinKey;
}

/**
 * Deliberately the same three words the reports use, prefixed.
 *
 * Not a separate vocabulary: "Estimated short" and "Short" mean the same
 * thing about the queue and differ only in where the claim came from, so
 * inventing a second set of words would imply a difference that is not
 * there. The prefix carries the whole of the difference, and it is
 * spelled out rather than abbreviated — the label is the only place the
 * provenance is stated in words, so it should not need decoding.
 */
export const ESTIMATED_LABEL: Record<CrowdLevel, string> = {
  short: 'Estimated short',
  moving: 'Estimated moving',
  long: 'Estimated heavy',
};

/**
 * One mandal's display state, or null when there is nothing to show.
 *
 * `at` is the reader's clock and may be null before hydration, which is
 * also what keeps an estimate out of the server render: the prior is a
 * function of the time on the device, and rendering it during SSR would
 * be both a hydration mismatch and a claim made with the build's clock.
 */
/**
 * How long the queue is, and where that figure came from.
 *
 * Exported because more than one surface needs it: the badge model below
 * builds a CrowdDisplay, and the detail panel works from a raw status.
 * Both must answer the same way, so the precedence lives here once rather
 * than being written out twice and drifting.
 *
 * Best source first. The median of what people standing there actually
 * waited is a measurement and beats everything. Failing that, this
 * mandal's own darshan bounds read against the level people report — a
 * figure, not a measurement, and marked so the wording can hedge it.
 */
export function queueTimeFor(
  status: {
    status: CrowdLevel | null;
    waitMedianMinutes: number | null;
    observedWaitMinutes?: number | null;
    /** Set when this reading came from an admin override. */
    source?: string;
  } | null,
  prior: PriorInput | null | undefined
): { minutes: number; source: 'reported' | 'observed' | 'modelled' | 'override' } | null {
  if (!status?.status) return null;
  if (status.waitMedianMinutes != null && status.waitMedianMinutes > 0) {
    /**
     * An override carries its minutes in the same field, and must not be
     * described as a visitor report.
     *
     * applyOverride writes the asserted minutes into waitMedianMinutes
     * because that is the field the whole precedence chain already reads.
     * What it must not inherit is the wording: "the middle of what people
     * here have said they waited" is false of a number one named person
     * asserted, and this app does not misattribute a reading.
     */
    const source = status.source === 'override' ? 'override' : 'reported';
    return { minutes: status.waitMedianMinutes, source };
  }

  const modelled = prior ? waitForLevel(prior, status.status) : null;
  const observed = status.observedWaitMinutes ?? null;

  /**
   * The devices raise the model's figure; they never lower it.
   *
   * observedWaitMinutes is a lower bound rather than an estimate — the
   * sample misses anyone who closed the tab mid-queue and includes
   * everyone standing outside looking at the dekhava, so it under-reads,
   * structurally and always. Dagdusheth measures eight minutes against a
   * curated peak of a hundred and fifty.
   *
   * A lower bound is still worth something: if devices stood here for
   * thirty-three minutes, the queue was at least thirty-three minutes,
   * whatever the table says. So it wins only where it is HIGHER, and
   * where it wins it is labelled as measured rather than modelled.
   */
  /**
   * Capped at this mandal's own peak, because two devices is the floor.
   *
   * The device floor is two — see MIN_DEVICES_FOR_OBSERVED_WAIT, which
   * explains why the data forces it that low. Two phones are enough to
   * establish that a queue was longer than the model thinks; they are not
   * enough to claim it was longer than this mandal has ever been known to
   * run. Jilbya Maruti measures fourteen minutes against a curated peak of
   * twelve, and the honest reading of that is "at least its peak", not
   * "a new record set by two phones".
   *
   * Rows above the cap are still in the table, which is where a peak that
   * is genuinely too low should be re-curated from — by a person.
   */
  const ceiling = prior ? waitBounds(prior).peak : null;
  const floor = ceiling != null ? Math.min(observed ?? 0, ceiling) : observed;

  if (floor != null && floor > 0 && (!modelled || floor > modelled.minutes)) {
    return { minutes: floor, source: 'observed' };
  }
  return modelled ? { minutes: modelled.minutes, source: 'modelled' } : null;
}

export function crowdDisplayFor(
  status: CrowdStatus | null | undefined,
  prior: PriorInput | null | undefined,
  phase: FestivalPhase | null | undefined,
  at: Date | null
): CrowdDisplay | null {
  if (status?.status) {
    // `source` distinguishes a reading people gave from one the dwell
    // devices produced on their own. Both are measurements of something
    // real, so both outrank the model — but only one may say "reported".
    const observed = status.source === 'observed';
    /**
     * A reported level still gets a wait, read off this mandal's own scale.
     *
     * It used to be null here, so the moment anybody reported a queue the
     * app stopped saying how long it was — the number vanished exactly
     * when the information behind it got better. The level comes from the
     * reports; the minutes come from waitForLevel, which reads that level
     * against this mandal's own bounds rather than a figure applied to
     * every mandal alike.
     */
    /**
     * How long the queue is, best source first.
     *
     * The median of what people actually waited, where anybody has said —
     * that is a measurement and outranks everything. Otherwise this
     * mandal's own darshan bounds read against the reported level, which
     * is a figure rather than a measurement and is labelled as one.
     *
     * Before this, both were thrown away: estimatedWaitMinutes was null
     * whenever a report existed, so the app stopped saying how long the
     * queue was at exactly the moment it knew most about it.
     */
    const wait = queueTimeFor(status, prior);
    return {
      level: status.status,
      label: status.label,
      source: status.source === 'override' ? 'override' : observed ? 'observed' : 'reported',
      estimated: false,
      estimatedWaitMinutes: wait?.minutes ?? null,
      waitSource: wait?.source ?? null,
      lastUpdated: status.lastUpdated,
      pinKey: observed
        ? (`obs-${status.status}` as CrowdPinKey)
        : status.status,
    };
  }

  if (!prior || !phase || !at) return null;

  const expectation = crowdExpectation(prior, phase, at);
  if (!expectation) return null;

  return {
    level: expectation.level,
    label: ESTIMATED_LABEL[expectation.level],
    source: 'estimated',
    estimated: true,
    estimatedWaitMinutes: expectation.waitMinutes,
    waitSource: 'modelled',
    lastUpdated: null,
    pinKey: `est-${expectation.level}` as CrowdPinKey,
  };
}

/** The three fields the prior reads, pulled off a catalogue entry. */
export function priorInputOf(g: {
  darshanMinutes: number | null;
  peakDarshanMinutes: number | null;
  prominence: number;
}): PriorInput {
  return {
    darshanMinutes: g.darshanMinutes,
    peakDarshanMinutes: g.peakDarshanMinutes,
    prominence: g.prominence,
  };
}
