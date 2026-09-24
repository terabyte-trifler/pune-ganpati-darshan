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
  | {
      phase: 'during';
      day: number;
      totalDays: number;
      isVisarjan: boolean;
      /**
       * The small hours after visarjan, while the procession is still on its
       * way to the ghats. Callers that model a queue at a mandap must treat
       * this as "the idol has left", not as an ordinary late night.
       */
      isVisarjanNight: boolean;
    }
  | { phase: 'after' };

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hour (IST) at which the night after visarjan finally becomes the next day.
 *
 * The procession does not end at midnight: the big mandals reach the ghats
 * in the small hours, and the last of them well after dawn. Ending the
 * festival at 00:00 would put "Ganeshotsav has ended" on the screen of
 * someone standing on Laxmi Road watching it go past — and, because the
 * crowd prior only speaks during the festival, would silence every live
 * report at the same moment. The busiest hours on the site are 22:00–01:00,
 * so this boundary matters more than any other in this file.
 */
const VISARJAN_NIGHT_ENDS_IST_HOUR = 6;

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
  const start = istDateToUtcMs(config.startDate);
  const end = istDateToUtcMs(config.endDate);
  const visarjan = istDateToUtcMs(config.visarjanDate);

  const istDay = startOfIstDay(now);
  const istHour = Math.floor(((now.getTime() + IST_OFFSET_MS) % DAY_MS) / 3_600_000);

  // Before dawn, the night after visarjan still belongs to visarjan. Only
  // this one boundary moves: on every other night a visitor at 00:30 is
  // told the correct day, which is what the peth crowds themselves think.
  const isVisarjanNight =
    istDay === visarjan + DAY_MS && istHour < VISARJAN_NIGHT_ENDS_IST_HOUR;
  const today = isVisarjanNight ? visarjan : istDay;

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
    isVisarjanNight,
  };
}
