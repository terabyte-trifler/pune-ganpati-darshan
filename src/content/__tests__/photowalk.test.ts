import { describe, it, expect } from 'vitest';
import { PHOTOWALK, photowalkIsUpcoming } from '../photowalk';

describe('photowalk', () => {
  it('registers through pwip.in over https', () => {
    expect(PHOTOWALK.registerUrl).toBe('https://pwip.in');
  });

  /**
   * The card has no other way to be registered for, so a broken or
   * relative URL here is the whole feature failing silently.
   */
  it('has an absolute registration URL', () => {
    expect(() => new URL(PHOTOWALK.registerUrl)).not.toThrow();
  });

  it('states the meeting point', () => {
    expect(PHOTOWALK.meetingPoint).toBe('Shaniwar Wada');
  });

  it('carries the published start time', () => {
    expect(PHOTOWALK.time).toBe('7:00 am start');
  });

  /**
   * The field is nullable so a walk announced before its hour is fixed can
   * say so. What it must never hold is a stand-in that renders as a real
   * time — "TBA" or an empty string both print into the slot where a
   * walker reads the hour, and send people out at the wrong one. A null
   * takes the "Time to be announced" branch on the card instead.
   */
  it('never stands a placeholder in for a real time', () => {
    if (PHOTOWALK.time === null) return;
    expect(PHOTOWALK.time.trim()).not.toBe('');
    expect(PHOTOWALK.time).toMatch(/\d/);
    expect(PHOTOWALK.time.toLowerCase()).not.toMatch(/tba|to be announced|tbd/);
  });

  it('labels the date consistently with the ISO date', () => {
    expect(PHOTOWALK.date).toBe('2026-09-19');
    // Midday IST, so the weekday is read on the Pune side of the date
    // line rather than on the previous UTC day.
    const d = new Date(`${PHOTOWALK.date}T12:00:00+05:30`);
    expect(d.getUTCDay()).toBe(6); // Saturday
    expect(PHOTOWALK.dateLabel).toContain('19 September');
    expect(PHOTOWALK.dateLabel).toContain('Saturday');
  });

  describe('photowalkIsUpcoming', () => {
    /** Compared as IST days: late on the day itself is still "upcoming". */
    it('still shows at 23:00 IST on the day of the walk', () => {
      const late = new Date('2026-09-19T17:30:00.000Z'); // 23:00 IST
      expect(photowalkIsUpcoming(PHOTOWALK, late)).toBe(true);
    });

    it('shows in the days before', () => {
      expect(photowalkIsUpcoming(PHOTOWALK, new Date('2026-09-16T12:00:00.000Z'))).toBe(true);
    });

    /**
     * 00:30 IST on the 20th is 19:00 UTC on the 19th. A UTC comparison
     * would still call this upcoming; the walk is over.
     */
    it('is gone just after midnight IST on the next day', () => {
      const justAfter = new Date('2026-09-19T19:00:00.000Z'); // 00:30 IST, 20th
      expect(photowalkIsUpcoming(PHOTOWALK, justAfter)).toBe(false);
    });

    it('is gone well after', () => {
      expect(photowalkIsUpcoming(PHOTOWALK, new Date('2026-09-25T06:00:00.000Z'))).toBe(false);
    });
  });
});
