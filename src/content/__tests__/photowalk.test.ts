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
    expect(PHOTOWALK.meetingPoint).toBe('Shivaji Nagar');
  });

  /**
   * pwip.in says the time is to be announced. A placeholder here — "9am",
   * "TBA", an empty string — would either invent a time or print as one,
   * so null is the only honest value until the organiser publishes one.
   */
  it('leaves the time null rather than guessing it', () => {
    expect(PHOTOWALK.time).toBeNull();
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
