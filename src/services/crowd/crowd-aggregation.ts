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
 * "Off-site" now means between about 100 m and 1.5 km, not anywhere at
 * all: the controls are no longer offered outside that radius, so this
 * weight separates someone at the gate from someone who walked past ten
 * minutes ago — not from someone across the city, who can no longer
 * report at all. See features/crowd/report-eligibility.
 */
export const OFFSITE_WEIGHT = 0.5;

/**
 * How many distinct devices it takes before a reading is a reading.
 *
 * One report is information; it is not a reading. Promoting a single tap
 * to "Short", with a confidence label beside it, is the whole of the
 * manipulation exposure — a quiet mandal can be given a queue by one
 * person, because every fresh browser profile is a fresh identity and
 * nothing else was standing in the way.
 *
 * Two does not stop a determined person: they can open two windows. It
 * stops a mandal being conjured from a single tap, which is the case that
 * actually matters, and it costs nothing real — a mandal with one report
 * says so rather than pretending to know.
 */
export const MIN_DEVICES_FOR_STATUS = 2;

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
export function aggregateMandal(
  mandalId: string,
  reports: CrowdReportInput[],
  nowMs: number
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

  if (aged.length === 0) {
    const { label, detail } = labelFor(null);
    return {
      mandalId,
      status: null,
      label,
      detail,
      reportCount: 0,
      confidence: 'low',
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

  const scores: Record<CrowdLevel, number> = { short: 0, moving: 0, long: 0 };
  // Freshness and proximity multiply: a stale on-site report and a fresh
  // off-site one can legitimately land at similar weight.
  for (const r of aged) {
    scores[r.status] += freshnessWeight(r.ageMinutes) * proximityWeight(r.atMandal);
  }

  const mass = scores.short + scores.moving + scores.long;

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

  const agreement = mass > 0 ? scores[winner] / mass : 0;
  const lastUpdated = aged.reduce(
    (newest, r) => (r.ageMinutes < newest.ageMinutes ? r : newest),
    aged[0]
  ).createdAt;

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
        'One person has reported this mandal. A second report confirms it.',
      reportCount: aged.length,
      confidence: 'low',
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
    reportCount: aged.length,
    confidence: confidenceFrom(mass, agreement),
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
  nowMs: number
): CrowdStatus[] {
  const byMandal = new Map<string, CrowdReportInput[]>();
  for (const id of mandalIds) byMandal.set(id, []);
  for (const r of reports) byMandal.get(r.mandalId)?.push(r);

  return mandalIds.map((id) => aggregateMandal(id, byMandal.get(id) ?? [], nowMs));
}
