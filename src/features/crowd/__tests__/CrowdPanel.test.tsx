import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CrowdStatus } from '@/types/crowd';
import type { FestivalPhase } from '@/lib/festival';

/**
 * What the crowd panel actually renders.
 *
 * The logic behind both lanes is unit-tested elsewhere; what was never
 * tested is the part a visitor sees, and that is where the two bugs found
 * this week both lived: the prior was skipped in the one state it exists
 * for (offline), and a single report was reported as "nobody has
 * reported". Both were rendering decisions, invisible to every test that
 * only checked the maths.
 *
 * These mock the data hooks and assert the four states on the page.
 */

let mockStatus: {
  status: CrowdStatus | null;
  stale: boolean;
  unavailable: boolean;
  loading: boolean;
  dwell: { samples: number; queueingShare: number; stopping: boolean; detail: string } | null;
};
let mockNow: number | null;

vi.mock('@/features/crowd/useCrowd', () => ({
  useCrowdStatus: () => mockStatus,
  useClockMs: () => mockNow,
  useCrowdState: () => ({ byMandalId: {}, stale: false, unavailable: false, loading: false }),
  useCrowdStatuses: () => ({}),
}));

// The report buttons pull in geolocation and a submit path; this file is
// about the reading, not the reporting.
vi.mock('@/features/crowd/CrowdReportButtons', () => ({
  CrowdReportButtons: () => null,
}));

const { CrowdPanel } = await import('@/features/crowd/CrowdPanel');

const PRIOR = { darshanMinutes: 20, peakDarshanMinutes: 45, prominence: 890 };
const DURING: FestivalPhase = { phase: 'during', day: 6, totalDays: 12, isVisarjan: false };
/** 21:00 IST on Sat 19 Sep 2026. */
const NOW = Date.parse('2026-09-19T15:30:00.000Z');

const status = (over: Partial<CrowdStatus>): CrowdStatus => ({
  mandalId: 'T', status: null, label: '', detail: '', reportCount: 0,
  confidence: 'low', lastUpdated: null, trend: 'unknown', ...over,
});

function panel(props: { phase?: FestivalPhase } = {}) {
  return render(
    <CrowdPanel
      mandalId="T"
      mandalName="Tulshibaug Ganpati"
      mandalLocation={{ lat: 18.5143, lng: 73.8553 }}
      reportingEnabled={false}
      prior={PRIOR}
      festivalPhase={props.phase ?? DURING}
    />
  );
}

beforeEach(() => {
  mockNow = NOW;
  mockStatus = { status: null, stale: false, unavailable: false, loading: false, dwell: null };
});

describe('Phase 0 — a measured reading shows its evidence', () => {
  it('shows the count and the confidence wording together', () => {
    mockStatus.status = status({
      status: 'long', label: 'Heavy',
      detail: 'Devotees report a heavy crowd — 30+ min waits',
      reportCount: 4, confidence: 'medium',
      lastUpdated: new Date(NOW - 3 * 60_000).toISOString(),
    });
    panel();

    expect(screen.getByText('Heavy')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText(/reports in the last 90\s*min/)).toBeDefined();
    expect(screen.getByText(/Fair signal/)).toBeDefined();
    expect(screen.getByText(/Updated 3 min ago/)).toBeDefined();
  });

  it('says "report" singular when there is one, and never shows a 0', () => {
    // A displayed status always has at least two reports, so the singular
    // is unreachable there — but the branch exists and must be right.
    mockStatus.status = status({ status: 'short', label: 'Short', reportCount: 1 });
    panel();
    expect(screen.getByText(/1/)).toBeDefined();
    expect(screen.queryByText(/reports in the last/)).toBeNull();
    expect(screen.getByText(/report in the last/)).toBeDefined();
  });

  it('does NOT show the prior when a reading exists', () => {
    // The lanes must never both speak. This is the assertion that stops
    // a guess appearing beside a measurement.
    mockStatus.status = status({ status: 'long', label: 'Heavy', reportCount: 5 });
    panel();
    expect(screen.queryByText(/Usually/)).toBeNull();
    expect(screen.queryByText(/not a report/)).toBeNull();
  });
});

describe('Phase 1 — the prior speaks when the measurement cannot', () => {
  it('shows the expectation when nobody has reported', () => {
    panel();
    expect(screen.getByText('No recent reports')).toBeDefined();
    expect(screen.getByText(/Usually heavy at this hour/)).toBeDefined();
    expect(screen.getByText(/not a report from anyone there/)).toBeDefined();
    // 21:00 on a Saturday against a 45-minute peak.
    expect(screen.getByText(/usually around 40 minutes/)).toBeDefined();
  });

  it('shows the expectation when the network is down', () => {
    // The bug fixed in 92e893d. `unavailable` used to be tested first and
    // returned early, so the one state the prior exists for was the one
    // state that skipped it.
    mockStatus.unavailable = true;
    panel();
    expect(screen.getByText('Live reports could not load')).toBeDefined();
    expect(screen.getByText(/Usually heavy at this hour/)).toBeDefined();
  });

  it('uses the aggregation’s own wording for a single unconfirmed report', () => {
    // The bug fixed in cccccd2. One report is not a reading, but it is
    // also not "nobody has reported".
    mockStatus.status = status({
      status: null, label: 'Not confirmed yet',
      detail: 'One person has reported this mandal. A second report confirms it.',
      reportCount: 1,
    });
    panel();
    expect(screen.getByText('Not confirmed yet')).toBeDefined();
    expect(screen.getByText(/One person has reported this mandal/)).toBeDefined();
    expect(screen.queryByText(/Nobody has reported/)).toBeNull();
    // And the prior still helps, without contradicting it.
    expect(screen.getByText(/Usually heavy at this hour/)).toBeDefined();
  });

  it('stays silent before the festival starts', () => {
    panel({ phase: { phase: 'before', daysUntil: 1 } });
    expect(screen.getByText('No recent reports')).toBeDefined();
    expect(screen.queryByText(/Usually/)).toBeNull();
  });

  it('stays silent on visarjan afternoon', () => {
    panel({ phase: { phase: 'during', day: 12, totalDays: 12, isVisarjan: true } });
    expect(screen.queryByText(/Usually/)).toBeNull();
  });

  it('renders nothing time-dependent before hydration', () => {
    // nowMs is null until the clock mounts; an expectation rendered on the
    // server would be computed against the build's clock, not the reader's.
    mockNow = null;
    panel();
    expect(screen.queryByText(/Usually/)).toBeNull();
  });
});

describe('Phase 2 — the dwell line, once it is switched on', () => {
  const STOPPING = {
    samples: 7, queueingShare: 0.71, stopping: true,
    detail: 'Most visitors near this mandal are stopping rather than walking past. ' +
      'That usually means a queue, though it can also just be people looking.',
  };

  it('shows under a measured reading without changing it', () => {
    mockStatus.status = status({
      status: 'long', label: 'Heavy', reportCount: 4, confidence: 'medium',
      detail: 'Devotees report a heavy crowd — 30+ min waits',
    });
    mockStatus.dwell = STOPPING;
    panel();

    // The reading is untouched.
    expect(screen.getByText('Heavy')).toBeDefined();
    expect(screen.getByText(/4/)).toBeDefined();
    // And the hint sits beside it, saying something different.
    expect(screen.getByText(/Most visitors near this mandal are stopping/)).toBeDefined();
    expect(screen.getByText(/can also just be people looking/)).toBeDefined();
  });

  it('shows under a silence, alongside the prior', () => {
    mockStatus.dwell = STOPPING;
    panel();
    expect(screen.getByText('No recent reports')).toBeDefined();
    expect(screen.getByText(/Usually heavy at this hour/)).toBeDefined();
    expect(screen.getByText(/are stopping rather than walking past/)).toBeDefined();
  });

  it('is absent entirely when there is no hint', () => {
    // The normal case: the switch is off, or too few samples.
    panel();
    expect(screen.queryByText(/Most visitors near/)).toBeNull();
  });

  it('never puts a number on the page', () => {
    mockStatus.dwell = STOPPING;
    const { container } = panel();
    const line = container.querySelector('p.prose-measure.mt-3');
    expect(line?.textContent ?? '').not.toMatch(/\d/);
  });
});
