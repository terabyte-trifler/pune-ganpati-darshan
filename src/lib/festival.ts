import type { FestivalConfig } from '@/types/ganpati';

/**
 * Festival phase.
 *
 * Dates come from configuration (DB `festival_config`), never from the UI,
 * so a future year is a data change rather than a code change (§26).
 * All comparisons are made in IST: the festival's day boundary is local to
 * Pune, and a visitor in Pune at 00:30 must see the correct day.
 */

export type FestivalPhase =
  | { phase: 'before'; daysUntil: number }
  | { phase: 'during'; day: number; totalDays: number; isVisarjan: boolean }
  | { phase: 'after' };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-in-IST for a YYYY-MM-DD string, as a UTC timestamp. */
function istDateToUtcMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00.000Z`) - IST_OFFSET_MS;
}

/** Start of the current IST day, as a UTC timestamp. */
function startOfIstDay(now: Date): number {
  const shifted = now.getTime() + IST_OFFSET_MS;
  return Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export function getFestivalPhase(
  config: FestivalConfig,
  now: Date = new Date()
): FestivalPhase {
  const today = startOfIstDay(now);
  const start = istDateToUtcMs(config.startDate);
  const end = istDateToUtcMs(config.endDate);
  const visarjan = istDateToUtcMs(config.visarjanDate);

  if (today < start) {
    return { phase: 'before', daysUntil: Math.round((start - today) / DAY_MS) };
  }
  if (today > end) {
    return { phase: 'after' };
  }
  return {
    phase: 'during',
    day: Math.round((today - start) / DAY_MS) + 1,
    totalDays: Math.round((end - start) / DAY_MS) + 1,
    isVisarjan: today === visarjan,
  };
}
