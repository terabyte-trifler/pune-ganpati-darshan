import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { crowdDisplayFor, ESTIMATED_LABEL } from '@/features/crowd/crowd-display';
import { buildMarkerSvg } from '@/lib/maps/markers';
import type { FestivalPhase } from '@/lib/festival';
import type { PriorInput } from '@/services/crowd/crowd-prior';
import type { CrowdStatus } from '@/types/crowd';

/**
 * The prior now paints mandals nobody has reported — pins, badges and
 * tracker rows, not just the detail panel.
 *
 * That is the one change that could let a guess be read as a report, so
 * what is tested here is the boundary rather than the arithmetic: a
 * report always wins, an estimate always says so, and there are still
 * times when the app shows nothing at all.
 */

const ist = (isoDate: string, hour: number) =>
  new Date(Date.parse(`${isoDate}T00:00:00.000Z`) - 5.5 * 3600_000 + hour * 3600_000);

const during = (day: number, isVisarjan = false): FestivalPhase =>
  ({ phase: 'during', day, totalDays: 12, isVisarjan });

const DAGDUSHETH: PriorInput = {
  darshanMinutes: 45,
  peakDarshanMinutes: 150,
  prominence: 1000,
};

const reported = (level: 'short' | 'moving' | 'long'): CrowdStatus => ({
  mandalId: 'm1',
  status: level,
  label: level === 'short' ? 'Short' : level === 'moving' ? 'Moving' : 'Heavy',
  detail: 'Devotees report',
  reportCount: 3,
  confidence: 'medium',
  waitMedianMinutes: null,
  waitReportCount: 0,
  lastUpdated: '2026-09-18T15:30:00.000Z',
  trend: 'stable',
});

describe('a report always wins', () => {
  it('never lets the prior speak where there is a reading', () => {
    // 21:00 on day 8 at Dagdusheth: the prior would say heavy. People say
    // short. The people win, and no trace of the estimate survives.
    const display = crowdDisplayFor(
      reported('short'),
      DAGDUSHETH,
      during(8),
      ist('2026-09-21', 21)
    );
    expect(display).toEqual({
      level: 'short',
      label: 'Short',
      estimated: false,
      estimatedWaitMinutes: null,
      lastUpdated: '2026-09-18T15:30:00.000Z',
      pinKey: 'short',
    });
  });

  it('uses the aggregation\'s own wording, never a prefixed one', () => {
    const display = crowdDisplayFor(reported('long'), DAGDUSHETH, during(8), ist('2026-09-21', 21));
    expect(display?.label).toBe('Heavy');
    expect(display?.label).not.toMatch(/est/i);
  });
});

describe('an estimate always says it is one', () => {
  const display = crowdDisplayFor(null, DAGDUSHETH, during(8), ist('2026-09-21', 21));

  it('is marked in the data, the label and the pin', () => {
    expect(display?.estimated).toBe(true);
    expect(display?.label).toBe(ESTIMATED_LABEL[display!.level]);
    expect(display?.label.startsWith('Est.')).toBe(true);
    expect(display?.pinKey).toBe(`est-${display!.level}`);
  });

  it('carries no report time, because there is no report', () => {
    expect(display?.lastUpdated).toBeNull();
  });

  it('labels every level', () => {
    for (const level of ['short', 'moving', 'long'] as const) {
      expect(ESTIMATED_LABEL[level].startsWith('Est. ')).toBe(true);
    }
  });
});

describe('silence is still a state', () => {
  it('shows nothing before the festival', () => {
    expect(
      crowdDisplayFor(null, DAGDUSHETH, { phase: 'before', daysUntil: 4 }, ist('2026-09-10', 21))
    ).toBeNull();
  });

  it('shows nothing after it', () => {
    expect(
      crowdDisplayFor(null, DAGDUSHETH, { phase: 'after' }, ist('2026-09-30', 21))
    ).toBeNull();
  });

  it('shows nothing on visarjan afternoon, when the idol may have left', () => {
    expect(
      crowdDisplayFor(null, DAGDUSHETH, during(12, true), ist('2026-09-25', 17))
    ).toBeNull();
  });

  it('shows nothing before the device clock is known', () => {
    // The server render. An expectation is a function of the reader's
    // clock, so producing one during SSR would be both a hydration
    // mismatch and a claim made with the build's time.
    expect(crowdDisplayFor(null, DAGDUSHETH, during(8), null)).toBeNull();
  });

  it('shows nothing for a mandal with no catalogue figures to work from', () => {
    expect(crowdDisplayFor(null, null, during(8), ist('2026-09-21', 21))).toBeNull();
  });
});

describe('the pin artwork', () => {
  it('draws an estimate hollow, not filled', () => {
    const filled = decodeURIComponent(buildMarkerSvg('local', false, 'moving', false).url);
    const hollow = decodeURIComponent(buildMarkerSvg('local', false, 'moving', true).url);

    // Filled: the queue colour is the body, the ground is the outline.
    expect(filled).toContain('<circle cx="12" cy="12" r="10.2" fill="#f2a93b"');
    // Hollow: the ground is the body, the queue colour is only the ring
    // and the mark — so the difference survives a glance and greyscale.
    expect(hollow).toContain('<circle cx="12" cy="12" r="10.2" fill="#14100c" stroke="#f2a93b"');
    expect(hollow).not.toContain('<circle cx="12" cy="12" r="10.2" fill="#f2a93b"');
  });
});

describe('the lanes stay separate', () => {
  it('keeps the prior out of the aggregation, in both directions', () => {
    // The guarantee behind all of the above: a reading is computed by
    // code that cannot see the model, so the model cannot tip one.
    const aggregation = readFileSync('src/services/crowd/crowd-aggregation.ts', 'utf8');
    expect(aggregation).not.toContain('crowd-prior');
    expect(aggregation).not.toContain('crowd-display');
  });
});
