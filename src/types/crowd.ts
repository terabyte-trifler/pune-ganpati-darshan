/**
 * Crowd intelligence vocabulary.
 *
 * These describe what devotees have *reported*, never what the queue
 * definitively is. That distinction is load-bearing: the app has no way to
 * measure a queue, and a confident wrong number sends someone across Pune
 * for nothing. Every label in this file is phrased as a report.
 */

export type CrowdLevel = 'short' | 'moving' | 'long';

export type CrowdConfidence = 'low' | 'medium' | 'high';

export type CrowdTrend = 'improving' | 'stable' | 'worsening' | 'unknown';

/**
 * Aggregated state for one mandal.
 *
 * `status` is nullable, which is a deliberate departure from a
 * non-nullable contract. "Nobody has reported recently" is a real and
 * common state, and it is not the same as "short". Collapsing the two
 * would make the app quietly invent a calm queue for every mandal no one
 * has visited yet — the single most misleading thing this feature could
 * do. Callers must handle null; `label` already carries wording for it.
 */
/**
 * `source`, and why the explanation lives out here.
 *
 * 'reported' — at least one person said something: a colour, a wait time,
 * or both. The normal case, and the only one that may be worded as a
 * report.
 *
 * 'observed' — nobody said anything, and enough independent devices were
 * seen stopping at the mandal to say something anyway. Weaker than a
 * report and never dressed as one: the label says "Observed", the wording
 * says what was seen rather than what anyone claimed, and confidence
 * stays low whatever the sample count.
 *
 * 'override' — an admin asserted it, and for thirty minutes it replaces
 * whatever the evidence says. Ranked and drawn exactly as a report,
 * because a person is behind it; kept distinct so the admin surfaces can
 * see which mandals are being held by hand rather than measured.
 *
 * There is deliberately no value for the clock model. That never
 * becomes a CrowdStatus at all, because it is not a measurement of
 * anything — it is attached alongside, in its own type, and tests assert
 * that the two cannot meet inside this interface. Which is also why this
 * paragraph is here rather than on the field: those tests read the
 * interface body and would fail on the words alone.
 */
export interface CrowdStatus {
  mandalId: string;
  status: CrowdLevel | null;
  /** Short wording for a badge or map marker. */
  label: string;
  /** A sentence for the detail panel, always attributed to reports. */
  detail: string;
  reportCount: number;
  /** Whether a person said this, or only the devices did. See above. */
  source: 'reported' | 'observed' | 'override';
  confidence: CrowdConfidence;
  /**
   * Median wait in minutes, from people who queued here and said how
   * long. Null when nobody has.
   *
   * The only number in this object measured rather than judged: every
   * other field describes what a queue looked like, this one is how long
   * somebody stood in it. Shown as "about 25 min" and never as a promise.
   */
  waitMedianMinutes: number | null;
  /** How many wait reports that median came from. */
  waitReportCount: number;
  /**
   * Median minutes the dwell devices measured here, or null.
   *
   * A LOWER BOUND, never an estimate — see observedWaitMinutes in
   * crowd-aggregation for why the production data forces that reading.
   * It may raise a modelled wait and may never lower one.
   */
  observedWaitMinutes: number | null;
  /** ISO timestamp of the most recent active report, or null. */
  lastUpdated: string | null;
  trend: CrowdTrend;
}

/** A snapshot of every mandal with crowd data, plus how fresh it is. */
export interface CrowdSnapshot {
  statuses: CrowdStatus[];
  /**
   * Passive dwell hints, keyed by mandal id. A THIRD lane: what devices
   * near a mandal were observed doing, which is neither what anyone
   * reported nor what the clock expects.
   *
   * Kept out of CrowdStatus on purpose. Nothing in this map may alter a
   * status, its label, its confidence or its trend — it renders as its
   * own line and is absent entirely unless CROWD_DWELL_PUBLIC is set.
   * Empty when off, when there are too few samples, or when the read
   * fails.
   */
  dwell?: Record<string, import('@/services/crowd/crowd-dwell').DwellSummary>;
  /** When this snapshot was computed. */
  computedAt: string;
  /**
   * True when the database could not be reached and this is the last good
   * result. The UI must say so rather than present it as current (§55).
   */
  stale: boolean;
}

/** One active report, reduced to the only fields aggregation needs. */
export interface CrowdReportInput {
  mandalId: string;
  status: CrowdLevel;
  createdAt: string;
  /**
   * The client believed it was within ~100m when it submitted. A quality
   * hint for weighting, never a security boundary — see the migration.
   */
  atMandal: boolean;
  /**
   * An opaque per-mandal number standing for the reporting device: 1, 2,
   * 3… within this mandal's window. Enough to count how many distinct
   * devices back a reading, and meaningless outside that query — raw
   * device ids never leave the database.
   */
  deviceSeq?: number;
  /**
   * How old the device was when it made this report, in seconds. Recorded
   * for calibration; nothing scores on it yet. Null for reports written
   * before the column existed.
   */
  deviceAgeSeconds?: number | null;
}

/** Outcome of a submission attempt. Mirrors the RPC's contract (§29). */
export type CrowdSubmitResult =
  | { success: true; status: CrowdLevel; idempotent: boolean }
  | { success: false; reason: 'cooldown'; retryAfter: number }
  | { success: false; reason: 'rate_limited' }
  | { success: false; reason: 'reporting_disabled' }
  | { success: false; reason: 'invalid_request' }
  | { success: false; reason: 'unavailable' };
