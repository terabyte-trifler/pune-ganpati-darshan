import { describe, it, expect } from 'vitest';
import { MAHAPRASAD, mahaprasadDirections } from '@/content/mahaprasad';

/**
 * Mahaprasad is an announcement, not an observation.
 *
 * The cost of being wrong here is not a bad reading — it is somebody
 * elderly walking across the peths to a counter that is not serving. So
 * the guards are about never stating a time nobody announced, and never
 * pointing somebody at a place that is not where they were told.
 */
describe('mahaprasad', () => {
  it('names each place once', () => {
    const names = MAHAPRASAD.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has a real coordinate for every entry', () => {
    for (const e of MAHAPRASAD) {
      // Pune, generously bounded. A transposed or truncated coordinate is
      // the failure that sends somebody to the wrong side of the city.
      expect(e.at.lat).toBeGreaterThan(18.4);
      expect(e.at.lat).toBeLessThan(18.65);
      expect(e.at.lng).toBeGreaterThan(73.75);
      expect(e.at.lng).toBeLessThan(73.95);
    }
  });

  /**
   * null means "serves, but has not said when" — a real state, and NOT
   * the same as no mahaprasad. What it must never hold is a stand-in that
   * renders as a time: "TBA", "soon" and an empty string all print into
   * the slot where a visitor reads the hour.
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

  it('builds walking directions to the announced coordinate', () => {
    const e = MAHAPRASAD[0];
    const url = new URL(mahaprasadDirections(e));
    expect(url.searchParams.get('destination')).toBe(`${e.at.lat},${e.at.lng}`);
    // Walking: the peth core is closed to traffic during the festival.
    expect(url.searchParams.get('travelmode')).toBe('walking');
  });

  /**
   * Standalone on purpose. Keying to a catalogue slug meant a mandal had
   * to become a full darshan destination — page, darshan time, crowd
   * tracker, dwell zone — before it could be listed as serving food.
   * Serving mahaprasad is not that claim.
   */
  it('carries its own location rather than a catalogue slug', () => {
    for (const e of MAHAPRASAD) {
      expect(e).not.toHaveProperty('slug');
      expect(e.name.trim().length).toBeGreaterThan(0);
    }
  });
});
