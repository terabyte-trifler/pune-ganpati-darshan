import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaitReportButtons } from '@/features/crowd/WaitReportButtons';

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
  beforeEach(() => vi.clearAllMocks());

  it('offers every bucket by default', () => {
    render(<WaitReportButtons mandalId="m" />);
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByText('1.5 hr')).toBeTruthy();
  });

  it('drops everything under the floor when one is set', () => {
    render(<WaitReportButtons mandalId="m" minMinutes={30} />);
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
    render(<WaitReportButtons mandalId="m" prompt="Roughly how long?" />);
    expect(screen.getByText('Roughly how long?')).toBeTruthy();
  });
});
