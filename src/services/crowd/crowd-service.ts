import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';
import { clientIpFrom, hashIp } from '@/lib/client-ip';
import { getAllGanpatis } from '@/services/ganpati';
import { paceZones } from '@/features/crowd/pace';
import { redThresholdFor } from '@/content/crowd-thresholds';
import {
  aggregateSnapshot, aggregateMandal, labelFor, dwellCeilingSeconds,
} from './crowd-aggregation';
import { summariseDwell, DWELL_WINDOW_MINUTES, type DwellSummary } from './crowd-dwell';
import {
  scoreBreakdown, ACTIVE_WINDOW_MINUTES,
  type DwellInput, type WaitInput, type ScoreBreakdown,
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

/**
 * Seconds to walk clean through each mandal's dwell zone.
 *
 * Derived here, from the catalogue, rather than taken from the client.
 * It decides how much of a visit was walking and how much was waiting,
 * which now decides what colour a mandal can take — so a number the
 * client chooses would be a number an attacker chooses.
 *
 * Same geometry the device uses to decide it is inside a zone, from the
 * same pure function, so the two cannot drift apart.
 */
interface ZoneFacts {
  /** Seconds to walk clean through the zone. */
  crossing: number;
  /** Seconds beyond which a visit is a parked phone, not a queue. */
  ceiling: number;
}

let crossingCache: { byId: Record<string, ZoneFacts>; at: number } | null = null;

/**
 * When each mandal may read heavy, by id.
 *
 * Built over every mandal rather than every pace zone — four mandals have
 * no zone because they stand too close to a neighbour to be told apart,
 * and they still take reports and still need a threshold. Hanging this
 * off ZoneFacts would have silently given those four the flat default
 * while appearing to be per-mandal.
 */
async function getRedThresholds(): Promise<Record<string, number>> {
  const ganpatis = await getAllGanpatis();
  const byId: Record<string, number> = {};
  for (const g of ganpatis) byId[g.id] = redThresholdFor(g.slug);
  return byId;
}

async function getZoneFacts(): Promise<Record<string, ZoneFacts>> {
  const now = Date.now();
  if (crossingCache && now - crossingCache.at < MANDAL_ID_TTL_MS) return crossingCache.byId;
  const ganpatis = await getAllGanpatis();
  const peak = new Map(ganpatis.map((g) => [g.id, g.peakDarshanMinutes]));
  const byId: Record<string, ZoneFacts> = {};
  for (const zone of paceZones(
    ganpatis.map((g) => ({
      id: g.id,
      lat: g.location.lat,
      lng: g.location.lng,
      prominence: g.prominence,
    }))
  )) {
    byId[zone.mandalId] = {
      crossing: zone.crossingS,
      // From the mandal's own curated peak: Dagdusheth may run to two
      // hours, Kasba may not. See dwellCeilingSeconds.
      ceiling: dwellCeilingSeconds(peak.get(zone.mandalId) ?? null),
    };
  }
  crossingCache = { byId, at: now };
  return byId;
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
      .select('mandal_id, dwell, dwell_seconds, is_final, created_at, device_key')
      .in('mandal_id', ids)
      .gte('created_at', since)
      .limit(5_000);
    if (error || !data) return {};

    const zones = await getZoneFacts();
    const out: Record<string, DwellInput[]> = {};
    for (const row of data) {
      (out[row.mandal_id] ??= []).push({
        dwell: row.dwell,
        createdAt: row.created_at,
        deviceKey: row.device_key,
        dwellSeconds: row.dwell_seconds,
        isFinal: row.is_final,
        crossingSeconds: zones[row.mandal_id]?.crossing,
        maxPlausibleSeconds: zones[row.mandal_id]?.ceiling,
      });
    }
    return out;
  } catch {
    return {};
  }
}


/**
 * Reported wait times per mandal, in the live window.
 *
 * Unlike dwell this is not behind a switch: a wait time is somebody's own
 * report, the same kind of thing as a colour, and there was never a
 * question about whether to show it. Failure returns {} so the crowd
 * snapshot survives a wait-table problem.
 */
async function readWaitReports(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  ids: string[]
): Promise<Record<string, WaitInput[]>> {
  try {
    const { data, error } = await supabase.rpc('crowd_wait_reports_recent', {
      p_mandal_ids: ids,
    });
    if (error || !data) return {};
    const out: Record<string, WaitInput[]> = {};
    for (const row of data) {
      (out[row.mandal_id] ??= []).push({
        minutes: row.minutes,
        createdAt: row.created_at,
      });
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Admin overrides still in force, keyed by mandal.
 *
 * Deliberately NOT behind a feature flag and deliberately not part of the
 * aggregation: this is not evidence to be weighed, it is a person with
 * the app's own account saying "show this". It is applied last, on top of
 * whatever the algorithms decided, and it expires on its own.
 *
 * Failure returns {} — an override system that can take down the crowd
 * snapshot is worse than one that occasionally does not apply.
 */
async function readOverrides(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  ids: string[]
): Promise<
  Record<string, { status: CrowdLevel; setBy: string; createdAt: string; expiresAt: string }>
> {
  try {
    const { data, error } = await supabase.rpc('crowd_active_overrides', {
      p_mandal_ids: ids,
    });
    if (error || !data) return {};
    const out: Record<
      string,
      { status: CrowdLevel; setBy: string; createdAt: string; expiresAt: string }
    > = {};
    for (const row of data) {
      out[row.mandal_id] = {
        status: row.status as CrowdLevel,
        setBy: row.set_by,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Replace a reading with what the admin asserted.
 *
 * The wording matters as much as the colour. Lane A says "Devotees
 * report", and an override is not devotees — it is one named person. So
 * it gets its own sentence, and `source` records what it is, while the
 * label stays the ordinary one because to a visitor it IS the reading.
 *
 * `reportCount` is left at what the evidence actually was, not inflated
 * to make the override look corroborated. The confidence is high because
 * somebody with the account went and looked; if that turns out to be a
 * habit of asserting from home, this is the number to revisit.
 */
function applyOverride(
  status: CrowdStatus,
  override: { status: CrowdLevel; setBy: string; createdAt: string; expiresAt: string }
): CrowdStatus {
  const { label } = labelFor(override.status);
  return {
    ...status,
    status: override.status,
    label,
    // "Reported", by the owner's decision — a person did go and look.
    // Not "devotees report", though: that is Lane A's wording and it
    // means several people, where this is one.
    detail: 'Reported by the Pune Ganpati Darshan team',
    source: 'override',
    confidence: 'high',
    trend: 'unknown',
    // When it was ASSERTED, not when this snapshot was built. Using the
    // clock here made every override read "just now" for its whole
    // half-hour, because the snapshot recomputes every fifteen seconds —
    // so a value set twenty-five minutes ago looked freshly checked.
    lastUpdated: override.createdAt,
  };
}

async function computeSnapshot(): Promise<CrowdSnapshot> {
  const ids = await getKnownMandalIds();

  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new CrowdUnavailableError();
  }

  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient();

  /**
   * All four lanes at once.
   *
   * The reports RPC used to be awaited on its own before the other three
   * were fetched, which made four sequential round trips out of four
   * independent queries. They read different tables for the same ids and
   * none of them needs another's result.
   */
  const [reportsResult, dwellSamples, waitSamples, overrides, redThresholds] =
    await Promise.all([
      supabase.rpc('crowd_active_reports', { p_mandal_ids: ids }),
      readDwellSamples(supabase, ids),
      readWaitReports(supabase, ids),
      readOverrides(supabase, ids),
      // Reads the cached catalogue, so it joins the batch rather than
      // adding a round trip.
      getRedThresholds(),
    ]);
  const { data, error } = reportsResult;
  recordCrowdMetric('crowd_db_latency', Date.now() - startedAt);

  if (error || !data) {
    console.error('[crowd] snapshot failed', {
      code: error?.code,
      message: error?.message,
    });
    recordCrowdMetric('crowd_error', 1);
    throw new CrowdUnavailableError();
  }

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
  const computed = aggregateSnapshot(
    ids, reports, now, dwellSamples, waitSamples, redThresholds
  );
  // Last, and above everything. An override does not join the weighing —
  // it replaces the result of it.
  const statuses = computed.map((s) =>
    overrides[s.mandalId] ? applyOverride(s, overrides[s.mandalId]) : s
  );

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

/**
 * Recompute ONE mandal, freshly, and warm its cache entry.
 *
 * The vote path's fix. It used to call getCrowdStatus after writing,
 * which reads the whole-city snapshot — and because the write had just
 * invalidated that mandal's cache entry, the "every mandal warm" check
 * failed and the entire city was recomputed from the database before the
 * voter got a reply. One tap, twenty-nine mandals, four round trips.
 *
 * Measured before: 2.04s median for a vote, of which almost all was this.
 *
 * So the write path now recomputes only the mandal that changed, with
 * its four reads issued together, and SETS the result rather than
 * clearing it — which also means no other reader is pushed into a full
 * recompute by somebody else's vote.
 *
 * Returns null rather than throwing: a vote that was accepted must still
 * be reported as accepted even if the follow-up read fails. The client
 * then falls back to its next poll.
 */
export async function recomputeMandal(mandalId: string): Promise<CrowdStatus | null> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const known = await filterKnownMandalIds([mandalId]);
  if (known.length === 0) return null;

  try {
    const supabase = getSupabaseAdminClient();
    const ids = [mandalId];
    const startedAt = Date.now();

    const [reportsResult, dwellSamples, waitSamples, overrides, redThresholds] =
      await Promise.all([
        supabase.rpc('crowd_active_reports', { p_mandal_ids: ids }),
        readDwellSamples(supabase, ids),
        readWaitReports(supabase, ids),
        readOverrides(supabase, ids),
        getRedThresholds(),
      ]);
    recordCrowdMetric('crowd_db_latency', Date.now() - startedAt);

    const rows = reportsResult.data;
    if (reportsResult.error || !rows) return null;

    const reports: CrowdReportInput[] = rows.map((row) => ({
      mandalId: row.mandal_id,
      status: row.status,
      createdAt: row.created_at,
      atMandal: row.at_mandal ?? false,
      deviceSeq: row.device_seq ?? undefined,
      deviceAgeSeconds: row.device_age_seconds ?? null,
    }));

    const computed = aggregateMandal(
      mandalId,
      reports,
      Date.now(),
      dwellSamples[mandalId] ?? [],
      waitSamples[mandalId] ?? [],
      redThresholds[mandalId]
    );
    const status = overrides[mandalId]
      ? applyOverride(computed, overrides[mandalId])
      : computed;

    // Warm rather than clear. A cleared entry makes the next reader pay
    // for a full-city recompute; a warm one costs them nothing.
    await getCrowdCache().set(mandalId, status, CROWD_CACHE_TTL_SECONDS);
    return status;
  } catch {
    return null;
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
  crossingCache = null;
}


/* =====================================================================
   Admin explainer
   ===================================================================== */

export interface MandalExplain {
  mandalId: string;
  status: CrowdStatus;
  /**
   * The same mandal scored from human reports only. Comparing it with
   * `status` is how the admin sees whether dwell changed the colour.
   */
  humanOnly: CrowdStatus;
  breakdown: ScoreBreakdown;
  /** Distinct devices behind the reports, which gates whether a status shows. */
  devices: number;
}

/**
 * Record how long somebody waited.
 *
 * Thin wrapper over the RPC, which owns every rule — the cooldown, the
 * per-device cap, the IP throttle and the block list — exactly as the
 * colour report does. Nothing here decides anything.
 */
export async function submitWaitReport(input: {
  mandalId: string;
  deviceId: string;
  minutes: number;
  requestId?: string;
  ip?: string | null;
}): Promise<CrowdSubmitResult & { minutes?: number }> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, reason: 'unavailable' };
  }
  const known = await filterKnownMandalIds([input.mandalId]);
  if (known.length === 0) return { success: false, reason: 'invalid_request' };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('submit_wait_report', {
    p_mandal_id: input.mandalId,
    p_device_id: input.deviceId,
    p_minutes: input.minutes,
    p_request_id: input.requestId ?? null,
    p_ip_hash: input.ip ? hashIp(input.ip) : null,
  });

  if (error || !data) {
    recordCrowdMetric('crowd_error', 1);
    return { success: false, reason: 'unavailable' };
  }

  const result = data as {
    success: boolean; reason?: string; minutes?: number; idempotent?: boolean;
    retryAfter?: number;
  };
  if (result.success) {
    // A wait report changes this mandal's reading, so the cached status
    // must go — same as a colour report.
    await getCrowdCache().invalidate(input.mandalId);
    return { success: true, status: 'moving', idempotent: Boolean(result.idempotent), minutes: result.minutes };
  }
  return {
    success: false,
    reason: (result.reason ?? 'unavailable') as 'cooldown' | 'rate_limited' | 'reporting_disabled' | 'invalid_request' | 'unavailable',
    retryAfter: result.retryAfter ?? 0,
  } as CrowdSubmitResult;
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

  /**
   * Four reads, issued together.
   *
   * This was four sequential awaits, which on the admin's slowest page
   * meant four round trips stacked on top of the two the session check
   * already costs. None of them depends on another — same fix as the
   * public snapshot path, which had the same shape.
   */
  const since = new Date(Date.now() - DWELL_WINDOW_MINUTES * 60_000).toISOString();
  const [reportsResult, dwellResult, waitByMandal, explainCrossing, redThresholds] =
    await Promise.all([
      supabase.rpc('crowd_active_reports', { p_mandal_ids: ids }),
      supabase
        .from('crowd_dwell_samples')
        .select('mandal_id, dwell, dwell_seconds, is_final, created_at, device_key')
        .in('mandal_id', ids)
        .gte('created_at', since)
        .limit(5_000),
      readWaitReports(supabase, ids),
      getZoneFacts(),
      getRedThresholds(),
    ]);

  const { data, error } = reportsResult;
  if (error || !data) return null;
  const dwellRows = dwellResult.data;
  const dwellCounted = process.env.CROWD_DWELL_PUBLIC === '1';
  const dwellByMandal: Record<string, DwellInput[]> = {};
  for (const row of dwellRows ?? []) {
    (dwellByMandal[row.mandal_id] ??= []).push({
      dwell: row.dwell,
      createdAt: row.created_at,
      deviceKey: row.device_key,
      dwellSeconds: row.dwell_seconds,
      isFinal: row.is_final,
      crossingSeconds: explainCrossing[row.mandal_id]?.crossing,
      maxPlausibleSeconds: explainCrossing[row.mandal_id]?.ceiling,
    });
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
    const waits = waitByMandal[mandalId] ?? [];
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
      // included only when it is actually switched on, and on the same
      // per-mandal red threshold. An admin screen that explains a colour
      // the public page is not showing is worse than no admin screen.
      status: aggregateMandal(
        mandalId, reports, now, dwellCounted ? samples : [], waits,
        redThresholds[mandalId]
      ),
      humanOnly: aggregateMandal(
        mandalId, reports, now, [], waits, redThresholds[mandalId]
      ),
      breakdown: scoreBreakdown(aged, samples, now, waits),
      devices: new Set(aged.map((r, i) => r.deviceSeq ?? -(i + 1))).size,
    };
  });

  return { mandals, dwellCounted, computedAt: new Date(now).toISOString() };
}


/* =====================================================================
   Admin override — write path
   ===================================================================== */

export interface OverrideResult {
  success: boolean;
  reason?: 'cooldown' | 'invalid_request' | 'unavailable';
  retryAfter?: number;
  expiresAt?: string;
}

/**
 * Assert a queue level for one mandal, above every algorithm.
 *
 * Authorization is NOT here. The caller must already have established
 * that the session belongs to an admin — that check needs the request's
 * cookies and belongs in the route. What is here is the cooldown, which
 * has to be atomic and therefore has to be in the database.
 *
 * `actor` is recorded on the row. An override is the one place a person
 * overrules the evidence, so it is never anonymous.
 */
export async function setCrowdOverride(input: {
  mandalId: string;
  status: CrowdLevel;
  actor: string;
}): Promise<OverrideResult> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, reason: 'unavailable' };
  }
  const known = await filterKnownMandalIds([input.mandalId]);
  if (known.length === 0) return { success: false, reason: 'invalid_request' };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('set_crowd_override', {
    p_mandal_id: input.mandalId,
    p_status: input.status,
    p_actor: input.actor,
  });

  if (error || !data) {
    console.error('[crowd] override failed', { code: error?.code, message: error?.message });
    return { success: false, reason: 'unavailable' };
  }

  const result = data as OverrideResult;
  // Straight through the 15-second cache, so the map changes on the next
  // poll rather than up to fifteen seconds later. The whole point of an
  // override is that somebody is standing there wanting it fixed now.
  if (result.success) await getCrowdCache().invalidate(input.mandalId);
  return result;
}

/** Expire an override early. Idempotent: clearing nothing is a success. */
export async function clearCrowdOverride(mandalId: string): Promise<OverrideResult> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, reason: 'unavailable' };
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc('clear_crowd_override', { p_mandal_id: mandalId });
  if (error) return { success: false, reason: 'unavailable' };
  await getCrowdCache().invalidate(mandalId);
  return { success: true };
}

/** Every override still in force, for the admin surface. */
export async function getActiveOverrides(): Promise<
  Record<string, { status: CrowdLevel; setBy: string; createdAt: string; expiresAt: string }>
> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return {};
  const ids = await getKnownMandalIds();
  return readOverrides(getSupabaseAdminClient(), ids);
}

/**
 * When each mandal may next be overridden, in seconds. Absent means now.
 *
 * Purely so the admin page can grey a button instead of offering one the
 * database will refuse.
 */
export async function getOverrideCooldowns(): Promise<Record<string, number>> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return {};
  const supabase = getSupabaseAdminClient();
  const since = new Date(Date.now() - OVERRIDE_COOLDOWN_MS).toISOString();
  const { data, error } = await supabase
    .from('crowd_admin_overrides')
    .select('mandal_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (error || !data) return {};

  const out: Record<string, number> = {};
  for (const row of data) {
    if (out[row.mandal_id] !== undefined) continue;
    const ready = Date.parse(row.created_at) + OVERRIDE_COOLDOWN_MS;
    const seconds = Math.ceil((ready - Date.now()) / 1000);
    if (seconds > 0) out[row.mandal_id] = seconds;
  }
  return out;
}

/** Mirrors p_cooldown in the migration. Display only; the database decides. */
export const OVERRIDE_COOLDOWN_MS = 15 * 60_000;
/** Mirrors p_hold. Display only. */
export const OVERRIDE_HOLD_MS = 30 * 60_000;
