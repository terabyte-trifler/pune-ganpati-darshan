import 'server-only';

/**
 * Live procession status, read from the Pune Police tracker.
 *
 * ---------------------------------------------------------------------
 * The rule this whole file is built around.
 *
 * The page has said from the start that a cached position is worse than
 * none, and that stays true. This is not a copy of their data: it is a
 * read-through with a 45-second life, so the worst a visitor sees is
 * three quarters of a minute old, and our origin asks the police for it
 * at most eighty times an hour no matter how many people are reading.
 * A government server should not feel our traffic.
 *
 * ---------------------------------------------------------------------
 * Why it can be built before the feed is usable.
 *
 * At three in the morning the feed carries forty-two devices sitting at
 * their mandals with no names on them — "." and "--" — and nothing has
 * moved since 19:18 the previous evening. Tracking opens at 9am.
 *
 * So everything here is written to show NOTHING rather than something
 * wrong. An entry without a real name is dropped, not rendered with its
 * placeholder. If no entry survives, the caller is told the feed is not
 * ready and the page keeps its link, exactly as before. If the names
 * never arrive, nobody sees forty-two dots called ".".
 */

const ENDPOINT = 'https://diversion.punepolice.gov.in/TrackPalkhiApi/vehicleTrackings';

/** Seconds a response is reused for. Their server, our restraint. */
const CACHE_SECONDS = 45;

/** Beyond this, a position is history rather than news. */
const STALE_AFTER_MINUTES = 25;

/**
 * How long we will wait for the police server, in milliseconds.
 *
 * Measured on visarjan morning: their API answered in 41 seconds and
 * their own site timed out altogether. Without a bound, every cache
 * miss here holds a serverless invocation open for that long — on the
 * busiest morning of the year, for a panel that is decoration next to
 * the closures and the timings.
 *
 * Six seconds is generous for a JSON list and short enough that a reader
 * never waits on someone else's outage. Past it we answer "not ready",
 * which is the same thing this file does for every other kind of
 * failure, and the page keeps the link to their tracker.
 */
const UPSTREAM_TIMEOUT_MS = 6_000;

export type ProcessionStatus = 'moving' | 'finished' | 'waiting';

export interface TrackedMandal {
  name: string;
  status: ProcessionStatus;
  /** Where the police last saw it, in their words. */
  address: string | null;
  lat: number;
  lng: number;
  /** IST, as they publish it. Not the freshness signal — see deviceMs. */
  updatedAt: string;
  /** When the tracker itself last reported, in epoch ms, or null. */
  deviceMs: number | null;
}

export interface TrackingSnapshot {
  /** False until the feed carries at least one named mandal. */
  ready: boolean;
  mandals: TrackedMandal[];
  counts: Record<ProcessionStatus, number>;
  /** The most recent update across the feed, or null. */
  lastUpdated: string | null;
  /** Their newest position is older than we are willing to present. */
  stale: boolean;
}

const EMPTY: TrackingSnapshot = {
  ready: false,
  mandals: [],
  counts: { moving: 0, finished: 0, waiting: 0 },
  lastUpdated: null,
  stale: false,
};

/**
 * The mandal's name lives in `popup_text`, not in `name`.
 *
 * This cost most of a day. `name` is blank or "." on every one of the
 * forty-two rows and always was; the fifteen mandals the police
 * actually track carry their Marathi name in `popup_text`, and the
 * other twenty-seven rows are unnamed vehicles that belong to no
 * mandal. Reading the obvious field made a working feed look dead.
 */
function mandalName(row: Record<string, unknown>): string | null {
  const popup = typeof row.popup_text === 'string' ? row.popup_text.trim() : '';
  if (popup) return popup;
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  return isRealName(name) ? name : null;
}

/**
 * When the device last spoke, from `description`.
 *
 * `updated_at` is not it. At 10:22, with Kasba an hour down Laxmi Road,
 * every `updated_at` read 04:52 while the same rows carried
 * "DATETIME:- 25-09-2026 10:21:56" in their description — the tracker's
 * own clock, current to the minute. Trusting the obvious column made a
 * live feed look five hours stale and kept the panel shut all morning.
 */
function deviceTime(row: Record<string, unknown>): number | null {
  const text = typeof row.description === 'string' ? row.description : '';
  const m = /DATETIME:-\s*(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const [, d, mo, y, h, mi, sec] = m.map(Number);
  // Their clock is IST, written without a zone.
  return Date.UTC(y, mo - 1, d, h, mi, sec) - 5.5 * 60 * 60 * 1000;
}

/**
 * Names that are not names.
 *
 * The feed pre-populates a row per tracking device and fills the name in
 * later. On visarjan morning it never did: at 10:15, with the
 * procession an hour under way, all forty-two rows were still "." and
 * "--".
 *
 * So a missing name no longer hides the row. An unnamed vehicle that is
 * genuinely moving still answers the question people are asking — where
 * has the miravnuk reached — and refusing to say anything because the
 * police did not fill in a text field was letting their data entry
 * decide what our readers get told.
 */
function isRealName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const name = value.trim();
  if (name.length < 3) return false;
  return !/^[.\-_\s]+$/.test(name);
}


function toStatus(iconType: unknown): ProcessionStatus | null {
  switch (String(iconType).toUpperCase()) {
    case 'ON_THE_MOVE':
      return 'moving';
    case 'COMPLETED':
    case 'END':
      return 'finished';
    case 'YET_TO_START':
    case 'START':
      return 'waiting';
    default:
      // An unknown status is not a fourth category to invent a label for.
      return null;
  }
}

/** "2026-09-25 09:12:03" is IST; parsed as such rather than as UTC. */
function parseIst(value: unknown): number | null {
  const text = String(value ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s) - 5.5 * 60 * 60 * 1000;
}

export async function getTrackingSnapshot(): Promise<TrackingSnapshot> {
  let raw: unknown;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      headers: { 'User-Agent': 'ganpatipune.in (public-service map)' },
      next: { revalidate: CACHE_SECONDS },
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (error) {
    // Their outage is not ours to dramatise: the page keeps its link.
    console.error('[visarjan-tracking] police feed unreachable:', error);
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }

  if (!Array.isArray(raw)) return EMPTY;

  const mandals: TrackedMandal[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;

    // Only the mandals. The other rows are tracking devices with no
    // mandal against them, and a list of those answers nothing.
    const name = mandalName(r);
    if (!name) continue;

    const status = toStatus(r.icon_type);
    if (!status) continue;

    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const address = typeof r.address === 'string' && r.address.trim() ? r.address.trim() : null;
    mandals.push({
      name,
      status,
      address,
      lat,
      lng,
      updatedAt: String(r.updated_at ?? ''),
      deviceMs: deviceTime(r),
    });
  }

  if (mandals.length === 0) return EMPTY;

  const counts = { moving: 0, finished: 0, waiting: 0 } as Record<ProcessionStatus, number>;
  for (const m of mandals) counts[m.status] += 1;

  const times = mandals
    .map((m) => m.deviceMs ?? parseIst(m.updatedAt))
    .filter((t): t is number => t !== null);
  const newest = times.length ? Math.max(...times) : null;

  /**
   * Freshness decides whether any of this is shown, not names.
   *
   * A position the police recorded before dawn is the thing this file
   * exists to refuse: at 10:15 on visarjan morning the newest row was
   * from 04:44, so drawing it would have put the procession a couple of
   * kilometres behind where it actually was. Stale is no longer a badge
   * on a panel that shows anyway — it closes the panel.
   */
  const isStale = newest === null || Date.now() - newest > STALE_AFTER_MINUTES * 60_000;

  /**
   * Stale positions do not leave the server.
   *
   * Answering `ready: false` while still sending the rows left a
   * five-hour-old position sitting in every browser's response, correct
   * only because one component happened to check a flag before using
   * it. The next caller would not have known to. If it is too old to
   * draw, it is too old to hand out.
   */
  if (isStale) return { ...EMPTY, stale: true, lastUpdated: newest === null ? null : new Date(newest).toISOString() };

  return {
    ready: true,
    // Moving first: on the day that is the half of the list worth reading.
    mandals: mandals.sort(
      (a, b) =>
        rank(a.status) - rank(b.status) || a.name.localeCompare(b.name, 'en')
    ),
    counts,
    lastUpdated: newest === null ? null : new Date(newest).toISOString(),
    stale: isStale,
  };
}

const rank = (s: ProcessionStatus) => (s === 'moving' ? 0 : s === 'waiting' ? 1 : 2);
