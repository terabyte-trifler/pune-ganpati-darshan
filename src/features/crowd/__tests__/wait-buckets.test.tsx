import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaitReportButtons } from '@/features/crowd/WaitReportButtons';
import { WAIT_REPORT_MAX_DISTANCE_M } from '@/features/crowd/report-eligibility';
import type { GeoState } from '@/hooks/useGeolocation';

/** Dagdusheth, from the catalogue. */
const MANDAL = { lat: 18.51514, lng: 73.856379 };
/** Roughly metres north, which is precise enough at this latitude. */
const northOf = (m: number) => ({ lat: MANDAL.lat + m / 111_320, lng: MANDAL.lng });

let geo: GeoState = { status: 'ready', position: MANDAL, accuracyM: 20 };

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({ state: geo, request: vi.fn() }),
  useResolveLocation: vi.fn(),
  requestPreciseLocation: vi.fn(),
}));
vi.mock('@/features/crowd/device', () => ({ getDeviceId: () => 'device' }));
vi.mock('@/features/crowd/crowd-store', () => ({
  applyCrowdStatus: vi.fn(), refreshCrowd: vi.fn(),
}));
vi.mock('@/services/analytics', () => ({ trackEvent: vi.fn() }));

/**
 * The buckets offered after a "30+ min" report.
 *
 * Somebody who has just said the queue is over half an hour must not be
 * offered "5 min" in the same breath — a control that lets you contradict
 * yourself reads as a bug, and the report it produces is worse than none.
 */
describe('wait buckets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geo = { status: 'ready', position: MANDAL, accuracyM: 20 };
  });

  it('offers every bucket by default', () => {
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByText('1.5 hr')).toBeTruthy();
  });

  it('drops everything under the floor when one is set', () => {
    render(<WaitReportButtons mandalId="m" location={MANDAL} minMinutes={30} />);
    expect(screen.queryByText('5 min')).toBeNull();
    expect(screen.queryByText('10 min')).toBeNull();
    expect(screen.queryByText('20 min')).toBeNull();
    // And keeps the ones that agree with "30+".
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('1 hr')).toBeTruthy();
    expect(screen.getByText('1.5 hr')).toBeTruthy();
  });

  it('asks its own question when given one', () => {
    render(<WaitReportButtons mandalId="m" location={MANDAL} prompt="Roughly how long?" />);
    expect(screen.getByText('Roughly how long?')).toBeTruthy();
  });
});

/**
 * You have to have been there.
 *
 * This question had no radius at all, so a wait could be typed in at
 * home — and a reported wait outranks both the devices and the model in
 * queueTimeFor, which makes it the most damaging thing in the app to be
 * able to invent.
 */
describe('the wait report radius', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geo = { status: 'ready', position: MANDAL, accuracyM: 20 };
  });

  it('asks somebody who has walked away but is still in the peths', () => {
    geo = { status: 'ready', position: northOf(WAIT_REPORT_MAX_DISTANCE_M - 200), accuracyM: 20 };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.getByText('30 min')).toBeTruthy();
  });

  it('does not ask from home', () => {
    geo = { status: 'ready', position: northOf(WAIT_REPORT_MAX_DISTANCE_M + 500), accuracyM: 20 };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.queryByText('30 min')).toBeNull();
    expect(screen.queryByText('1.5 hr')).toBeNull();
  });

  /**
   * The question goes too, not just the buttons. "How long did you wait?"
   * sitting above a refusal reads as a broken control.
   */
  it('withholds the question itself, not only the buckets', () => {
    geo = { status: 'ready', position: northOf(WAIT_REPORT_MAX_DISTANCE_M + 500), accuracyM: 20 };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.queryByText('How long did you wait?')).toBeNull();
  });

  /**
   * No coordinate means no distance, and that has to mean "do not ask".
   * The colour vote can fall back to submitting as off-site because it
   * has a weight to halve; a wait time has no such dial.
   */
  it('does not ask when the mandal has no position', () => {
    render(<WaitReportButtons mandalId="m" />);
    expect(screen.queryByText('30 min')).toBeNull();
  });

  it('offers to turn location on rather than silently refusing', () => {
    geo = { status: 'idle' };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.getByText(/Turn on location/)).toBeTruthy();
  });
});
