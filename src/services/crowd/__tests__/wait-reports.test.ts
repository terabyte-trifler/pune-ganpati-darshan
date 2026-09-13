import { describe, it, expect } from 'vitest';
import {
  aggregateMandal, levelForWaitMinutes, WAIT_MASS, ACTIVE_WINDOW_MINUTES,
  type WaitInput,
} from '@/services/crowd/crowd-aggregation';
import type { CrowdReportInput, CrowdLevel } from '@/types/crowd';

/**
 * Phase 3: how long people actually waited.
 *
 * The claim being tested is that minutes are better evidence than a
 * colour — given after the fact, by the person who stood there, with no
 * "heavy or just moving" judgement to disagree about — and that the app
 * treats them accordingly without letting them run away with a reading.
 */

const NOW = Date.parse('2026-09-19T15:30:00.000Z');
const at = (mins: number) => new Date(NOW - mins * 60_000).toISOString();
const rep = (status: CrowdLevel, mins: number, dev: number): CrowdReportInput =>
  ({ mandalId: 'm', status, createdAt: at(mins), atMandal: true, deviceSeq: dev });
const wait = (minutes: number, ageMins: number): WaitInput =>
  ({ minutes, createdAt: at(ageMins) });

describe('what a wait time means', () => {
  it('maps minutes to the same levels the rest of the app uses', () => {
    expect(levelForWaitMinutes(0)).toBe('short');
    expect(levelForWaitMinutes(9)).toBe('short');
    expect(levelForWaitMinutes(10)).toBe('moving');
    expect(levelForWaitMinutes(29)).toBe('moving');
    expect(levelForWaitMinutes(30)).toBe('long');
    expect(levelForWaitMinutes(150)).toBe('long');
  });

  it('is worth more than a colour from the same moment', () => {
    // One person saying "45 minutes" should outweigh one person tapping
    // "short", because the first is a number and the second is an opinion.
    const s = aggregateMandal('m', [rep('short', 2, 1)], NOW, [], [wait(45, 2)]);
    expect(s.status).toBe('long');
    expect(WAIT_MASS).toBeGreaterThan(1);
  });

  it('creates a reading on its own', () => {
    // A mandal where the only thing anyone did was report how long they
    // queued must still show something: they told us more than a tap does.
    const s = aggregateMandal('m', [], NOW, [], [wait(40, 3)]);
    expect(s.status).toBe('long');
    expect(s.reportCount).toBe(1);
  });

  it('reports the median, not the loudest number', () => {
    const s = aggregateMandal('m', [], NOW, [], [
      wait(10, 5), wait(20, 4), wait(25, 3), wait(30, 2), wait(120, 1),
    ]);
    // The 120 is someone who queued at a different hour, or misread the
    // question. A mean would let it drag the answer; a median does not.
    expect(s.waitMedianMinutes).toBe(25);
    expect(s.waitReportCount).toBe(5);
  });

  it('expires with the same window as everything else', () => {
    const stale = aggregateMandal('m', [], NOW, [], [
      wait(50, ACTIVE_WINDOW_MINUTES + 5),
    ]);
    // A queue from two hours ago is not this queue.
    expect(stale.status).toBeNull();
    expect(stale.waitMedianMinutes).toBeNull();
  });

  it('decays, so a fresh colour can outweigh an old wait', () => {
    const s = aggregateMandal(
      'm',
      [rep('short', 1, 1), rep('short', 2, 2)],
      NOW,
      [],
      [wait(45, 80)]
    );
    // 1.5 × 2^(-80/30) ≈ 0.24 against roughly 1.9 of fresh human evidence.
    expect(s.status).toBe('short');
  });

  it('raises confidence, unlike the passive signal', () => {
    // A wait time is somebody's own report, so it should make a reading
    // more trustworthy — which dwell must never do.
    const withoutWait = aggregateMandal('m', [rep('long', 2, 1)], NOW);
    const withWaits = aggregateMandal('m', [rep('long', 2, 1)], NOW, [], [
      wait(40, 2), wait(35, 3), wait(45, 4), wait(38, 5),
    ]);
    const rank = { low: 0, medium: 1, high: 2 } as const;
    expect(rank[withWaits.confidence]).toBeGreaterThan(rank[withoutWait.confidence]);
  });

  it('does not invent a median when nobody reported one', () => {
    const s = aggregateMandal('m', [rep('moving', 2, 1), rep('moving', 3, 2)], NOW);
    expect(s.waitMedianMinutes).toBeNull();
    expect(s.waitReportCount).toBe(0);
  });
});
