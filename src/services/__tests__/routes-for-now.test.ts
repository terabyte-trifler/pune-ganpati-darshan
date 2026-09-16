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
      for (const r of picked) {
        expect(r.timeOfDay, `${r.slug} offered at ${hour}:00 IST`).toBe(slot);
      }
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
    for (const [hour, slot] of SLOTS) {
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
});
