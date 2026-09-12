/**
 * Turning dwell samples into something a visitor can read.
 *
 * ---------------------------------------------------------------------
 * This is a THIRD lane, and it must not become the first two.
 *
 * Lane A is what people reported. Lane B is what the clock expects. This
 * is neither: it is what devices near the mandal were observed doing.
 * The rules that keep it honest:
 *
 *   - It contributes NO mass. It cannot change the colour, the label, the
 *     confidence, or the trend. `crowd-aggregation.ts` does not import
 *     this file and must never import it.
 *   - It is never phrased as a count. The samples come only from people
 *     with the map open, so any number is a fraction of a fraction and
 *     reads as a headcount to anyone who sees it. What is reported is a
 *     PROPORTION, which is the one thing here that does not scale with
 *     how popular the app is.
 *   - It never claims to know why anyone stopped. Someone admiring the
 *     dekhava for ten minutes is indistinguishable from someone in a
 *     queue for ten minutes, so the wording says what was observed —
 *     people stopping — and lets the reader draw the inference.
 *
 * It also has its own kill switch, separate from collection: if it reads
 * wrong during the festival it can be switched off in one environment
 * variable without stopping the calibration data being gathered.
 */

/** Samples older than this cannot say anything about now. Matches Lane A. */
export const DWELL_WINDOW_MINUTES = 90;

/**
 * Fewer than this and there is no proportion worth quoting.
 *
 * Three is low, and deliberately: unlike a crowd report, a dwell sample
 * is not a claim anybody made, so a wrong one costs a reader nothing but
 * a slightly wrong adjective. The protection that matters is that this
 * never moves the colour.
 */
export const MIN_DWELL_SAMPLES = 3;

/** Above this share of `queueing`, most people here are stopping. */
export const STOPPING_SHARE = 0.5;

export interface DwellSample {
  dwell: 'lingering' | 'queueing';
  createdAt: string;
}

export interface DwellSummary {
  /** How many samples are behind this. Never shown to a visitor. */
  samples: number;
  /** Share of samples that reached `queueing`, 0–1. */
  queueingShare: number;
  /** The sentence to render, already hedged. */
  detail: string;
  /** Whether most devices were stopping rather than passing through. */
  stopping: boolean;
}

/**
 * Summarise one mandal's samples, or null if there are too few.
 *
 * Pure, with an injected clock, like everything else in this feature that
 * decides what a visitor sees.
 */
export function summariseDwell(
  samples: DwellSample[],
  nowMs: number = Date.now()
): DwellSummary | null {
  const fresh = samples.filter((s) => {
    const age = (nowMs - Date.parse(s.createdAt)) / 60_000;
    return Number.isFinite(age) && age >= 0 && age <= DWELL_WINDOW_MINUTES;
  });

  if (fresh.length < MIN_DWELL_SAMPLES) return null;

  const queueing = fresh.filter((s) => s.dwell === 'queueing').length;
  const queueingShare = queueing / fresh.length;
  const stopping = queueingShare >= STOPPING_SHARE;

  return {
    samples: fresh.length,
    queueingShare,
    stopping,
    // No number, and no claim about why. "Phones" rather than "people"
    // would be more literally accurate but reads as surveillance; "most
    // visitors" is honest about the proportion and vague about the base,
    // which is the right way round — the base is the part we genuinely
    // do not know.
    detail: stopping
      ? 'Most visitors near this mandal are stopping rather than walking past. ' +
        'That usually means a queue, though it can also just be people looking.'
      : 'Most visitors near this mandal are moving through rather than stopping.',
  };
}
