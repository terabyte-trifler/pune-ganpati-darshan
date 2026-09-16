import type { TrafficOverview } from '@/services/traffic-admin';

/**
 * The traffic page at a scale it has not reached yet.
 *
 * For looking at the layout: whether the bars, the number formatting and
 * the panel headings still hold when the counts run to five figures. The
 * recorded week is a few thousand sessions, and a chart that reads well at
 * 2,818 can break at 14,000 — the numbers stop fitting, the long tail
 * collapses to a hairline, and nobody finds out until the festival.
 *
 * It is a MULTIPLIED VIEW OF THE REAL WEEK, not invented traffic. Every
 * city, referrer and peth is the one actually recorded, in the proportion
 * actually recorded; only the magnitude is moved. So it cannot claim the
 * app is used somewhere it is not, and it cannot be read as a measurement
 * either — the page it renders on says what it is, in the banner and in
 * the URL that asked for it.
 *
 * Percentages are left alone. onsiteShare is a share, and multiplying a
 * share by five is how a preview turns into a wrong number.
 */
export const SAMPLE_SESSIONS = 25_000;

const scale = (n: number, factor: number) => Math.round(n * factor);

export function scaleOverview(
  real: TrafficOverview,
  target = SAMPLE_SESSIONS
): TrafficOverview {
  // Nothing recorded yet: there is no shape to multiply, and inventing one
  // is exactly what this is meant not to do.
  if (real.sessions <= 0) return real;

  const factor = target / real.sessions;
  return {
    ...real,
    totalEvents: scale(real.totalEvents, factor),
    sessions: target,
    cities: real.cities.map((c) => ({ ...c, sessions: scale(c.sessions, factor) })),
    countries: real.countries.map((c) => ({ ...c, sessions: scale(c.sessions, factor) })),
    referrers: real.referrers.map((r) => ({ ...r, sessions: scale(r.sessions, factor) })),
    pethInterest: real.pethInterest.map((p) => ({
      ...p,
      views: scale(p.views, factor),
      sessions: scale(p.sessions, factor),
    })),
    pethPresence: real.pethPresence.map((p) => ({
      ...p,
      devices: scale(p.devices, factor),
      reports: scale(p.reports, factor),
    })),
    daily: real.daily.map((d) => ({ ...d, sessions: scale(d.sessions, factor) })),
    // A share does not scale.
    onsiteShare: real.onsiteShare,
  };
}
