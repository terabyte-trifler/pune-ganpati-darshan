import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';
import { clientIpFrom, hashIp } from '@/lib/client-ip';
import { getAllGanpatis } from '@/services/ganpati';
import { aggregateSnapshot, aggregateMandal } from './crowd-aggregation';
import { summariseDwell, DWELL_WINDOW_MINUTES, type DwellSummary } from './crowd-dwell';
import {
  scoreBreakdown, ACTIVE_WINDOW_MINUTES,
  type DwellInput, type ScoreBreakdown,
} from './crowd-aggregation';
import {
  CROWD_CACHE_TTL_SECONDS,
  CROWD_STALE_TTL_SECONDS,
  getCrowdCache,
} from './crowd-cache';
import { recordCrowdMetric } from './crowd-metrics';
import type {
  CrowdLevel,
  CrowdReportInput,
  CrowdSnapshot,
  CrowdStatus,
  CrowdSubmitResult,
} from '@/types/crowd';

/**
 * The read and write paths for crowd intelligence.
 *
 * Read shape, and the reason for it:
 *
 *   request → per-mandal cache → (miss) → ONE query for the whole city
 *
 * The catalogue is bounded and small, so aggregating every mandal costs
 * barely more than aggregating one. That single fact removes the hot-key
 * problem the brief worries about in §25: Dagdusheth is not a special case
 * needing its own caching strategy, because its status is computed by the
 * same query that computes everyone else's. One cache miss warms the
 * entire city.
 *
 * The other half is `inFlight` below. Without it, a cache expiry under
 * 10,000 concurrent readers means 10,000 simultaneous misses and 10,000
 * database queries — the stampede that takes the database down at exactly
 * the moment it is most needed. With it, one query runs and everyone else
 * awaits its promise.
 */

class CrowdUnavailableError extends Error {
  constructor() {
    super('Crowd data unavailable');
    this.name = 'CrowdUnavailableError';
  }
}

export { CrowdUnavailableError };

/** Single-flight guard: at most one snapshot computation at a time. */
let inFlight: Promise<CrowdSnapshot> | null = null;
/** Last successful snapshot, kept to serve during a database outage (§55). */
let lastGood: CrowdSnapshot | null = null;

/**
 * Catalogue ids, cached for the process.
 *
 * This is the allow-list that every request is checked against. It is why
 * a cache key can never be built from an arbitrary string (§53) and why an
 * enumeration attempt against the API returns nothing useful (§52).
 */
let mandalIdCache: { ids: string[]; at: number } | null = null;
const MANDAL_ID_TTL_MS = 5 * 60_000;

async function getKnownMandalIds(): Promise<string[]> {
  const now = Date.now();
  if (mandalIdCache && now - mandalIdCache.at < MANDAL_ID_TTL_MS) {
    return mandalIdCache.ids;
  }
  const ganpatis = await getAllGanpatis();
  const ids = ganpatis.map((g) => g.id);
  mandalIdCache = { ids, at: now };
  return ids;
}

/** Drop anything that is not a published mandal. Never throws on bad input. */
export async function filterKnownMandalIds(ids: string[]): Promise<string[]> {
  const known = new Set(await getKnownMandalIds());
  return ids.filter((id) => known.has(id));
}

/**
 * Recompute the whole city from the database.
 *
 * Selects three columns for the active window only (§26) and passes an
 * explicit id list so the (mandal_id, created_at desc) index is used
 * rather than a table scan.
 */
/**
 * Raw dwell samples per mandal, or an empty map.
 *
 * One read, two uses: the aggregation weights them at DWELL_MASS, and the
 * same rows are summarised into the sentence shown under the reading. A
 * second query for the second use would be able to disagree with the
 * first, which is the kind of bug nobody finds.
 *
 * CROWD_DWELL_PUBLIC gates BOTH — it is the single switch for "dwell
 * affects what a visitor sees", covering the colour and the line
 * together. Collection is gated separately by CROWD_DWELL_SHADOW, so this
 * can be killed mid-festival without losing the calibration data.
 *
 * Every failure returns {} rather than throwing: a passive signal that
 * can take down the crowd snapshot is worse than no passive signal.
 */
async function readDwellSamples(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  ids: string[]
): Promise<Record<string, DwellInput[]>> {
  if (process.env.CROWD_DWELL_PUBLIC !== '1') return {};
  try {
    const since = new Date(Date.now() - DWELL_WINDOW_MINUTES * 60_000).toISOString();
    const { data, error } = await supabase
      .from('crowd_dwell_samples')
      .select('mandal_id, dwell, created_at')
      .in('mandal_id', ids)
      .gte('created_at', since)
      .limit(5_000);
    if (error || !data) return {};

    const out: Record<string, DwellInput[]> = {};
    for (const row of data) {
      (out[row.mandal_id] ??= []).push({ dwell: row.dwell, createdAt: row.created_at });
    }
    return out;
  } catch {
    return {};
  }
}


async function computeSnapshot(): Promise<CrowdSnapshot> {
  const ids = await getKnownMandalIds();

  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new CrowdUnavailableError();
  }

  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('crowd_active_reports', {
    p_mandal_ids: ids,
  });
  recordCrowdMetric('crowd_db_latency', Date.now() - startedAt);

  if (error || !data) {
    console.error('[crowd] snapshot failed', {
      code: error?.code,
      message: error?.message,
    });
    recordCrowdMetric('crowd_error', 1);
    throw new CrowdUnavailableError();
  }

  // The dwell lane, read alongside. Deliberately a separate query and a
  // separate failure path: if this errors the crowd snapshot must still
  // be served, because a passive hint failing is not a reason to take
  // down what people actually reported.
  const dwellSamples = await readDwellSamples(supabase, ids);

  const reports: CrowdReportInput[] = data.map((row) => ({
    mandalId: row.mandal_id,
    status: row.status,
    createdAt: row.created_at,
    atMandal: row.at_mandal ?? false,
    // Opaque per-mandal device number. Older deployments of the RPC do
    // not return it; a missing value makes every report look like its own
    // device, which is the pre-existing behaviour rather than a silent
    // downgrade to "unconfirmed".
    deviceSeq: row.device_seq ?? undefined,
    deviceAgeSeconds: row.device_age_seconds ?? null,
  }));

  const now = Date.now();
  // Dwell enters the reading here, at DWELL_MASS each and capped — it can
  // tip a close call but never create one, because it earns no device
  // credit. See crowd-aggregation.
  const statuses = aggregateSnapshot(ids, reports, now, dwellSamples);

  // The same rows, summarised into the sentence rendered under the
  // reading, so the visitor can see why the colour moved.
  const dwell: Record<string, DwellSummary> = {};
  for (const [mandalId, samples] of Object.entries(dwellSamples)) {
    const summary = summariseDwell(samples, now);
    if (summary) dwell[mandalId] = summary;
  }

  return {
    statuses,
    dwell,
    computedAt: new Date(now).toISOString(),
    stale: false,
  };
}

/**
 * The whole city's crowd state.
 *
 * Cache-first, single-flight on miss, and stale-on-failure. Throws only
 * when there is nothing at all to show — which the route turns into a 503
 * so the page can say "temporarily unavailable" instead of inventing calm
 * queues everywhere.
 */
export async function getCrowdSnapshot(): Promise<CrowdSnapshot> {
  const ids = await getKnownMandalIds();
  const cache = getCrowdCache();

  // Serve entirely from cache when every mandal is still warm.
  const cached = await Promise.all(ids.map((id) => cache.get(id)));
  if (cached.every((s): s is CrowdStatus => s !== null)) {
    recordCrowdMetric('crowd_cache_hit', 1);
    return {
      statuses: cached,
      // The status cache is per mandal and holds no dwell, so it is
      // carried from the last full computation. At most 15 seconds
      // stale against a 90-minute window — and without it the hint
      // would blink out on every cache hit.
      dwell: lastGood?.dwell,
      computedAt: lastGood?.computedAt ?? new Date().toISOString(),
      stale: false,
    };
  }

  recordCrowdMetric('crowd_cache_miss', 1);

  // Coalesce concurrent misses into one database query.
  inFlight ??= (async () => {
    try {
      const snapshot = await computeSnapshot();
      await Promise.all(
        snapshot.statuses.map((s) =>
          cache.set(s.mandalId, s, CROWD_CACHE_TTL_SECONDS)
        )
      );
      lastGood = snapshot;
      return snapshot;
    } finally {
      // Cleared in `finally` so a failed load cannot wedge every later
      // request onto a permanently rejected promise.
      inFlight = null;
    }
  })();

  try {
    return await inFlight;
  } catch {
    const age = lastGood ? Date.now() - Date.parse(lastGood.computedAt) : Infinity;
    if (lastGood && age < CROWD_STALE_TTL_SECONDS * 1000) {
      return { ...lastGood, stale: true };
    }
    throw new CrowdUnavailableError();
  }
}

/** Crowd state for a specific set of mandals (§21). */
export async function getCrowdStatuses(mandalIds: string[]): Promise<CrowdStatus[]> {
  const wanted = new Set(await filterKnownMandalIds(mandalIds));
  if (wanted.size === 0) return [];
  const snapshot = await getCrowdSnapshot();
  return snapshot.statuses.filter((s) => wanted.has(s.mandalId));
}

export async function getCrowdStatus(mandalId: string): Promise<CrowdStatus | null> {
  const [status] = await getCrowdStatuses([mandalId]);
  return status ?? null;
}

// Re-exported so route handlers keep importing these from one place.
export { clientIpFrom, hashIp };

/**
 * Submit a report.
 *
 * Every rule lives in the database function; this is the transport. The
 * client never reaches the RPC directly — execute is granted to
 * service_role alone — so this is the only door, and it is the door that
 * carries the IP hash the shared throttle needs.
 */
export async function submitCrowdReport(input: {
  mandalId: string;
  deviceId: string;
  status: CrowdLevel;
  requestId?: string;
  ip?: string | null;
  /** Client-asserted proximity. A weighting hint, never a boundary. */
  atMandal?: boolean;
}): Promise<CrowdSubmitResult> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, reason: 'unavailable' };
  }

  const known = await filterKnownMandalIds([input.mandalId]);
  if (known.length === 0) return { success: false, reason: 'invalid_request' };

  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('submit_crowd_report', {
    p_mandal_id: input.mandalId,
    p_device_id: input.deviceId,
    p_status: input.status,
    p_request_id: input.requestId ?? null,
    p_ip_hash: input.ip ? hashIp(input.ip) : null,
    p_at_mandal: input.atMandal ?? false,
  });
  recordCrowdMetric('crowd_db_latency', Date.now() - startedAt);

  if (error || !data) {
    // The caller gets a generic reason (§29) — but swallowing the cause
    // entirely made "unavailable" undiagnosable, so it is logged here,
    // server-side only, where it can never reach a client.
    console.error('[crowd] submit failed', {
      mandalId: input.mandalId,
      code: error?.code,
      message: error?.message,
    });
    recordCrowdMetric('crowd_error', 1);
    return { success: false, reason: 'unavailable' };
  }

  const result = data as CrowdSubmitResult;

  if (result.success) {
    recordCrowdMetric('crowd_report_success', 1);
    // Only this mandal, so one report does not discard the city's cache
    // (§48). The next reader recomputes and re-warms everything.
    await getCrowdCache().invalidate(input.mandalId);
  } else if (result.reason === 'cooldown') {
    recordCrowdMetric('crowd_report_rejected', 1);
  } else if (result.reason === 'rate_limited') {
    recordCrowdMetric('crowd_report_rate_limited', 1);
  } else {
    recordCrowdMetric('crowd_report_rejected', 1);
  }

  return result;
}

/**
 * Remaining cooldown per mandal for one device.
 *
 * Purely so the UI can say "you reported this recently" instead of
 * offering a button that will be refused. The server re-checks on submit
 * regardless of what the client was told (§11, §31).
 */
export async function getDeviceCooldowns(
  deviceId: string,
  /** Omit to ask about every published mandal — one call covers the app. */
  mandalIds?: string[]
): Promise<Record<string, number>> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return {};

  const ids = mandalIds
    ? await filterKnownMandalIds(mandalIds)
    : await getKnownMandalIds();
  if (ids.length === 0) return {};

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('crowd_device_cooldowns', {
    p_device_id: deviceId,
    p_mandal_ids: ids,
  });

  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.mandal_id, row.retry_after]));
}

/** Test seam — resets memoised state between cases. */
export function resetCrowdServiceForTesting() {
  inFlight = null;
  lastGood = null;
  mandalIdCache = null;
}


/* =====================================================================
   Admin explainer
   ===================================================================== */

export interface MandalExplain {
  mandalId: string;
  status: CrowdStatus;
  breakdown: ScoreBreakdown;
  /** Distinct devices behind the reports, which gates whether a status shows. */
  devices: number;
}

/**
 * Every mandal's reading with the arithmetic that produced it.
 *
 * Admin-only and deliberately uncached: it exists to answer "why is this
 * mandal this colour right now", and a fifteen-second-old answer to that
 * question is a different question.
 *
 * It reads the same rows and calls the same `scoreBreakdown` the live
 * path does — an explainer that recomputes separately can disagree with
 * the page it explains, and nobody would notice which one was wrong.
 *
 * Dwell is read here regardless of CROWD_DWELL_PUBLIC, so an admin can
 * see what the signal WOULD contribute before deciding to switch it on.
 * The `dwellCounted` flag says whether it is actually weighing.
 */
export async function getCrowdExplain(): Promise<{
  mandals: MandalExplain[];
  dwellCounted: boolean;
  computedAt: string;
} | null> {
  const ids = await getKnownMandalIds();
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.rpc('crowd_active_reports', { p_mandal_ids: ids });
  if (error || !data) return null;

  const since = new Date(Date.now() - DWELL_WINDOW_MINUTES * 60_000).toISOString();
  const { data: dwellRows } = await supabase
    .from('crowd_dwell_samples')
    .select('mandal_id, dwell, created_at')
    .in('mandal_id', ids)
    .gte('created_at', since)
    .limit(5_000);

  const dwellCounted = process.env.CROWD_DWELL_PUBLIC === '1';
  const dwellByMandal: Record<string, DwellInput[]> = {};
  for (const row of dwellRows ?? []) {
    (dwellByMandal[row.mandal_id] ??= []).push({ dwell: row.dwell, createdAt: row.created_at });
  }

  const reportsByMandal = new Map<string, CrowdReportInput[]>();
  for (const id of ids) reportsByMandal.set(id, []);
  for (const row of data) {
    reportsByMandal.get(row.mandal_id)?.push({
      mandalId: row.mandal_id,
      status: row.status,
      createdAt: row.created_at,
      atMandal: row.at_mandal ?? false,
      deviceSeq: row.device_seq ?? undefined,
    });
  }

  const now = Date.now();
  const mandals = ids.map((mandalId) => {
    const reports = reportsByMandal.get(mandalId) ?? [];
    const samples = dwellByMandal[mandalId] ?? [];
    const aged = reports
      .map((r) => ({
        status: r.status,
        ageMinutes: (now - Date.parse(r.createdAt)) / 60_000,
        atMandal: r.atMandal,
        deviceSeq: r.deviceSeq,
      }))
      .filter((r) => Number.isFinite(r.ageMinutes) && r.ageMinutes <= ACTIVE_WINDOW_MINUTES);

    return {
      mandalId,
      // The live answer, computed exactly as the API computes it — dwell
      // included only when it is actually switched on.
      status: aggregateMandal(mandalId, reports, now, dwellCounted ? samples : []),
      breakdown: scoreBreakdown(aged, samples, now),
      devices: new Set(aged.map((r, i) => r.deviceSeq ?? -(i + 1))).size,
    };
  });

  return { mandals, dwellCounted, computedAt: new Date(now).toISOString() };
}
