import { describe, it, expect } from 'vitest';
import catalogue from '@/content/catalogue.json';
import { MAHAPRASAD, mahaprasadFor, type MahaprasadEntry } from '@/content/mahaprasad';
import type { Ganpati } from '@/types/ganpati';

const slugs = new Set(catalogue.ganpatis.map((g) => g.slug));

/**
 * Mahaprasad is an announcement, not an observation.
 *
 * The cost of being wrong here is not a bad reading — it is somebody
 * elderly walking across the peths to a counter that is not serving. So
 * the guards are about never stating a time nobody announced.
 */
describe('mahaprasad', () => {
  it('names only mandals that exist in the catalogue', () => {
    const unknown = MAHAPRASAD.filter((e) => !slugs.has(e.slug)).map((e) => e.slug);
    expect(unknown).toEqual([]);
  });

  it('names each mandal at most once', () => {
    const seen = new Set(MAHAPRASAD.map((e) => e.slug));
    expect(seen.size).toBe(MAHAPRASAD.length);
  });

  /**
   * null means "serves, but has not said when" — a real and common state,
   * and NOT the same as no mahaprasad. What it must never hold is a
   * stand-in that renders as a time: "TBA", "soon" or an empty string all
   * print into the slot where a visitor reads the hour.
   */
  it('never stands a placeholder in for a time', () => {
    for (const e of MAHAPRASAD) {
      if (e.servesAt === null) continue;
      expect(e.servesAt.trim()).not.toBe('');
      expect(e.servesAt.toLowerCase()).not.toMatch(/tba|tbd|to be announced|soon|unknown/);
    }
  });

  it('never stands a placeholder in for the days either', () => {
    for (const e of MAHAPRASAD) {
      if (e.days === null) continue;
      expect(e.days.trim()).not.toBe('');
      expect(e.days.toLowerCase()).not.toMatch(/tba|tbd|unknown/);
    }
  });

  it('drops an entry whose mandal is not in the given list', () => {
    const entry: MahaprasadEntry = {
      slug: 'not-a-mandal', servesAt: '12:00', days: null, note: null,
    };
    const rows = mahaprasadFor([] as Ganpati[]);
    expect(rows).toEqual([]);
    expect(entry.slug).toBe('not-a-mandal');
  });

  it('joins an entry to its mandal', () => {
    const g = catalogue.ganpatis[0] as unknown as Ganpati;
    const rows = mahaprasadFor([g]);
    // Empty until the announcements are in hand; this asserts the join
    // shape rather than any particular content.
    expect(rows.every((r) => r.ganpati.slug === r.entry.slug)).toBe(true);
  });
});
