import {
  VISARJAN_TIMELINE, MANDAL_ROUTE_SCHEDULES,
} from '@/content/visarjan';

/**
 * Every published visarjan time, merged into one chronological list.
 *
 * ---------------------------------------------------------------------
 * Why merged rather than grouped by mandal.
 *
 * On the day the reader's question is anchored to the clock, not to a
 * mandal: someone standing on Kelkar Road at two o'clock wants to know
 * what is coming past in the next hour, and a list they have to open
 * mandal by mandal cannot answer that at all.
 *
 * Merging also absorbs how ragged the sources are. Kasba published ten
 * checkpoints, Guruji Talim published one line, and in a single ordered
 * list that is simply ten rows and one row. Grouped behind a control per
 * mandal, opening the one-line mandal looks like a page that failed.
 *
 * The rows carry their mandal and their source, so the merge never hides
 * which of them the police said and which the mandal said.
 */

export interface TimingRow {
  /** Minutes past midnight IST of the START time, for ordering. */
  minutes: number;
  /** The time as published — a range stays a range. */
  time: string;
  /** Short mandal name, or null for a citywide entry. */
  mandal: string | null;
  slug?: string;
  what: string;
  /** The place name in Devanagari, where the source printed one. */
  whatMr?: string;
  source: 'police' | 'mandal';
}

/**
 * Minutes past midnight for "09:30", or for the start of "07:00 – 07:30".
 *
 * Returns null rather than 0 on anything unparseable: a row that sorts to
 * midnight would sit at the top of the day claiming to be the first thing
 * that happens, which is a worse failure than the row going missing.
 */
export function startMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function mergedTimings(): TimingRow[] {
  const rows: TimingRow[] = [];

  for (const e of VISARJAN_TIMELINE) {
    const minutes = startMinutes(e.time);
    if (minutes === null) continue;
    rows.push({
      minutes,
      time: e.time,
      mandal: e.mandal ?? null,
      slug: e.slug,
      what: e.what,
      source: e.source,
    });
  }

  for (const sched of MANDAL_ROUTE_SCHEDULES) {
    for (const c of sched.checkpoints) {
      const minutes = startMinutes(c.time);
      if (minutes === null) continue;
      rows.push({
        minutes,
        time: c.time,
        mandal: shortName(sched.mandal),
        slug: sched.slug,
        what: c.place,
        whatMr: c.placeMr,
        source: 'mandal',
      });
    }
  }

  // Ties keep the police entry first: on a shared hour it is the one that
  // describes the whole city rather than one mandal in it.
  return rows.sort(
    (a, b) =>
      a.minutes - b.minutes ||
      (a.source === b.source ? 0 : a.source === 'police' ? -1 : 1)
  );
}

/** "Shri Kasba Ganpati" reads as "Kasba" in a row tag. */
function shortName(name: string): string {
  return name
    .replace(/^Shri(mant)?\s+/i, '')
    .replace(/\s+Ganpati$/i, '')
    .trim();
}

/** The mandals that have at least one row, in the order they first appear. */
export function mandalsWithTimings(rows: TimingRow[]): { name: string; slug?: string }[] {
  const seen = new Map<string, { name: string; slug?: string }>();
  for (const r of rows) {
    if (r.mandal && !seen.has(r.mandal)) seen.set(r.mandal, { name: r.mandal, slug: r.slug });
  }
  return [...seen.values()];
}
