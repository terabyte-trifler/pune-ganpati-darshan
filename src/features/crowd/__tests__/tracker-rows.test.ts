import { describe, it, expect } from 'vitest';
import { rankTrackerRows, type Rankable } from '@/features/crowd/tracker-rows';

/**
 * The Live Crowd Tracker's ordering.
 *
 * One rule matters here and the rest is tie-breaking: a report outranks
 * an estimate at every level. Everything the app was told beats
 * everything the app worked out, so a red report is listed above a green
 * estimate and the prior only ever fills rows nothing reported could.
 */

const row = (
  id: string,
  level: Rankable['level'],
  estimated: boolean,
  distanceM: number | null = null,
  prominence = 500
) => ({ id, level, estimated, distanceM, prominence });

describe('reports outrank estimates', () => {
  it('lists a reported heavy queue above an estimated short one', () => {
    const ranked = rankTrackerRows(
      [row('est-short', 'short', true), row('reported-heavy', 'long', false)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['reported-heavy', 'est-short']);
  });

  it('never lets an estimate take a row a report could have had', () => {
    const ranked = rankTrackerRows(
      [
        row('est-a', 'short', true),
        row('est-b', 'short', true),
        row('rep-a', 'long', false),
        row('rep-b', 'moving', false),
        row('rep-c', 'long', false),
      ],
      3
    );
    expect(ranked.every((r) => !r.estimated)).toBe(true);
  });

  it('fills the rows left over, and only those', () => {
    const ranked = rankTrackerRows(
      [row('est-a', 'short', true), row('est-b', 'moving', true), row('rep', 'moving', false)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['rep', 'est-a', 'est-b']);
  });

  it('falls back to estimates entirely when nobody has reported', () => {
    const ranked = rankTrackerRows([row('est-a', 'moving', true), row('est-b', 'short', true)], 3);
    expect(ranked.map((r) => r.id)).toEqual(['est-b', 'est-a']);
  });
});

describe('within a group', () => {
  it('puts the shortest queue first', () => {
    const ranked = rankTrackerRows(
      [row('c', 'long', false), row('a', 'short', false), row('b', 'moving', false)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks a tie on distance when the reader has a position', () => {
    const ranked = rankTrackerRows(
      [row('far', 'short', false, 2_000), row('near', 'short', false, 200)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['near', 'far']);
  });

  it('breaks it on prominence when there is no position', () => {
    const ranked = rankTrackerRows(
      [row('small', 'short', false, null, 120), row('big', 'short', false, null, 1_000)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['big', 'small']);
  });

  it('honours the row limit', () => {
    const ranked = rankTrackerRows(
      [
        row('a', 'short', false),
        row('b', 'short', false),
        row('c', 'short', false),
        row('d', 'short', false),
      ],
      3
    );
    expect(ranked).toHaveLength(3);
  });
});
