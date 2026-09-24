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

export type ProcessionStatus = 'moving' | 'finished' | 'waiting';

export interface TrackedMandal {
  name: string;
  status: ProcessionStatus;
  /** Where the police last saw it, in their words. */
  address: string | null;
  lat: number;
  lng: number;
  /** IST, as they publish it. */
  updatedAt: string;
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
 * Names that are not names.
 *
 * The feed pre-populates a row per tracking device and fills the name in
 * later, so before the day starts every row is a placeholder. These are
 * the ones actually observed; anything under two characters is treated
 * the same way on the principle that no mandal is called "x".
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
  try {
    const res = await fetch(ENDPOINT, {
      headers: { 'User-Agent': 'ganpatipune.in (public-service map)' },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (error) {
    // Their outage is not ours to dramatise: the page keeps its link.
    console.error('[visarjan-tracking] police feed unreachable:', error);
    return EMPTY;
  }

  if (!Array.isArray(raw)) return EMPTY;

  const mandals: TrackedMandal[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!isRealName(r.name)) continue;

    const status = toStatus(r.icon_type);
    if (!status) continue;

    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const address = typeof r.address === 'string' && r.address.trim() ? r.address.trim() : null;
    mandals.push({
      name: String(r.name).trim(),
      status,
      address,
      lat,
      lng,
      updatedAt: String(r.updated_at ?? ''),
    });
  }

  if (mandals.length === 0) return EMPTY;

  const counts = { moving: 0, finished: 0, waiting: 0 } as Record<ProcessionStatus, number>;
  for (const m of mandals) counts[m.status] += 1;

  const times = mandals.map((m) => parseIst(m.updatedAt)).filter((t): t is number => t !== null);
  const newest = times.length ? Math.max(...times) : null;

  return {
    ready: true,
    // Moving first: on the day that is the half of the list worth reading.
    mandals: mandals.sort(
      (a, b) =>
        rank(a.status) - rank(b.status) || a.name.localeCompare(b.name, 'en')
    ),
    counts,
    lastUpdated: newest === null ? null : new Date(newest).toISOString(),
    stale: newest !== null && Date.now() - newest > STALE_AFTER_MINUTES * 60_000,
  };
}

const rank = (s: ProcessionStatus) => (s === 'moving' ? 0 : s === 'waiting' ? 1 : 2);
