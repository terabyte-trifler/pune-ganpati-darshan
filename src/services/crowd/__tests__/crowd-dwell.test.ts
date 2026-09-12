import { describe, it, expect } from 'vitest';
import {
  summariseDwell, MIN_DWELL_SAMPLES, DWELL_WINDOW_MINUTES, STOPPING_SHARE,
  type DwellSample,
} from '@/services/crowd/crowd-dwell';

/**
 * The third lane, now visible to visitors.
 *
 * What matters is not the arithmetic — it is a share of a small array —
 * but that it can never say more than it knows: never a count, never a
 * cause, and never anything at all on thin evidence.
 */

const NOW = Date.parse('2026-09-19T15:30:00.000Z');
const s = (dwell: 'lingering' | 'queueing', minsAgo: number): DwellSample => ({
  dwell, createdAt: new Date(NOW - minsAgo * 60_000).toISOString(),
});

describe('summarising dwell', () => {
  it('says nothing on thin evidence', () => {
    expect(summariseDwell([], NOW)).toBeNull();
    expect(summariseDwell([s('queueing', 1)], NOW)).toBeNull();
    expect(summariseDwell([s('queueing', 1), s('queueing', 2)], NOW)).toBeNull();
    expect(summariseDwell(
      Array.from({ length: MIN_DWELL_SAMPLES }, () => s('queueing', 1)), NOW
    )).not.toBeNull();
  });

  it('ignores samples outside the window', () => {
    const old = Array.from({ length: 10 }, () => s('queueing', DWELL_WINDOW_MINUTES + 1));
    expect(summariseDwell(old, NOW)).toBeNull();
  });

  it('reports a proportion, never a count', () => {
    const r = summariseDwell(
      [s('queueing', 1), s('queueing', 5), s('lingering', 9), s('lingering', 20)], NOW
    )!;
    expect(r.queueingShare).toBe(0.5);
    // The number of samples is computed but must never reach the reader:
    // it is a fraction of the people with the map open, and any figure
    // reads as a headcount.
    expect(r.detail).not.toMatch(/\d/);
  });

  it('never claims to know why people stopped', () => {
    const stopping = summariseDwell(
      [s('queueing', 1), s('queueing', 2), s('queueing', 3)], NOW
    )!;
    expect(stopping.stopping).toBe(true);
    expect(stopping.detail).toMatch(/stopping/i);
    // The confound, admitted in the sentence itself.
    expect(stopping.detail).toMatch(/can also just be people looking/i);
    expect(stopping.detail).not.toMatch(/\bqueue is\b|minutes|wait/i);
  });

  it('says the opposite when people are moving through', () => {
    const moving = summariseDwell(
      [s('lingering', 1), s('lingering', 2), s('lingering', 3)], NOW
    )!;
    expect(moving.stopping).toBe(false);
    expect(moving.detail).toMatch(/moving through/i);
  });

  it('turns over exactly at the share threshold', () => {
    const mk = (q: number, l: number) => summariseDwell(
      [...Array.from({ length: q }, () => s('queueing', 1)),
       ...Array.from({ length: l }, () => s('lingering', 1))], NOW
    )!;
    expect(mk(2, 2).queueingShare).toBe(STOPPING_SHARE);
    expect(mk(2, 2).stopping).toBe(true);
    expect(mk(1, 3).stopping).toBe(false);
  });
});

describe('it cannot reach the measured lane', () => {
  it('is not imported by the aggregation', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/crowd/crowd-aggregation.ts', 'utf8')
    );
    expect(src).not.toContain('crowd-dwell');
    expect(src).not.toContain('summariseDwell');
    expect(src).not.toContain('DwellSummary');
  });

  it('is not a field on CrowdStatus', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/types/crowd.ts', 'utf8')
    );
    const iface = src.slice(
      src.indexOf('export interface CrowdStatus'),
      src.indexOf('}', src.indexOf('export interface CrowdStatus'))
    );
    expect(iface).not.toMatch(/dwell/i);
  });

  it('is off unless its own switch is set', async () => {
    // A switch separate from collection, so the display can be killed
    // mid-festival without losing the calibration data.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/crowd/crowd-service.ts', 'utf8')
    );
    expect(src).toContain("process.env.CROWD_DWELL_PUBLIC !== '1'");
  });
});
