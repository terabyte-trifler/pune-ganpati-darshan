import { describe, it, expect } from 'vitest';
import { mergedTimings, mandalsWithTimings, startMinutes } from '../visarjan-timings';

describe('visarjan timings merge', () => {
  it('parses a plain time and the start of a range', () => {
    expect(startMinutes('09:30')).toBe(9 * 60 + 30);
    expect(startMinutes('07:00 – 07:30')).toBe(7 * 60);
    expect(startMinutes('17:00 – 17:30')).toBe(17 * 60);
  });

  it('refuses an unparseable time rather than sorting it to midnight', () => {
    // A row at 0 would sit at the top of the day claiming to be first.
    expect(startMinutes('morning')).toBeNull();
    expect(startMinutes('25:00')).toBeNull();
    expect(startMinutes('09:75')).toBeNull();
  });

  it('returns every row in chronological order', () => {
    const rows = mergedTimings();
    expect(rows.length).toBeGreaterThan(10);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].minutes).toBeGreaterThanOrEqual(rows[i - 1].minutes);
    }
  });

  it('merges both sources into the one list', () => {
    const rows = mergedTimings();
    expect(rows.some((r) => r.source === 'police')).toBe(true);
    expect(rows.some((r) => r.source === 'mandal')).toBe(true);
    // Kasba's checkpoints carry the Devanagari the mandal printed.
    expect(rows.some((r) => r.whatMr?.includes('चौक'))).toBe(true);
  });

  it('puts the citywide entry first when the hour is shared', () => {
    const rows = mergedTimings();
    const at930 = rows.filter((r) => r.minutes === 9 * 60 + 30);
    // Three of the Manache Paach share 09:30, so this tie is real data.
    expect(at930.length).toBeGreaterThan(1);
    const police = at930.findIndex((r) => r.source === 'police');
    if (police !== -1) {
      expect(at930.slice(0, police).every((r) => r.source === 'police')).toBe(true);
    }
  });

  it('shortens mandal names for the row tag', () => {
    const rows = mergedTimings();
    expect(rows.some((r) => r.mandal === 'Kasba')).toBe(true);
    expect(rows.some((r) => r.mandal === 'Shri Kasba Ganpati')).toBe(false);
  });

  it('lists each mandal once for the jump chips', () => {
    const chips = mandalsWithTimings(mergedTimings());
    const names = chips.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['Kasba', 'Tambdi Jogeshwari', 'Guruji Talim']));
  });
});
