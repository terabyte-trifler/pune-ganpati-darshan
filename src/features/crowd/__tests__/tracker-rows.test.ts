import { describe, it, expect } from 'vitest';
import { rankTrackerRows, type Rankable } from '@/features/crowd/tracker-rows';

/**
 * The Live Crowd Tracker's ordering.
 *
 * One rule matters here and the rest is tie-breaking: provenance outranks
 * level. A report beats an observation beats an estimate, whatever colour
 * each of them is — so a red report is listed above a green estimate, and
 * the weaker tiers only ever fill rows the tier above could not.
 */

const row = (
  id: string,
  level: Rankable['level'],
  source: Rankable['source'],
  distanceM: number | null = null,
  prominence = 500
) => ({ id, level, source, distanceM, prominence });

describe('reports outrank estimates', () => {
  it('lists a reported heavy queue above an estimated short one', () => {
    const ranked = rankTrackerRows(
      [row('est-short', 'short', 'estimated'), row('reported-heavy', 'long', 'reported')],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['reported-heavy', 'est-short']);
  });

  it('never lets an estimate take a row a report could have had', () => {
    const ranked = rankTrackerRows(
      [
        row('est-a', 'short', 'estimated'),
        row('est-b', 'short', 'estimated'),
        row('rep-a', 'long', 'reported'),
        row('rep-b', 'moving', 'reported'),
        row('rep-c', 'long', 'reported'),
      ],
      3
    );
    expect(ranked.every((r) => r.source === 'reported')).toBe(true);
  });

  it('fills the rows left over, and only those', () => {
    const ranked = rankTrackerRows(
      [row('est-a', 'short', 'estimated'), row('est-b', 'moving', 'estimated'), row('rep', 'moving', 'reported')],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['rep', 'est-a', 'est-b']);
  });

  it('puts an observation between a report and an estimate', () => {
    const ranked = rankTrackerRows(
      [
        row('est', 'short', 'estimated'),
        row('obs', 'long', 'observed'),
        row('rep', 'long', 'reported'),
      ],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['rep', 'obs', 'est']);
  });

  it('never lets an estimate take a row an observation could have had', () => {
    const ranked = rankTrackerRows(
      [
        row('est-a', 'short', 'estimated'),
        row('est-b', 'short', 'estimated'),
        row('obs-a', 'moving', 'observed'),
        row('obs-b', 'long', 'observed'),
        row('obs-c', 'long', 'observed'),
      ],
      3
    );
    expect(ranked.every((r) => r.source === 'observed')).toBe(true);
  });

  it('falls back to estimates entirely when nobody has reported', () => {
    const ranked = rankTrackerRows([row('est-a', 'moving', 'estimated'), row('est-b', 'short', 'estimated')], 3);
    expect(ranked.map((r) => r.id)).toEqual(['est-b', 'est-a']);
  });
});

describe('within a group', () => {
  it('puts the shortest queue first', () => {
    const ranked = rankTrackerRows(
      [row('c', 'long', 'reported'), row('a', 'short', 'reported'), row('b', 'moving', 'reported')],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks a tie on distance when the reader has a position', () => {
    const ranked = rankTrackerRows(
      [row('far', 'short', 'reported', 2_000), row('near', 'short', 'reported', 200)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['near', 'far']);
  });

  it('breaks it on prominence when there is no position', () => {
    const ranked = rankTrackerRows(
      [row('small', 'short', 'reported', null, 120), row('big', 'short', 'reported', null, 1_000)],
      3
    );
    expect(ranked.map((r) => r.id)).toEqual(['big', 'small']);
  });

  it('honours the row limit', () => {
    const ranked = rankTrackerRows(
      [
        row('a', 'short', 'reported'),
        row('b', 'short', 'reported'),
        row('c', 'short', 'reported'),
        row('d', 'short', 'reported'),
      ],
      3
    );
    expect(ranked).toHaveLength(3);
  });
});
