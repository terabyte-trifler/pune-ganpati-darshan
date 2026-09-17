import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync('src/app/api/analytics/route.ts', 'utf8');
const geo = readFileSync('src/hooks/useGeolocation.ts', 'utf8');
const traffic = readFileSync('src/app/admin/traffic/page.tsx', 'utf8');
const migration = readFileSync(
  'supabase/migrations/20260917200000_tighten_retention.sql', 'utf8'
);

/**
 * The allowlist entries, with comments stripped.
 *
 * The note explaining why location_fix was removed names it, so a plain
 * substring check on the array matched its own explanation. The guard is
 * about what the list CARRIES, not what its prose mentions.
 */
function allowedEvents(src: string): string {
  const list = src.slice(src.indexOf('EVENT_NAMES'), src.indexOf('] as const'));
  return list.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * location_fix reached 44,367 rows — 30% of analytics_events — and no
 * reader anywhere: traffic_origin_overview counts rows and sessions and
 * never filters by name. It was the largest single contributor to the one
 * quota in this project with a hard ceiling.
 *
 * Two locks, because one is not enough: the client stops sending it, and
 * the server refuses it, so a stale bundle sitting in somebody's cache
 * cannot quietly start filling the table again.
 */
describe('location_fix is no longer collected', () => {
  it('is not emitted by the client', () => {
    expect(geo).not.toContain("trackEvent('location_fix'");
    expect(geo).not.toContain('recordLocationTiming');
  });

  it('is refused by the server allowlist', () => {
    expect(allowedEvents(route)).not.toContain("'location_fix'");
  });

  it('keeps the events that are actually read', () => {
    const list = allowedEvents(route);
    for (const name of ['map_opened', 'ganpati_viewed', 'plan_optimized', 'search_performed']) {
      expect(list).toContain(`'${name}'`);
    }
  });
});

/**
 * Retention is what the admin page can SEE, not a preference. Rows older
 * than the cleanup window do not exist, so a page asking for more days
 * than are kept draws flat zero and reads as a collapse in traffic.
 */
describe('the admin window and the retention window agree', () => {
  it('both say five days', () => {
    expect(traffic).toContain('const WINDOW_DAYS = 5');
    expect(migration).toContain("p_retention          interval default '5 days'");
  });
});
