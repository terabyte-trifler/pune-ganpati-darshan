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
}

/** Outcome of a submission attempt. Mirrors the RPC's contract (§29). */
export type CrowdSubmitResult =
  | { success: true; status: CrowdLevel; idempotent: boolean }
  | { success: false; reason: 'cooldown'; retryAfter: number }
  | { success: false; reason: 'rate_limited' }
  | { success: false; reason: 'reporting_disabled' }
  | { success: false; reason: 'invalid_request' }
  | { success: false; reason: 'unavailable' };
