import { describe, it, expect } from 'vitest';
import { decide } from '@/services/crowd/crowd-decision';
import { crowdExpectation } from '@/services/crowd/crowd-prior';
import type { CrowdStatus } from '@/types/crowd';

const st = (o: Partial<CrowdStatus>): CrowdStatus => ({
  mandalId: 'm', status: null, label: '', detail: '', reportCount: 0,
  confidence: 'low', lastUpdated: null, trend: 'unknown', ...o,
});
const prior = crowdExpectation(
  { darshanMinutes: 20, peakDarshanMinutes: 45, prominence: 890 },
  { phase: 'during', day: 6, totalDays: 12, isVisarjan: false },
  new Date(Date.parse('2026-09-19T15:30:00.000Z'))
);

describe('which lane decided', () => {
  it('names a plain measured reading', () => {
    const d = decide(st({ status: 'long', reportCount: 3 }), st({ status: 'long', reportCount: 3 }), prior);
    expect(d.decider).toBe('measured');
    expect(d.onMapAndBadges).toBe(true);
  });

  it('names dwell when the humans alone would have said something else', () => {
    // The Hira Bagh case from production: humans said Moving, dwell made it Heavy.
    const d = decide(st({ status: 'long', reportCount: 2 }), st({ status: 'moving', reportCount: 2 }), prior);
    expect(d.decider).toBe('dwell-tipped');
    expect(d.level).toBe('long');
    expect(d.humanOnlyLevel).toBe('moving');
  });

  it('keeps an unconfirmed report off the map', () => {
    const d = decide(st({ reportCount: 1 }), st({ reportCount: 1 }), prior);
    expect(d.decider).toBe('unconfirmed');
    expect(d.onMapAndBadges).toBe(false);
  });

  it('keeps the prior off the map', () => {
    // A "Usually heavy" must never paint a pin — it is not a report.
    const d = decide(st({}), st({}), prior);
    expect(d.decider).toBe('prior');
    expect(d.level).toBe(prior!.level);
    expect(d.onMapAndBadges).toBe(false);
  });

  it('is silent when nothing can speak', () => {
    expect(decide(st({}), st({}), null).decider).toBe('silent');
  });
});
