import type {
  CrowdConfidence,
  CrowdLevel,
  CrowdReportInput,
  CrowdStatus,
  CrowdTrend,
} from '@/types/crowd';

/**
 * Turning a pile of anonymous reports into one honest sentence.
 *
 * Pure functions with an injected clock — no database, no cache, no React.
 * That is what makes the algorithm testable, and it is the only part of
 * this feature where being subtly wrong is invisible: a bad cooldown throws
 * an error, but bad weighting just quietly misinforms people.
 */

/** Reports older than this cannot influence current state (§2, §12). */
export const ACTIVE_WINDOW_MINUTES = 90;

/**
 * Freshness half-life.
 *
 * The brief suggested step buckets (1.0 / 0.8 / 0.5 / 0.25). Steps have a
 * defect that matters here: a report's influence falls off a cliff as it
 * crosses a boundary, so a mandal sitting near a tie flips its displayed
 * status the moment a clock ticks past 15 minutes, with no new information.
 * Users read that as the app being unreliable.
 *
 * Exponential decay — w = 2^(-age/halfLife) — is continuous, monotonic and
 * has one parameter instead of four. At a 30-minute half-life it tracks the
 * intended curve closely:
 *
 *     age    steps   decay
 *     0      1.00    1.00
 *     15     1.00    0.71
 *     30     0.80    0.50
 *     60     0.50    0.25
 *     90     0.25    0.125
 *
 * Slightly steeper early, which is the right direction: a 20-minute-old
 * queue report genuinely is worth less than a 2-minute-old one.
 */
export const FRESHNESS_HALF_LIFE_MINUTES = 30;

/**
 * How much less a report counts when it was not made at the mandal.
 *
 * Someone standing at the gate is reporting what they can see. Someone
 * elsewhere is reporting what they remember, or heard, or assume. Both are
 * worth having — the "Seen any of these?" prompt deliberately invites the
 * second kind from people who walked past — but they are not equal
 * evidence, and weighting them equally let the larger, vaguer group
 * outvote the people actually there.
 *
 * A half, not a tenth. Off-site reports are usually honest recollection
 * minutes old, and a mandal whose only reports are off-site should still
 * show something rather than nothing. Two people at the gate outweigh
 * three who are not, which is the intended shape.
 *
 * "Off-site" now means between about 100 m and 5 km, not anywhere at
 * all: the controls are no longer offered outside that radius, so this
 * weight separates someone at the gate from someone who walked past ten
 * minutes ago — not from someone across the city, who can no longer
 * report at all. See features/crowd/report-eligibility.
 */
export const OFFSITE_WEIGHT = 0.5;

/**
 * How many distinct devices it takes before a reading is a reading.
 *
 * One, by the owner's decision. Anything higher meant that on a quiet
 * mandal — or on any mandal early in the festival — a person who reported
 * what they were looking at saw nothing appear, and the tracker stayed
 * empty while reports sat unconfirmed. A signal nobody sees is a signal
 * nobody sends twice.
 *
 * The cost is real and is not hidden: one person can now set a mandal's
 * colour on their own, and every fresh browser profile is a fresh
 * identity, so nothing in the app stops someone doing it deliberately.
 * What limits the damage is everything around this number — a report
 * decays by half every thirty minutes, expires after ninety, is capped at
 * one per device per mandal per hour, and a single report scores mass 1.0
 * which confidenceFrom reports as "Early signal" rather than anything
 * confident. A second, honest report outweighs a stale wrong one quickly.
 *
 * If manipulation shows up during the festival, this is the number to
 * raise, and `blockDevice` in crowd-admin is the faster remedy.
 */
export const MIN_DEVICES_FOR_STATUS = 1;

/**
 * Mass contributed by one passive dwell observation.
 *
 * A quarter of a fresh report from someone at the gate, which is the unit
 * everything here is denominated in. The number is a claim you can argue
 * with: a dwell sample carries no human judgement, and it cannot say WHY
 * somebody stopped — a person admiring the dekhava for ten minutes looks
 * identical to one queueing for ten. A quarter says it is worth having
 * and worth about a quarter as much.
 *
 * Three limits keep it bounded, and all three matter more than the weight:
 *
 *   1. DWELL_MASS_CAP — twenty samples cannot outvote two people. Without
 *      a cap this scales with how popular the app is and silently takes
 *      over the algorithm as it grows.
 *   2. It never counts toward MIN_DEVICES_FOR_STATUS, so dwell alone can
 *      never CREATE a reading. With no human reports there is no status,
 *      whatever the dwell says.
 *   3. It is excluded from the confidence calculation. Confidence is how
 *      much a reader should trust the reading, and a passive signal with
 *      no judgement behind it must not raise that.
 *
 * What it can actually do, therefore, is tip a reading that is already
 * close, and only when humans have already established one.
 */
export const DWELL_MASS = 0.25;

/** Total mass all dwell samples may contribute to one mandal. */
export const DWELL_MASS_CAP = 1;

/**
 * Distinct devices before dwell may colour a mandal with nobody reporting.
 *
 * ONE, set for the evening of 14 September 2026 on the owner's decision,
 * down from two. Reverting is this line and a deploy.
 *
 * The case for it, from today's data: by late afternoon six mandals had
 * dwell in the live window and every one of them had exactly one device,
 * so the signal was collecting well and publishing nothing. Somebody
 * spent thirteen and a half minutes inside Tambdi Jogeshwari's
 * forty-one-metre zone and the app said "estimated".
 *
 * What one device costs, stated plainly:
 *
 *   DWELL_DOMINANCE_SHARE stops existing. A single device is always a
 *   hundred per cent of itself, so the agreement requirement can no
 *   longer refuse anything.
 *
 *   The short veto loses its second opinion. It works by one device
 *   contradicting another — three people strolling past Dagdusheth for
 *   six minutes look exactly like a short queue until a fourth is seen
 *   actually queueing.
 *
 * The second one is not survivable on its own, so it is handled rather
 * than accepted: at a single device `short` is refused outright. One
 * phone may report congestion and may not certify emptiness. That keeps
 * the asymmetry the whole lane rests on — an over-pessimistic passive
 * signal costs somebody a walk to another mandal, an over-optimistic one
 * sends them into a two-hour queue on the app's word.
 */
export const MIN_DWELL_DEVICES_FOR_STATUS = 1;

/**
 * Below this many devices, dwell may not call a mandal short.
 *
 * See above. `short` is the one reading a passer-by produces by accident:
 * they enter, they look, they leave inside ten minutes, and that is
 * indistinguishable from a mandal you can walk straight into.
 */
export const MIN_DWELL_DEVICES_FOR_SHORT = 2;

/**
 * How long a visit may run before it stops being a queue.
 *
 * Clamped around the mandal's OWN curated peak wait rather than set flat,
 * because the mandals differ by an order of magnitude: Dagdusheth's
 * curated peak is 150 minutes and Kasba's is 40, so one ceiling would
 * either throw away Dagdusheth's real queues or admit Kasba's parked
 * phones.
 *
 * The floor covers the eleven mandals with no curated figure at all, and
 * the ceiling stops the largest mandal's allowance running away: two
 * hours is longer than any darshan queue this catalogue records, so
 * beyond it the likeliest explanation is a device that lives there.
 */
export const DWELL_CEILING_MIN_MINUTES = 60;
export const DWELL_CEILING_MAX_MINUTES = 120;

export function dwellCeilingSeconds(peakDarshanMinutes: number | null): number {
  const peak = peakDarshanMinutes ?? 0;
  const minutes = Math.min(
    DWELL_CEILING_MAX_MINUTES,
    Math.max(DWELL_CEILING_MIN_MINUTES, peak)
  );
  return minutes * 60;
}

/**
 * And they have to agree.
 *
 * Two phones queueing and two lingering is not an observation, it is
 * noise with a majority. The winning class must hold this share of the
 * dwell devices or the signal declines to speak and the mandal falls
 * through to the prior — which is the honest outcome, because "some
 * people stopped and some did not" is what it actually saw.
 */
export const DWELL_DOMINANCE_SHARE = 0.6;

/**
 * Which level a dwell class argues for WHEN IT IS ONLY ADDING MASS.
 *
 * `queueing` means longer inside the zone than any walking speed
 * explains; `lingering` means slower than a clean walk-through. In a
 * pedestrianised lane that second one is congestion, which is what
 * "moving" describes — a queue that is moving.
 *
 * Deliberately never `short`, and that is not an omission. In the mass
 * lane dwell is shading a reading people established, so it is allowed
 * to argue that a queue is worse than reported and never that it is
 * better: an optimistic passive nudge sends somebody into a queue on the
 * strength of a signal that cannot tell queueing from looking.
 *
 * The standalone lane — `dwellConsensus`, where dwell speaks with nobody
 * reporting — CAN reach `short`, because it has protections this mapping
 * does not: a measured duration rather than a threshold, three agreeing
 * devices, and a veto if any device proves a queue exists.
 */
const DWELL_LEVEL: Record<'lingering' | 'queueing', CrowdLevel> = {
  lingering: 'moving',
  queueing: 'long',
};

/**
 * Mass for one reported wait time.
 *
 * Above the unit — a fresh report from someone at the gate is 1.0 —
 * because it is better evidence than the unit is. A colour is a judgement
 * about a queue somebody is looking at; minutes are a number they know,
 * given after the fact by the person who did the waiting. There is no
 * "heavy or just moving" to disagree about.
 *
 * It still decays and expires like everything else: a wait reported
 * eighty minutes ago describes a queue that has since moved.
 */
export const WAIT_MASS = 1.5;

/**
 * How recent a wait must be to describe the queue NOW.
 *
 * Two half-lives, where the evidence is still worth a quarter of a fresh
 * report. It governs two things that must never disagree: the median the
 * panel prints, and the floor that median sets on the colour.
 *
 * They were split at first — the floor took one half-life, the printed
 * median took the whole ninety-minute window — and Dagdusheth immediately
 * showed the bug that split caused: waits of 15 minutes (23 min old) and
 * 45 minutes (41 min old) produced a printed median of 30 beside a colour
 * of Moving, because only the 15 counted toward the floor.
 *
 * One window for both. If a wait is too old to colour with, it is too old
 * to quote as what people are waiting, and saying it anyway is the
 * contradiction this whole rule exists to remove.
 */
export const WAIT_CURRENT_MINUTES = 2 * FRESHNESS_HALF_LIFE_MINUTES;

/**
 * Which level a reported wait argues for.
 *
 * The same thresholds the rest of the app uses for a queue: 30 minutes is
 * where "heavy" starts, under 10 is a walk-in. Written here rather than
 * imported from the prior so that Lane A never depends on Lane B.
 */
export function levelForWaitMinutes(minutes: number): CrowdLevel {
  if (minutes >= 30) return 'long';
  if (minutes >= 10) return 'moving';
  return 'short';
}

/** One reported wait, as aggregation needs it. */
export interface WaitInput {
  minutes: number;
  createdAt: string;
}

/** One passive observation, as aggregation needs it. */
export interface DwellInput {
  dwell: 'lingering' | 'queueing';
  createdAt: string;
  /**
   * Seconds inside the zone. For a threshold marker this is the threshold
   * — a lower bound, quantised to the 30-second clock. Only an `isFinal`
   * row carries a measured duration.
   */
  dwellSeconds?: number;
  /** True for the one row written when a visit is confirmed to have ended. */
  isFinal?: boolean;
  /**
   * Beyond this many seconds inside the zone, the row is not a queue.
   *
   * Derived per mandal by the service from its curated peak wait — see
   * dwellCeilingSeconds. Absent means no ceiling, which is the old
   * behaviour rather than a silent zero.
   */
  maxPlausibleSeconds?: number;
  /**
   * Seconds to walk clean through this mandal's zone, from its geometry.
   *
   * Attached by the service rather than sent by the client: this is now
   * load-bearing for what colour a mandal takes, and a number the client
   * chooses is a number an attacker chooses.
   */
  crossingSeconds?: number;
  /**
   * Digest of (device, mandal, IST day, salt) — not a device id, and not
   * joinable across mandals or days. See lib/dwell-key.
   *
   * Null for every row written in shadow mode, before the column existed.
   * Those count as their own device each, which is the old behaviour
   * rather than a silent downgrade to uncountable.
   */
  deviceKey?: string | null;
}

export function proximityWeight(atMandal: boolean): number {
  return atMandal ? 1 : OFFSITE_WEIGHT;
}

/** Ordering used for trend maths. Not exposed; purely internal. */
const SEVERITY: Record<CrowdLevel, number> = { short: 0, moving: 1, long: 2 };

const LEVELS: CrowdLevel[] = ['short', 'moving', 'long'];

/**
 * Weight of a report by age. Zero once outside the active window, so an
 * expired report cannot contribute even if a caller forgets to filter —
 * the 90-minute rule holds without a cron job (§2).
 */
export function freshnessWeight(ageMinutes: number): number {
  if (ageMinutes < 0) return 1; // clock skew; treat as brand new
  if (ageMinutes > ACTIVE_WINDOW_MINUTES) return 0;
  return Math.pow(2, -ageMinutes / FRESHNESS_HALF_LIFE_MINUTES);
}

/**
 * Confidence.
 *
 * Two independent things make a reading trustworthy, and both are needed:
 *
 *   mass      — the total weighted evidence. Thirty stale reports and one
 *               fresh one should not read the same way.
 *   agreement — the winning level's share of that mass. Ten reports split
 *               evenly three ways tell you nothing, however fresh.
 *
 * Thresholds are calibrated so that a single fresh report is `low` (mass
 * 1.0), five recent mixed reports land in `medium`, and a strong consensus
 * of a dozen-plus fresh reports reaches `high`.
 */
export function confidenceFrom(mass: number, agreement: number): CrowdConfidence {
  if (mass < 2 || agreement < 0.5) return 'low';
  if (mass >= 6 && agreement >= 0.7) return 'high';
  return 'medium';
}

/** Windows compared to derive a trend, in minutes. */
const TREND_RECENT_MINUTES = 20;
const TREND_PRIOR_MINUTES = 60;
/** Below this severity change the difference is noise, not a trend. */
const TREND_EPSILON = 0.25;
/** Fewer than this in either window and we say `unknown` rather than guess. */
const TREND_MIN_SAMPLES = 2;

/**
 * Trend.
 *
 * Compares mean severity in the last 20 minutes against the 20–60 minute
 * band. Unweighted within each window on purpose: the windows are already
 * narrow, and decay inside them would let a single very recent report
 * dominate a comparison whose whole point is to smooth over one report.
 *
 * Returns `unknown` freely. A trend claimed from two reports is a coin
 * flip presented as insight.
 */
export function trendFrom(
  reports: { status: CrowdLevel; ageMinutes: number }[]
): CrowdTrend {
  const recent = reports.filter((r) => r.ageMinutes <= TREND_RECENT_MINUTES);
  const prior = reports.filter(
    (r) => r.ageMinutes > TREND_RECENT_MINUTES && r.ageMinutes <= TREND_PRIOR_MINUTES
  );

  if (recent.length < TREND_MIN_SAMPLES || prior.length < TREND_MIN_SAMPLES) {
    return 'unknown';
  }

  const mean = (rs: { status: CrowdLevel }[]) =>
    rs.reduce((sum, r) => sum + SEVERITY[r.status], 0) / rs.length;

  const delta = mean(recent) - mean(prior);
  if (Math.abs(delta) < TREND_EPSILON) return 'stable';
  return delta > 0 ? 'worsening' : 'improving';
}

/**
 * Wording for a reading nobody reported.
 *
 * Deliberately a different verb from Lane A's. Lane A says "Devotees
 * report"; this says what was seen, and admits in the same sentence that
 * it cannot tell a queue from a crowd admiring the dekhava — because it
 * genuinely cannot, and that limitation is the reason this needs three
 * devices where a person needs none.
 */
export function observedLabelFor(level: CrowdLevel): { label: string; detail: string } {
  if (level === 'long') {
    return {
      // The SAME word a reported heavy queue uses. An observed reading no
      // longer announces its own machinery in the label — "Observed heavy"
      // beside "observed 10 min ago" said the same thing twice, and the
      // first half of it was about how the app works rather than about
      // the queue. Where it came from is carried by the time line and by
      // the half-filled mark, which is where provenance belongs.
      label: 'Heavy',
      detail:
        'Phones near this mandal are stopping for longer than any walking ' +
        'speed explains.',
    };
  }
  if (level === 'short') {
    return {
      label: 'Short',
      detail:
        'Phones near this mandal are arriving and leaving again within a ' +
        'few minutes.',
    };
  }
  return {
    label: 'Moving',
    detail: 'Phones near this mandal are moving through slower than a clean walk.',
  };
}

/**
 * Wording.
 *
 * `long` never claims a queue duration as fact. "30+ min reported" is
 * attributable and falsifiable; "30+ min" is a promise the app cannot keep.
 */
export function labelFor(status: CrowdLevel | null): { label: string; detail: string } {
  switch (status) {
    case 'short':
      return { label: 'Short', detail: 'Devotees report a short queue' };
    case 'moving':
      return { label: 'Moving', detail: 'Devotees report the queue is moving steadily' };
    case 'long':
      return { label: 'Heavy', detail: 'Devotees report a heavy crowd — 30+ min waits' };
    default:
      return {
        label: 'No recent reports',
        detail: 'Nobody has reported this mandal in the last 90 minutes',
      };
  }
}

/**
 * Aggregate one mandal's active reports into a status.
 *
 * `nowMs` is injected rather than read from the clock so the behaviour is
 * reproducible in tests and identical for every mandal in a snapshot.
 */
/** One report, with every factor that produced its weight. */
export interface ReportContribution {
  status: CrowdLevel;
  ageMinutes: number;
  atMandal: boolean;
  freshness: number;
  proximity: number;
  mass: number;
}

/** One dwell observation, with its weight after the cap is applied. */
export interface DwellContribution {
  dwell: 'lingering' | 'queueing';
  level: CrowdLevel;
  ageMinutes: number;
  freshness: number;
  /** Before the aggregate cap. */
  rawMass: number;
  /** After it. */
  mass: number;
}

/**
 * The complete derivation of a mandal's scores.
 *
 * Extracted so the admin explainer and the live path run the SAME code.
 * An explainer that recomputes the answer separately is an explainer that
 * can disagree with the page it is explaining, and the disagreement would
 * be invisible until someone trusted the wrong one.
 */
export interface WaitContribution {
  minutes: number;
  level: CrowdLevel;
  ageMinutes: number;
  freshness: number;
  mass: number;
}

export interface ScoreBreakdown {
  scores: Record<CrowdLevel, number>;
  /** Mass from human reports only. Confidence is computed on this. */
  humanMass: number;
  /** Human mass plus capped dwell. The winner is argmax over this. */
  mass: number;
  reports: ReportContribution[];
  waits: WaitContribution[];
  dwell: DwellContribution[];
  /** Median of the reported waits in the window, or null if none. */
  waitMedianMinutes: number | null;
  /** Multiplier applied to every dwell sample to honour DWELL_MASS_CAP. */
  dwellScale: number;
  dwellMassRaw: number;
  dwellMassApplied: number;
}

interface AgedDwell {
  d: DwellInput;
  ageMinutes: number;
}

/**
 * Rows that describe a parked phone rather than a queue.
 *
 * A device sitting inside a zone with the page open keeps accumulating
 * dwell, and the longer it sits the stronger the evidence it appears to
 * be. Kasba Peth produced one of these on festival day: a single device
 * reading 128 minutes inside a fifty-metre circle, against a curated peak
 * of forty and eleven human reports that evening with a median of thirty.
 * Nobody queues at Kasba for two hours. Somebody lives there, or works
 * there, or was sitting in a shop with the app open.
 *
 * Dropped rather than downgraded, and dropped BEFORE the device is
 * counted: a phone we cannot believe should not be evidence of a queue
 * and should not be a device either. At a one-device bar the difference
 * is whether a resident's forgotten tab paints a mandal red all evening.
 */
function plausible(x: AgedDwell): boolean {
  const ceiling = x.d.maxPlausibleSeconds;
  if (typeof ceiling !== 'number' || ceiling <= 0) return true;
  const seconds = x.d.dwellSeconds;
  if (typeof seconds !== 'number') return true;
  return seconds <= ceiling;
}

/** queueing supersedes lingering: it is the same visit, gone further. */
function collapseDwellByDevice(all: AgedDwell[]): AgedDwell[] {
  const fresh = all.filter(plausible);
  const best = new Map<string, AgedDwell>();
  fresh.forEach((x, i) => {
    // A null key cannot be deduplicated, so it is given a key of its own.
    const key = x.d.deviceKey ?? `\u0000row-${i}`;
    const held = best.get(key);
    if (!held) {
      best.set(key, x);
      return;
    }
    const stronger = x.d.dwell === 'queueing' && held.d.dwell !== 'queueing';
    // Same class: keep the fresher one, so the decay reflects the most
    // recent time this device was seen doing it.
    const fresher = x.d.dwell === held.d.dwell && x.ageMinutes < held.ageMinutes;
    if (stronger || fresher) best.set(key, x);
  });
  return [...best.values()];
}

/** Distinct devices behind a mandal's fresh dwell samples. */
export function dwellDeviceCount(samples: DwellInput[], nowMs: number): number {
  const fresh = samples
    .map((d) => ({ d, ageMinutes: (nowMs - Date.parse(d.createdAt)) / 60_000 }))
    .filter((x) => Number.isFinite(x.ageMinutes) && x.ageMinutes >= 0 && x.ageMinutes <= ACTIVE_WINDOW_MINUTES);
  return collapseDwellByDevice(fresh).length;
}

/**
 * What one device's rows say about the queue, and whether it proves one.
 *
 * ---------------------------------------------------------------------
 * Why a marker and a final sample are read differently.
 *
 * A threshold marker says "at least this long". It is a LOWER BOUND — the
 * visit was still running when it was written, and may have run for
 * another hour. A lower bound can argue that a queue exists; it can never
 * argue that one is short, because the thing it does not know is exactly
 * how much longer the person stood there.
 *
 * A final sample is a measurement: the visit ended, and the row carries
 * its whole length. That is the only row entitled to say "short".
 *
 * What it measures, though, is time in the zone, not time in a queue —
 * and the zones run from 35 m to 75 m, where walking clean across takes
 * 2.2 and 4.7 minutes respectively. So the walk is subtracted and the
 * EXCESS is what gets classified, on the same minute thresholds a
 * reported wait time uses. Without that, a stroll across a big zone and a
 * real wait at a small one would read the same.
 */
interface DeviceReading {
  level: CrowdLevel;
  /**
   * This device is positive evidence that a queue exists here.
   *
   * Either it crossed the queueing threshold, or its completed visit had
   * ten minutes in it that walking does not explain. Used to veto a
   * "short" consensus — see dwellConsensus.
   */
  queued: boolean;
}

function readDevice(rows: AgedDwell[]): DeviceReading {
  const queueingMarker = rows.some((x) => x.d.dwell === 'queueing');

  // The longest completed visit this device recorded. There is normally
  // at most one; taking the longest is defensive rather than meaningful.
  const finals = rows.filter((x) => x.d.isFinal && typeof x.d.dwellSeconds === 'number');
  const final = finals.reduce<AgedDwell | null>(
    (best, x) => (!best || (x.d.dwellSeconds ?? 0) > (best.d.dwellSeconds ?? 0) ? x : best),
    null
  );

  if (final) {
    const crossing = final.d.crossingSeconds ?? 0;
    const excessMinutes = Math.max(0, (final.d.dwellSeconds ?? 0) - crossing) / 60;
    const level = levelForWaitMinutes(excessMinutes);
    return {
      level,
      // A queueing marker still counts as proof even where the measured
      // excess lands short, which happens at the smallest zones: four
      // times a 2.2-minute crossing is under nine minutes in total.
      queued: queueingMarker || level !== 'short',
    };
  }

  // Markers only: a lower bound, and never short.
  return {
    level: DWELL_LEVEL[queueingMarker ? 'queueing' : 'lingering'],
    queued: queueingMarker,
  };
}

/**
 * What the dwell devices agree on, or null.
 *
 * Returns a level only when enough independent devices have been seen and
 * enough of them behaved the same way — see MIN_DWELL_DEVICES_FOR_STATUS
 * and DWELL_DOMINANCE_SHARE. This is the only path by which a mandal can
 * take a colour with nobody having reported it.
 *
 * ---------------------------------------------------------------------
 * The veto, and the mandal it exists for.
 *
 * Dagdusheth's zone is 65 m and its peak queue is 150 minutes. People
 * stand on the road outside it constantly without ever joining that
 * queue — looking at the dekhava, taking photographs, waiting for family
 * — and three of them leaving after six minutes is exactly the pattern a
 * genuinely short mandal produces. Without a guard, the busiest mandal in
 * Pune would go green off passers-by.
 *
 * So a `short` consensus is refused outright if ANY device in the window
 * is positive evidence of a queue. One person standing thirteen minutes
 * proves a queue exists; three people strolling past do not prove it
 * does not. The errors are not the same size either: a pessimistic
 * passive signal costs somebody a walk to another mandal, an optimistic
 * one sends them into a two-hour queue on the app's word.
 */
export function dwellConsensus(
  samples: DwellInput[],
  nowMs: number
): { level: CrowdLevel; devices: number; share: number; newestAt: string } | null {
  const fresh = samples
    .map((d) => ({ d, ageMinutes: (nowMs - Date.parse(d.createdAt)) / 60_000 }))
    .filter((x) => Number.isFinite(x.ageMinutes) && x.ageMinutes >= 0 && x.ageMinutes <= ACTIVE_WINDOW_MINUTES)
    /**
     * Attributable rows only.
     *
     * Shadow-mode rows carry no key, and the whole safety argument for
     * letting dwell colour a mandal is that the devices behind it can be
     * counted. Twenty unattributable rows are one caller or twenty
     * people and there is no way to tell, so they may still add mass to
     * a reading a human established — that is unchanged — but they may
     * not create one.
     */
    .filter((x) => typeof x.d.deviceKey === 'string' && x.d.deviceKey.length > 0)
    // And drop the parked phones before anything is counted. See plausible().
    .filter(plausible);

  // Group every row by device, rather than keeping one row each: reading
  // a device needs its markers AND its final sample together.
  const byDevice = new Map<string, AgedDwell[]>();
  for (const x of fresh) {
    const key = x.d.deviceKey as string;
    (byDevice.get(key) ?? byDevice.set(key, []).get(key)!).push(x);
  }
  if (byDevice.size < MIN_DWELL_DEVICES_FOR_STATUS) return null;

  const readings = [...byDevice.values()].map(readDevice);
  const total = readings.length;

  let winner: CrowdLevel = 'moving';
  let best = -1;
  for (const level of LEVELS) {
    const n = readings.filter((r) => r.level === level).length;
    if (n > best) {
      best = n;
      winner = level;
    }
  }

  const share = best / total;
  if (share < DWELL_DOMINANCE_SHARE) return null;

  // The veto. See the note above.
  if (winner === 'short' && readings.some((r) => r.queued)) return null;

  // And short needs a second opinion, because the veto IS the second
  // opinion: at one device there is nobody to contradict a passer-by.
  if (winner === 'short' && total < MIN_DWELL_DEVICES_FOR_SHORT) return null;

  const newestAt = fresh.reduce(
    (newest, x) => (Date.parse(x.d.createdAt) > Date.parse(newest) ? x.d.createdAt : newest),
    fresh[0].d.createdAt
  );

  return { level: winner, devices: total, share, newestAt };
}

export function scoreBreakdown(
  aged: { status: CrowdLevel; ageMinutes: number; atMandal: boolean }[],
  dwellSamples: DwellInput[],
  nowMs: number,
  waitSamples: WaitInput[] = []
): ScoreBreakdown {
  const scores: Record<CrowdLevel, number> = { short: 0, moving: 0, long: 0 };

  // Freshness and proximity multiply: a stale on-site report and a fresh
  // off-site one can legitimately land at similar weight.
  const reports: ReportContribution[] = aged.map((r) => {
    const freshness = freshnessWeight(r.ageMinutes);
    const proximity = proximityWeight(r.atMandal);
    const mass = freshness * proximity;
    scores[r.status] += mass;
    return { status: r.status, ageMinutes: r.ageMinutes, atMandal: r.atMandal, freshness, proximity, mass };
  });

  /**
   * Reported waits, which are human evidence and count as such.
   *
   * Added before humanMass is taken, unlike dwell: a wait time is
   * somebody's own report, so it should raise confidence exactly as a
   * colour does. It is only the passive signal that must not.
   */
  const waits: WaitContribution[] = [];
  for (const w of waitSamples) {
    const ageMinutes = (nowMs - Date.parse(w.createdAt)) / 60_000;
    if (!Number.isFinite(ageMinutes) || ageMinutes < 0) continue;
    if (ageMinutes > ACTIVE_WINDOW_MINUTES) continue;
    const freshness = freshnessWeight(ageMinutes);
    const mass = WAIT_MASS * freshness;
    const level = levelForWaitMinutes(w.minutes);
    scores[level] += mass;
    waits.push({ minutes: w.minutes, level, ageMinutes, freshness, mass });
  }

  // Only waits recent enough to describe the queue now — see
  // WAIT_CURRENT_MINUTES. The older ones still carry mass, decayed, and
  // still argue for a level; they just do not get to be quoted as the
  // current wait or to set the floor.
  const sorted = waits
    .filter((w) => w.ageMinutes <= WAIT_CURRENT_MINUTES)
    .map((w) => w.minutes)
    .sort((a, b) => a - b);
  const waitMedianMinutes =
    sorted.length === 0
      ? null
      : sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);

  // Confidence is computed from the human evidence alone, BEFORE dwell is
  // added. A passive signal may move which level wins; it must not make a
  // reader trust the answer more.
  const humanMass = scores.short + scores.moving + scores.long;

  // Dwell, decayed on the same curve as a report and capped in aggregate
  // so a busy mandal cannot accumulate unbounded passive weight.
  const fresh = dwellSamples
    .map((d) => ({ d, ageMinutes: (nowMs - Date.parse(d.createdAt)) / 60_000 }))
    .filter((x) => Number.isFinite(x.ageMinutes) && x.ageMinutes >= 0 && x.ageMinutes <= ACTIVE_WINDOW_MINUTES);

  /**
   * One sample per device, and the strongest class that device reached.
   *
   * A single visit emits up to three rows — a lingering marker, a
   * queueing marker, and a final sample on the way out — so scoring rows
   * would count one person two or three times, and would count them
   * against themselves: the lingering marker argues `moving` while the
   * queueing marker that supersedes it argues `long`.
   *
   * So each device contributes once, at its high-water mark. Rows with no
   * key are shadow-mode rows and each stand alone, exactly as they did.
   */
  const usable = collapseDwellByDevice(fresh);

  const dwellMassRaw = usable.reduce((sum, x) => sum + DWELL_MASS * freshnessWeight(x.ageMinutes), 0);
  const dwellScale = dwellMassRaw > 0 ? Math.min(1, DWELL_MASS_CAP / dwellMassRaw) : 1;

  const dwell: DwellContribution[] = usable.map((x) => {
    const freshness = freshnessWeight(x.ageMinutes);
    const rawMass = DWELL_MASS * freshness;
    const mass = rawMass * dwellScale;
    const level = DWELL_LEVEL[x.d.dwell];
    scores[level] += mass;
    return { dwell: x.d.dwell, level, ageMinutes: x.ageMinutes, freshness, rawMass, mass };
  });

  return {
    scores, humanMass,
    mass: scores.short + scores.moving + scores.long,
    reports, waits, waitMedianMinutes, dwell, dwellScale,
    dwellMassRaw,
    dwellMassApplied: dwellMassRaw * dwellScale,
  };
}

export function aggregateMandal(
  mandalId: string,
  reports: CrowdReportInput[],
  nowMs: number,
  /** Passive dwell observations. Optional: absent is the normal case. */
  dwellSamples: DwellInput[] = [],
  /** Reported wait times, from people who queued here. */
  waitSamples: WaitInput[] = []
): CrowdStatus {
  const aged = reports
    .map((r) => ({
      status: r.status,
      ageMinutes: (nowMs - Date.parse(r.createdAt)) / 60_000,
      createdAt: r.createdAt,
      atMandal: r.atMandal,
      deviceSeq: r.deviceSeq,
    }))
    // Drop anything outside the window up front so reportCount reflects
    // what is actually influencing the result, not what is in the table.
    .filter((r) => Number.isFinite(r.ageMinutes) && r.ageMinutes <= ACTIVE_WINDOW_MINUTES);

  const freshWaits = waitSamples.filter((w) => {
    const age = (nowMs - Date.parse(w.createdAt)) / 60_000;
    return Number.isFinite(age) && age >= 0 && age <= ACTIVE_WINDOW_MINUTES;
  });

  // A wait report is a report. Somebody who queued and told us how long
  // has said more than somebody who tapped a colour, so a mandal with
  // only wait reports must still produce a reading.
  if (aged.length === 0 && freshWaits.length === 0) {
    /**
     * Nobody reported — but the phones may still have agreed.
     *
     * The one path to a colour with no human behind it, and the narrowest
     * thing in this file: three independent devices, sixty per cent of
     * them behaving the same way, inside the same ninety minutes. It is
     * reached only here, where Lane A has nothing at all, so it can never
     * dilute, tip or override a report — those are decided above.
     *
     * Marked `observed`, not `reported`, all the way to the pin.
     */
    const consensus = dwellConsensus(dwellSamples, nowMs);
    if (consensus) {
      const { label, detail } = observedLabelFor(consensus.level);
      return {
        mandalId,
        status: consensus.level,
        label,
        detail,
        // Nobody reported. Saying "1 report" because three phones walked
        // slowly would be the exact lie this field exists to prevent.
        reportCount: 0,
        source: 'observed',
        // Never anything but low, whatever the sample count. Confidence
        // is how far a reader should trust the reading, and a passive
        // signal with no judgement behind it does not earn more.
        confidence: 'low',
        waitMedianMinutes: null,
        waitReportCount: 0,
        // When the devices were seen, not when anyone reported.
        lastUpdated: consensus.newestAt,
        trend: 'unknown',
      };
    }

    const { label, detail } = labelFor(null);
    return {
      mandalId,
      status: null,
      label,
      detail,
      reportCount: 0,
      source: 'reported',
      confidence: 'low',
      waitMedianMinutes: null,
      waitReportCount: 0,
      lastUpdated: null,
      trend: 'unknown',
    };
  }

  /**
   * Distinct devices behind these reports.
   *
   * `deviceSeq` is opaque and scoped to this mandal — enough to count,
   * useless for identifying anyone. When the database has not supplied it
   * (an older deployment of crowd_active_reports), every report counts as
   * its own device, which preserves the previous behaviour rather than
   * quietly marking everything unconfirmed.
   */
  const devices = new Set(aged.map((r, i) => r.deviceSeq ?? -(i + 1)));
  // Each wait report is its own device: the write path allows one per
  // device per mandal per visit, so two waits are two people.
  for (let i = 0; i < freshWaits.length; i++) devices.add(-1000 - i);

  const breakdown = scoreBreakdown(aged, dwellSamples, nowMs, waitSamples);
  const { scores, humanMass, mass } = breakdown;

  // Argmax, with the most recent report breaking an exact tie. Severity
  // order would be the alternative, but biasing ties toward "heavy" would
  // systematically overstate crowds, and this feature is only useful if
  // people trust it in both directions.
  let winner: CrowdLevel = 'moving';
  let best = -1;
  for (const level of LEVELS) {
    if (scores[level] > best) {
      best = scores[level];
      winner = level;
    } else if (scores[level] === best) {
      const newest = (l: CrowdLevel) =>
        Math.min(...aged.filter((r) => r.status === l).map((r) => r.ageMinutes));
      if (newest(level) < newest(winner)) winner = level;
    }
  }

  /**
   * A reported wait time sets a FLOOR on the colour.
   *
   * Dagdusheth read "Moving" above "People waited about 30 min" on
   * festival day: two wait reports argued heavy at 1.5 each, three colour
   * taps argued moving, and the argmax went to the taps. Both numbers
   * were then shown together, contradicting each other on the same card.
   *
   * The median is the only measured quantity in this whole feature —
   * minutes somebody stood there, given afterwards — while a colour is a
   * judgement about a queue somebody was looking at. So where they
   * disagree, the measurement decides how bad it may be called.
   *
   * It raises and never lowers, and that asymmetry is the point. A single
   * visitor who walked straight in must not talk a heavy queue down to
   * short for everyone behind them; the errors are not the same size.
   * Understating a queue sends somebody into it.
   *
   * Only waits from WAIT_CURRENT_MINUTES count, for the floor AND for the
   * printed median, which are now the same number. A floor that ignores
   * decay outlives the queue it describes; a printed median on a wider
   * window than the floor contradicts the colour beside it. Both were
   * tried and both were wrong.
   */
  // The same median the panel prints, by construction rather than by
  // coincidence: breakdown.waitMedianMinutes is already computed over
  // WAIT_CURRENT_MINUTES, so the number shown and the colour shown can
  // never disagree.
  if (breakdown.waitMedianMinutes !== null) {
    const floor = levelForWaitMinutes(breakdown.waitMedianMinutes);
    if (SEVERITY[floor] > SEVERITY[winner]) winner = floor;
  }

  const agreement = mass > 0 ? scores[winner] / mass : 0;
  // Agreement is measured over the combined scores — a dwell sample that
  // contradicts the humans should reduce agreement, and therefore
  // confidence, rather than being invisible to it.
  /**
   * The newest thing anyone told us, colour or wait time.
   *
   * Taken across both, because a mandal can now have a reading with no
   * colour reports at all — and reducing over the empty `aged` array
   * threw, which is how that case was found.
   */
  const lastUpdated = [
    ...aged.map((r) => r.createdAt),
    ...freshWaits.map((w) => w.createdAt),
  ].reduce((newest, t) => (Date.parse(t) > Date.parse(newest) ? t : newest));

  /**
   * One device is not a reading.
   *
   * Reported honestly rather than hidden: there IS a report, and saying
   * "no recent reports" would be the same lie in the other direction. The
   * status is withheld, the count is shown, and the wording asks for the
   * second report that would settle it.
   */
  if (devices.size < MIN_DEVICES_FOR_STATUS) {
    return {
      mandalId,
      status: null,
      label: 'Not confirmed yet',
      detail:
        // No number: visitors are never told how many people reported.
        'A report has come in but is not confirmed yet. It shows once someone else agrees.',
      reportCount: aged.length,
      source: 'reported',
      confidence: 'low',
      waitMedianMinutes: breakdown.waitMedianMinutes,
      waitReportCount: breakdown.waits.length,
      lastUpdated,
      trend: 'unknown',
    };
  }

  const { label, detail } = labelFor(winner);

  return {
    mandalId,
    status: winner,
    label,
    detail,
    reportCount: aged.length + freshWaits.length,
    source: 'reported',
    confidence: confidenceFrom(humanMass, agreement),
    waitMedianMinutes: breakdown.waitMedianMinutes,
    waitReportCount: breakdown.waits.length,
    lastUpdated,
    trend: trendFrom(aged),
  };
}

/**
 * Aggregate a flat list of reports for many mandals in one pass.
 *
 * Every requested mandal gets an entry, including those with no reports —
 * the caller needs an explicit "no recent reports" to render, and an
 * absent key would be indistinguishable from a failed lookup.
 */
export function aggregateSnapshot(
  mandalIds: string[],
  reports: CrowdReportInput[],
  nowMs: number,
  /** Passive dwell observations per mandal. Empty is the normal case. */
  dwellByMandal: Record<string, DwellInput[]> = {},
  /** Reported wait times per mandal. */
  waitByMandal: Record<string, WaitInput[]> = {}
): CrowdStatus[] {
  const byMandal = new Map<string, CrowdReportInput[]>();
  for (const id of mandalIds) byMandal.set(id, []);
  for (const r of reports) byMandal.get(r.mandalId)?.push(r);

  return mandalIds.map((id) =>
    aggregateMandal(id, byMandal.get(id) ?? [], nowMs, dwellByMandal[id] ?? [], waitByMandal[id] ?? [])
  );
}
