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
 * Fewer DEVICES than this and there is no proportion worth quoting.
 *
 * Devices, not rows, and that correction matters more than the number.
 * One visit emits up to three rows — a lingering marker, a queueing
 * marker and a final sample — which is exactly this threshold. So while
 * this counted rows, one person standing at Tulshibaug for eleven minutes
 * produced the sentence "most visitors near this mandal are stopping",
 * which is the one claim it is not allowed to make. The shadow table had
 * no way to tell one phone from three; the device key does.
 *
 * Two, and it does NOT follow the colour bar all the way down.
 *
 * I had the rule backwards once and the tests caught it. Tying this to
 * the colour bar seemed right when the bar was three and this was three
 * — the map's stronger claim should not rest on less evidence than prose.
 * But the two claims are different in kind, not just in strength.
 *
 * A colour says "this mandal looks busy", which one device can support:
 * a phone stood there for eleven minutes and that is what it saw. The
 * sentence says "MOST VISITORS near this mandal are stopping", which is a
 * proportion — and a proportion of one is not a proportion. So when the
 * colour bar dropped to one for festival night, this stayed at two.
 *
 * Low, deliberately: unlike a crowd report, a dwell sample is not a claim
 * anybody made, so a wrong one costs a reader nothing but a slightly
 * wrong adjective.
 */
export const MIN_DWELL_SAMPLES = 2;

/** Above this share of `queueing`, most people here are stopping. */
export const STOPPING_SHARE = 0.5;

export interface DwellSample {
  dwell: 'lingering' | 'queueing';
  createdAt: string;
  /**
   * Per (device, mandal, IST day) digest — see lib/dwell-key. Null on
   * shadow-mode rows, which cannot be collapsed and so each stand as
   * their own device; there is no better answer available for them.
   */
  deviceKey?: string | null;
}

export interface DwellSummary {
  /** How many DEVICES are behind this. Never shown to a visitor. */
  samples: number;
  /** Share of those devices that reached `queueing`, 0–1. */
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

  /**
   * One entry per device, at the strongest class it reached.
   *
   * `queueing` supersedes `lingering` because they are the same visit
   * seen further along, and counting both would have one person argue
   * against themselves in the proportion.
   */
  const byDevice = new Map<string, DwellSample>();
  fresh.forEach((sample, i) => {
    const key = sample.deviceKey ?? `\u0000row-${i}`;
    const held = byDevice.get(key);
    if (!held || (sample.dwell === 'queueing' && held.dwell !== 'queueing')) {
      byDevice.set(key, sample);
    }
  });
  const devices = [...byDevice.values()];

  if (devices.length < MIN_DWELL_SAMPLES) return null;

  const queueing = devices.filter((s) => s.dwell === 'queueing').length;
  const queueingShare = queueing / devices.length;
  const stopping = queueingShare >= STOPPING_SHARE;

  return {
    samples: devices.length,
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
