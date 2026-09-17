import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The admin override.
 *
 * It is the one thing in this feature that is not evidence, so what
 * matters is not arithmetic but that its edges hold: it expires, it is
 * attributable, it cannot be reached without an admin session, and it
 * never touches the aggregation it overrules.
 */

const sql = readFileSync(
  'supabase/migrations/20260914180000_crowd_admin_overrides.sql',
  'utf8'
);
const service = readFileSync('src/services/crowd/crowd-service.ts', 'utf8');
const route = readFileSync('src/app/api/admin/crowd-override/route.ts', 'utf8');
const aggregation = readFileSync('src/services/crowd/crowd-aggregation.ts', 'utf8');

describe('it expires on its own', () => {
  it('stores an expiry and never reads a row past it', () => {
    expect(sql).toContain('expires_at timestamptz not null');
    expect(sql).toContain('o.expires_at > now()');
  });

  it('holds for thirty minutes and re-arms after fifteen', () => {
    expect(sql).toContain("p_hold      interval default '30 minutes'");
    expect(sql).toContain("p_cooldown  interval default '15 minutes'");
  });

  it('enforces the cooldown in the database, not the browser', () => {
    // The client greys a button; only this decides.
    expect(sql).toContain("'reason', 'cooldown'");
    expect(sql).toContain('v_last > now() - p_cooldown');
  });

  it('clears by expiring the row rather than deleting it', () => {
    expect(sql).toContain('set expires_at = now()');
    expect(sql).not.toMatch(/delete\s+from\s+crowd_admin_overrides/i);
  });
});

describe('it is attributable', () => {
  it('records who set it, and requires it', () => {
    expect(sql).toContain('set_by     text not null');
    // Set in the route, where the session is, and passed down.
    expect(route).toContain('actor: user.email');
    expect(service).toContain('p_actor: input.actor');
  });
});

describe('it cannot be reached without an admin session', () => {
  it('re-checks the session in the route itself', () => {
    expect(route).toContain('getSessionUser()');
    expect(route).toContain('user?.isAdmin');
  });

  it('answers a non-admin with 404 rather than 403', () => {
    // A route only one account may use should not confirm it exists.
    expect(route).toContain('status: 404');
  });

  it('grants the write functions to service_role only', () => {
    expect(sql).toContain('grant execute on function set_crowd_override(uuid, text, text, interval, interval) to service_role;');
    expect(sql).not.toMatch(/set_crowd_override[^;]*to anon/);
  });
});

describe('it sits above the algorithms, not inside them', () => {
  it('never enters the aggregation', () => {
    // Asserted on the identifiers rather than the word, which appears in
    // ordinary prose there ("dilute, tip or override a report").
    expect(aggregation).not.toContain('crowd_admin_overrides');
    expect(aggregation).not.toContain('applyOverride');
    expect(aggregation).not.toMatch(/\boverrides\b/);
  });

  it('is applied after the snapshot is computed', () => {
    expect(service).toContain('const computed = aggregateSnapshot(');
    expect(service).toContain('overrides[s.mandalId] ? applyOverride(');
  });

  it('reads as an ordinary report of the same level', () => {
    // It used to carry its own sentence naming the team, to avoid Lane
    // A's "Devotees report" claiming several people where this is one.
    // Owner's decision to drop that: to a visitor this IS the reading,
    // and every surface already shows WHEN it was asserted, so freshness
    // is shown rather than announced.
    // The sentence now comes from labelFor, the same source an ordinary
    // report's does, so the two cannot drift into saying different things
    // about the same level.
    expect(service).toContain('const { label, detail } = labelFor(override.status)');
    // Only the comment explaining why it was dropped may still mention it.
    const fn = service.slice(
      service.indexOf('function applyOverride'),
      service.indexOf('function applyOverride') + 2000
    );
    expect(fn).not.toContain("detail: 'Reported by");
  });

  it('still carries the moment it was asserted, so "1 min ago" is true', () => {
    // The whole reason the panel can drop the attribution: lastUpdated is
    // the assertion time, not the snapshot clock, so the relative time a
    // visitor reads is the real age of the check.
    expect(service).toContain('lastUpdated: override.createdAt');
  });

  it('does not inflate the report count', () => {
    // applyOverride spreads the computed status and overwrites only what
    // the assertion actually changes; reportCount is not in that list.
    const fn = service.slice(
      service.indexOf('function applyOverride'),
      service.indexOf('async function computeSnapshot')
    );
    expect(fn).not.toContain('reportCount:');
  });

  it('invalidates the cache so it applies at once', () => {
    expect(service).toContain('await getCrowdCache().invalidate(input.mandalId)');
  });
});
