import 'server-only';

/**
 * Crowd feature metrics.
 *
 * In-process counters and latency reservoirs, readable from the admin
 * console. This is deliberately not a metrics vendor: the numbers that
 * matter here — cache hit ratio and database latency — are exactly the
 * ones needed to decide whether the caching strategy is working, and
 * they are worth having before adding a dependency to collect them.
 *
 * Scope is one instance and one process lifetime. That is stated plainly
 * rather than papered over: on a multi-instance deployment these are
 * per-instance figures, and the load test in tools/load/ measures the
 * system end to end instead of trusting them.
 */

export type CrowdCounter =
  | 'crowd_report_success'
  | 'crowd_report_rejected'
  | 'crowd_report_rate_limited'
  | 'crowd_cache_hit'
  | 'crowd_cache_miss'
  | 'crowd_error';

export type CrowdTiming = 'crowd_api_latency' | 'crowd_db_latency';

export type CrowdMetric = CrowdCounter | CrowdTiming;

const TIMINGS: ReadonlySet<string> = new Set<CrowdTiming>([
  'crowd_api_latency',
  'crowd_db_latency',
]);

/** Bounded so a long-running process cannot grow these without limit. */
const RESERVOIR = 1_000;

const counters = new Map<string, number>();
const timings = new Map<string, number[]>();
const startedAt = Date.now();

export function recordCrowdMetric(metric: CrowdMetric, value: number) {
  if (TIMINGS.has(metric)) {
    const samples = timings.get(metric) ?? [];
    samples.push(value);
    // Keep the most recent window: latency an hour ago says nothing about
    // whether the system is healthy now.
    if (samples.length > RESERVOIR) samples.splice(0, samples.length - RESERVOIR);
    timings.set(metric, samples);
    return;
  }
  counters.set(metric, (counters.get(metric) ?? 0) + value);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Nearest-rank: unambiguous, and correct for small samples where
  // interpolation invents a value no request actually experienced.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export interface CrowdMetricsReport {
  uptimeSeconds: number;
  counters: Record<string, number>;
  /** Cache hits as a share of all cache lookups; null before any lookup. */
  cacheHitRatio: number | null;
  latency: Record<string, { count: number; p50: number; p95: number; p99: number }>;
}

export function readCrowdMetrics(): CrowdMetricsReport {
  const hits = counters.get('crowd_cache_hit') ?? 0;
  const misses = counters.get('crowd_cache_miss') ?? 0;
  const lookups = hits + misses;

  const latency: CrowdMetricsReport['latency'] = {};
  for (const [name, samples] of timings) {
    const sorted = [...samples].sort((a, b) => a - b);
    latency[name] = {
      count: sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    cacheHitRatio: lookups > 0 ? hits / lookups : null,
    latency,
  };
}

export function resetCrowdMetricsForTesting() {
  counters.clear();
  timings.clear();
}
