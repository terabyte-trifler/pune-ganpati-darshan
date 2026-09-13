import { crowdExpectation, type PriorInput } from '@/services/crowd/crowd-prior';
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
  | 'obs-moving' | 'obs-long'
  | 'est-short' | 'est-moving' | 'est-long';

/**
 * Three tiers, and the whole app orders on them.
 *
 * reported  — somebody said something. The only tier worded as a report.
 * observed  — nobody said anything, but enough independent devices were
 *             seen dwelling to say something anyway. Half-filled.
 * estimated — nobody said anything and nothing was seen; the clock model
 *             speaks. Hollow.
 */
export type CrowdSource = 'reported' | 'observed' | 'estimated';

/** Reports first, then observations, then the model. Lower sorts first. */
export const SOURCE_RANK: Record<CrowdSource, number> = {
  reported: 0,
  observed: 1,
  estimated: 2,
};

export interface CrowdDisplay {
  level: CrowdLevel;
  /** Badge and row wording. Names its own tier: "Observed", "Estimated". */
  label: string;
  source: CrowdSource;
  /** True only for the clock model. Kept because it reads better at use. */
  estimated: boolean;
  /** The modelled wait in minutes. Null for a measured reading. */
  estimatedWaitMinutes: number | null;
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
    return {
      level: status.status,
      label: status.label,
      source: observed ? 'observed' : 'reported',
      estimated: false,
      estimatedWaitMinutes: null,
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
