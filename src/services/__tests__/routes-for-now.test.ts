import { describe, it, expect } from 'vitest';
import { routesForNow } from '@/services/routes';
import { localRoutes } from '@/services/catalogue';

/**
 * "Good for right now" has to mean right now.
 *
 * The homepage rail led with the routes suited to the hour and then padded
 * itself with whatever else was featured — so an evening dekhava trail sat
 * under that heading at nine in the morning, and a morning walk sat there
 * at one in the afternoon. The heading was making a claim the rail did not
 * keep.
 *
 * These check the two halves of the fix: that the slot is read from Pune's
 * clock, and that every hour has enough genuinely-suitable routes to fill
 * the rail without borrowing from another time of day.
 */
describe('routes for the time of day', () => {
  /** Noon in Pune on a fixed date, as an instant. */
  const atIst = (hour: number) =>
    new Date(Date.UTC(2026, 8, 16, hour - 5, -30, 0));

  const SLOTS: Array<[number, string]> = [
    [7, 'morning'],
    [13, 'afternoon'],
    [18, 'evening'],
    [22, 'night'],
  ];

  it('reads the hour in Pune, not wherever the server is', () => {
    for (const [hour, slot] of SLOTS) {
      const picked = routesForNow(localRoutes, atIst(hour));
      expect(picked.length, `nothing at ${hour}:00 IST`).toBeGreaterThan(0);
      // The slot's own routes are offered at its hour and at no other.
      const ownAt = (h: number) =>
        routesForNow(localRoutes, atIst(h)).filter((r) => r.timeOfDay === slot);
      expect(ownAt(hour).length, `no ${slot} route at ${hour}:00 IST`).toBeGreaterThan(0);
      for (const [other] of SLOTS.filter(([h]) => h !== hour)) {
        expect(ownAt(other), `${slot} routes offered at ${other}:00 IST`).toEqual([]);
      }
    }
  });

  /**
   * The route the owner asked to keep on top. It leads at every hour,
   * which is a property of the route — marked for any hour, first in
   * editorial order — and not of a rail that pins one card by name.
   */
  it('leads with the pinned route at every hour of the day', () => {
    for (const hour of [0, 7, 13, 18, 22, 23]) {
      const first = routesForNow(localRoutes, atIst(hour))[0];
      expect(first?.slug, `at ${hour}:00 IST`).toBe('dagdusheth-and-manache-paach');
    }
  });

  it('never offers a route meant for a different part of the day', () => {
    for (const [hour, slot] of SLOTS) {
      for (const r of routesForNow(localRoutes, atIst(hour))) {
        expect(['any', slot]).toContain(r.timeOfDay);
      }
    }
  });

  /**
   * The rail holds six. If a slot could not reach six from its own routes
   * plus the any-hour ones, the padding would have to come from some other
   * time of day again — so this is the condition the fix depends on.
   */
  it('can fill the rail at every hour without borrowing another slot', () => {
    const anyTime = localRoutes.filter((r) => r.timeOfDay === 'any');
    for (const [, slot] of SLOTS) {
      const own = localRoutes.filter((r) => r.timeOfDay === slot);
      expect(
        own.length + anyTime.length,
        `only ${own.length} routes for ${slot} and ${anyTime.length} for any hour`
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it('falls back to the any-hour routes rather than to nothing', () => {
    const onlyMorning = localRoutes.filter(
      (r) => r.timeOfDay === 'morning' || r.timeOfDay === 'any'
    );
    const atNight = routesForNow(onlyMorning, atIst(22));
    expect(atNight.length).toBeGreaterThan(0);
    for (const r of atNight) expect(r.timeOfDay).toBe('any');
  });

  it('keeps the rail in editorial order, not clock order', () => {
    // localRoutes arrives in sort_order; the picks must be a subsequence
    // of it, so what leads is the editorial decision and not the clock.
    const index = new Map(localRoutes.map((r, i) => [r.slug, i]));
    const picked = routesForNow(localRoutes, atIst(13)).map((r) => index.get(r.slug)!);
    expect([...picked].sort((a, b) => a - b)).toEqual(picked);
  });
});
