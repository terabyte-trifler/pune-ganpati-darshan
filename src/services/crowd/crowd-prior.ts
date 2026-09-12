import type { CrowdLevel } from '@/types/crowd';
import type { FestivalPhase } from '@/lib/festival';

/**
 * What the queue is USUALLY like, when nobody has reported.
 *
 * ---------------------------------------------------------------------
 * Lane B. This is not a measurement and must never be shown as one.
 *
 * `crowd-aggregation.ts` is Lane A: evidence from people who were there.
 * This file is Lane B: an expectation derived from the clock, the
 * festival calendar and the mandal's own curated wait times. The two are
 * kept apart deliberately and combined nowhere:
 *
 *   - Lane B contributes NO mass. It cannot outvote, tip or strengthen a
 *     reading. A guess that can move a measurement is a measurement you
 *     can no longer trust.
 *   - Lane B is consulted ONLY when Lane A has nothing to say. See
 *     crowd-service, which attaches an expectation only where
 *     `status === null`.
 *   - Its wording never borrows Lane A's. Lane A says "Devotees report a
 *     heavy crowd"; Lane B says "Usually heavy around now". A reader must
 *     be able to tell which they are looking at without being told.
 *
 * The reason this exists at all: a status needs two devices agreeing
 * inside ninety minutes, and for most mandals most of the time that does
 * not happen, so the app said "No recent reports" — which is true and
 * useless. It is 9pm on the busiest Thursday of Ganeshotsav outside a
 * mandal whose curated peak wait is 150 minutes; we know something.
 *
 * ---------------------------------------------------------------------
 * Why it is worth more than it looks: the network.
 *
 * Every input here is either static catalogue data or the current time.
 * Nothing is fetched. During peak hours the peths have effectively no
 * working mobile data — lakhs of people on the same cells — so a live
 * status is a request that will not complete. This computes on the
 * device, offline, which makes it the only crowd information available
 * at exactly the moment someone is standing in a lane deciding where to
 * go next.
 */

/** What the wait figures for a mandal were derived from. */
export type PriorBasis =
  /** The mandal has curated darshan and peak wait times. 18 of 29. */
  | 'curated'
  /** Estimated from comparable mandals by prominence. See PEAK_FALLBACK. */
  | 'estimated';

export interface CrowdExpectation {
  level: CrowdLevel;
  /** Badge wording. Always "usually", never a report. */
  label: string;
  /** A sentence for the panel. Says why, and says it is not a report. */
  detail: string;
  /** The modelled wait, in minutes. Exposed for the admin view. */
  waitMinutes: number;
  basis: PriorBasis;
  /** Every intermediate value, so the model can be inspected rather than trusted. */
  workings: PriorWorkings;
}

/**
 * The full derivation, kept rather than discarded.
 *
 * Lane A can be argued with by looking at the reports. Lane B has no
 * reports to look at, so the only way to hold it to account is to show
 * the arithmetic. The admin view renders this line by line; nothing here
 * is used by the public UI.
 */
export interface PriorWorkings {
  /** IST hour, 0–23, with minutes as a fraction. */
  istHour: number;
  hourFactor: number;
  festivalDay: number;
  totalDays: number;
  isVisarjan: boolean;
  /** Day of week in IST, 0 = Sunday. */
  istDayOfWeek: number;
  phaseFactor: number;
  weekendBonus: number;
  dayFactor: number;
  /** hourFactor × dayFactor. */
  load: number;
  quietMinutes: number;
  peakMinutes: number;
  normalMinutes: number;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Load through the day, as anchors on the hour, interpolated between.
 *
 * Pune's festival evening, not a generic day. The shape that matters:
 * a real morning bump from local devotees at aarti, a genuine afternoon
 * trough, a steep climb from 18:00, the peak at 21:00, and the 02:00–05:00
 * window that is close to empty — which is why the curated routes already
 * include a late-night walk for short queues.
 *
 * These are judgements, not measurements. They are the part of this file
 * most likely to be wrong, and the part real reports will correct first:
 * once wait-time reporting exists, this curve should be fitted to it
 * rather than hand-set.
 */
const HOUR_LOAD: number[] = [
  0.38, 0.22, 0.10, 0.05, 0.05, 0.14, // 00–05
  0.24, 0.32, 0.36, 0.40, 0.40, 0.34, // 06–11
  0.28, 0.25, 0.24, 0.26, 0.36, 0.46, // 12–17
  0.62, 0.82, 0.96, 1.00, 0.92, 0.62, // 18–23
];

/**
 * Visarjan day stops behaving like a festival evening.
 *
 * On Anant Chaturdashi the mandals do a final aarti and then the idols
 * leave for the procession — Kasba first, the rest behind it. So the
 * morning is heavy with final darshan, and by the evening the question
 * "how long is the queue at this mandap" may not even have an answer,
 * because the mandap is empty and the idol is on Laxmi Road.
 *
 * We do not know each mandal's departure time, and inventing one would be
 * exactly the kind of guess this file exists to avoid. So after this hour
 * on visarjan day the prior declines to speak and the app falls back to
 * "No recent reports" — which is the truth: on that afternoon, a live
 * report from someone standing there is the only thing worth having.
 */
const VISARJAN_SILENT_AFTER_IST = 13;

/** Quietest modelled wait, as a fraction of the mandal's normal wait. */
export const QUIET_FRACTION = 0.25;

/** Wait in minutes at or above which the app already says "30+ min". */
export const LONG_THRESHOLD_MIN = 30;
/** Below this it is a walk-in, not a queue. */
export const SHORT_THRESHOLD_MIN = 10;

/**
 * Peak wait for a mandal with no curated figure, in minutes.
 *
 * 11 of 29 mandals have neither `darshanMinutes` nor
 * `peakDarshanMinutes`. Two approaches were tried against the 18 that do:
 *
 *   - A power-law fit on prominence. R² of 0.58, and it put Dagdusheth at
 *     49 minutes against an actual 150 while collapsing the
 *     prominence-120 mandals to a 2-minute peak. Discarded.
 *   - Nearest-neighbour median on prominence, k=5. Leave-one-out median
 *     error of 7.5 minutes, and exact (12) for all four mandals in the
 *     360–420 band — which is the band every one of the 11 sits in or
 *     below. Poor for the giants, but the giants all have curated figures
 *     and never reach this path.
 *
 * The second collapses to a single value across all 11, because the known
 * data has nothing between prominence 120 and 360 and the neighbours are
 * uniformly 12. Rather than pretend to a precision the data does not
 * support, it is written here as the constant it actually is.
 *
 * 12 minutes means an estimated mandal can reach `moving` and can never
 * reach `long`. That is the intended conservatism: we do not know these
 * queues, so the model does not get to call them heavy.
 */
const PEAK_FALLBACK_MIN = 12;

/**
 * Normal wait as a fraction of peak, for mandals missing the normal
 * figure. On the 18 known mandals this ratio runs 0.30–0.50 with a median
 * of 0.40, which is tight enough to use directly.
 */
const NORMAL_FROM_PEAK = 0.4;

/** The fields of a mandal this model reads. Nothing else is needed. */
export interface PriorInput {
  darshanMinutes: number | null;
  peakDarshanMinutes: number | null;
  prominence: number;
}

/** IST hour as a fraction, e.g. 21.5 for 21:30. */
export function istHourOf(at: Date): number {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

/** Day of week in IST, 0 = Sunday. */
export function istDayOfWeek(at: Date): number {
  return new Date(at.getTime() + IST_OFFSET_MS).getUTCDay();
}

/**
 * Load factor for a time of day, interpolated between hourly anchors.
 *
 * Interpolated rather than stepped for the same reason freshness decay is
 * exponential rather than bucketed: a status that changes because a clock
 * ticked past the hour, with no new information, reads as an unreliable
 * app.
 */
export function hourFactor(istHour: number): number {
  const h = ((istHour % 24) + 24) % 24;
  const i = Math.floor(h);
  const frac = h - i;
  const a = HOUR_LOAD[i];
  const b = HOUR_LOAD[(i + 1) % 24];
  return a + (b - a) * frac;
}

/**
 * How busy the festival itself is on this day, ignoring the clock.
 *
 * Day 1 is installation: the mandaps are still being finished in the
 * morning and the crowd is an evening crowd. The middle builds. The last
 * days before Anant Chaturdashi are the heaviest of the festival for
 * mandal-viewing, which is why the ramp ends high rather than in the
 * middle.
 *
 * Visarjan day is given its own value rather than the top of the ramp:
 * the morning is heavy, and then the mandals leave. Modelling it as the
 * busiest evening of the festival would be wrong in the second half of
 * the day, which is exactly when someone would be reading it.
 */
export function phaseFactor(
  day: number,
  totalDays: number,
  isVisarjan: boolean
): number {
  if (isVisarjan) return 0.85;
  if (day <= 1) return 0.7;

  // Days 2 … totalDays-1 ramp from 0.55 to 0.92.
  const span = Math.max(1, totalDays - 2);
  const progress = Math.min(1, Math.max(0, (day - 2) / span));
  return 0.55 + progress * 0.37;
}

/**
 * Added, not multiplied.
 *
 * Multiplying two sub-1 factors would make a busy Saturday read as
 * quieter than a mid-week day, which is backwards. A weekend does not
 * scale the festival down; it adds to it.
 */
export function weekendBonus(dayOfWeek: number): number {
  if (dayOfWeek === 6 || dayOfWeek === 0) return 0.12; // Sat, Sun
  if (dayOfWeek === 5) return 0.06; // Fri
  return 0;
}

/** The mandal's wait bounds, and where they came from. */
export function waitBounds(m: PriorInput): {
  peak: number;
  normal: number;
  basis: PriorBasis;
} {
  if (m.peakDarshanMinutes && m.darshanMinutes) {
    return {
      peak: m.peakDarshanMinutes,
      normal: m.darshanMinutes,
      basis: 'curated',
    };
  }
  const peak = m.peakDarshanMinutes ?? PEAK_FALLBACK_MIN;
  return {
    peak,
    normal: m.darshanMinutes ?? Math.round(peak * NORMAL_FROM_PEAK),
    basis: 'estimated',
  };
}

export function levelForWait(minutes: number): CrowdLevel {
  if (minutes >= LONG_THRESHOLD_MIN) return 'long';
  if (minutes >= SHORT_THRESHOLD_MIN) return 'moving';
  return 'short';
}

const LABEL: Record<CrowdLevel, string> = {
  short: 'Usually short',
  moving: 'Usually moving',
  long: 'Usually heavy',
};

/** Rounded to the nearest five, because the model is not precise to one. */
function roundWait(minutes: number): number {
  return Math.max(1, Math.round(minutes / 5) * 5);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function partOfDay(istHour: number): string {
  if (istHour < 5) return 'at this hour';
  if (istHour < 12) return 'in the morning';
  if (istHour < 16) return 'in the afternoon';
  if (istHour < 19) return 'in the early evening';
  if (istHour < 23) return 'in the evening';
  return 'late at night';
}

/**
 * The expectation for one mandal at one moment, or null.
 *
 * Null outside the festival: there is no basis for a Ganeshotsav crowd
 * curve in March, and inventing one would be the exact failure this
 * whole file is written to avoid.
 */
export function crowdExpectation(
  mandal: PriorInput,
  phase: FestivalPhase,
  at: Date = new Date()
): CrowdExpectation | null {
  if (phase.phase !== 'during') return null;

  const istHour = istHourOf(at);
  if (phase.isVisarjan && istHour >= VISARJAN_SILENT_AFTER_IST) return null;

  const dow = istDayOfWeek(at);
  const hf = hourFactor(istHour);
  const pf = phaseFactor(phase.day, phase.totalDays, phase.isVisarjan);
  const wb = weekendBonus(dow);
  const dayFactor = Math.min(1, pf + wb);
  const load = hf * dayFactor;

  const { peak, normal, basis } = waitBounds(mandal);
  const quiet = normal * QUIET_FRACTION;
  const waitMinutes = quiet + load * (peak - quiet);
  const rounded = roundWait(waitMinutes);
  // Classified on the ROUNDED figure, because that is the number a visitor
  // reads. Classifying on the raw 29.1 while printing "around 30 minutes"
  // put a yellow "Usually moving" beside a wait the app itself calls red.
  const level = levelForWait(rounded);

  const hedge = basis === 'estimated' ? ' This mandal has no confirmed wait times, so this is a rough guide only.' : '';

  return {
    level,
    label: LABEL[level],
    // Deliberately does NOT open with "nobody has reported". Whether
    // anybody has reported is the panel's fact to state, not this
    // model's — and it was stating it wrongly: an expectation shows
    // alongside a single unconfirmed report too, where "nobody has
    // reported" is simply false.
    detail:
      `${capitalise(partOfDay(istHour))} on day ${phase.day} of the festival ` +
      `the wait here is usually around ${rounded} minutes. That is an ` +
      `expectation from the time and the mandal's usual queue — not a ` +
      `report from anyone there.${hedge}`,
    waitMinutes: rounded,
    basis,
    workings: {
      istHour,
      hourFactor: hf,
      festivalDay: phase.day,
      totalDays: phase.totalDays,
      isVisarjan: phase.isVisarjan,
      istDayOfWeek: dow,
      phaseFactor: pf,
      weekendBonus: wb,
      dayFactor,
      load,
      quietMinutes: quiet,
      peakMinutes: peak,
      normalMinutes: normal,
    },
  };
}
