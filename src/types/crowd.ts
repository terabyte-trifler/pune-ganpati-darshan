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
export interface CrowdStatus {
  mandalId: string;
  status: CrowdLevel | null;
  /** Short wording for a badge or map marker. */
  label: string;
  /** A sentence for the detail panel, always attributed to reports. */
  detail: string;
  reportCount: number;
  confidence: CrowdConfidence;
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
