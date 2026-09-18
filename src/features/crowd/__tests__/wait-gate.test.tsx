import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import type { GeoState } from '@/hooks/useGeolocation';

/**
 * Who may say how long they waited.
 *
 * A wait report is the heaviest signal the tracker has — 1.5x a colour,
 * and the only one that becomes a number of minutes on screen — so it is
 * held to the same 1 km radius as the colour buttons. These tests pin
 * that, and pin the single deliberate exemption, because the exemption is
 * the kind of thing that gets copied to a second caller by accident and
 * quietly reopens the door.
 */

let geo: GeoState = { status: 'idle' };

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({ state: geo, request: vi.fn() }),
  useResolveLocation: () => {},
  requestPreciseLocation: vi.fn(),
  retryLocation: vi.fn(),
}));
vi.mock('@/features/crowd/device', () => ({ getDeviceId: () => 'device' }));
vi.mock('@/features/crowd/crowd-store', () => ({
  applyCrowdStatus: vi.fn(), refreshCrowd: vi.fn(),
}));
vi.mock('@/services/analytics', () => ({ trackEvent: vi.fn() }));

const { WaitReportButtons } = await import('@/features/crowd/WaitReportButtons');

/** Shaniwar Wada, and a point ~4.5 km east of it. */
const MANDAL = { lat: 18.5195, lng: 73.8553 };
const FAR = { lat: 18.5195, lng: 73.898 };

const ready = (position: { lat: number; lng: number }, accuracyM = 20): GeoState =>
  ({ status: 'ready', position, accuracyM });

describe('the wait buckets are behind the 1 km gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geo = { status: 'idle' };
  });

  it('offers the buckets to somebody at the mandal', () => {
    geo = ready(MANDAL);
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.getByText('5 min')).toBeTruthy();
    expect(screen.getByText('1.5 hr')).toBeTruthy();
  });

  it('withholds every bucket from somebody across town', () => {
    geo = ready(FAR);
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.queryByText('5 min')).toBeNull();
    expect(screen.queryByText('1.5 hr')).toBeNull();
  });

  it('says how far away they are rather than just refusing', () => {
    geo = ready(FAR);
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    // The refusal names the distance and the radius; a bare "no" reads as
    // the app being broken, which is what sends people to report a bug.
    expect(screen.getByText(/away/i)).toBeTruthy();
    expect(screen.getByText(/1 km/i)).toBeTruthy();
  });

  it('asks about the wait, not about the queue, when it refuses', () => {
    geo = ready(FAR);
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    // Shared refusal component, two subjects. Telling somebody "the queue
    // is only worth reporting if you can see it" when they were trying to
    // say how long they stood in it answers a question nobody asked.
    expect(screen.getByText(/wait times come from people/i)).toBeTruthy();
  });

  it('offers to turn location on when it has never been asked', () => {
    geo = { status: 'idle' };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.queryByText('5 min')).toBeNull();
    expect(screen.getByRole('button', { name: /turn on location/i })).toBeTruthy();
  });

  it('refuses when location is denied, because it cannot tell', () => {
    geo = { status: 'denied' };
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.queryByText('5 min')).toBeNull();
  });

  it('does not refuse a coarse fix that lands outside — it refines', () => {
    // A phone standing AT the mandal on a 1.5 km fix computes as far away.
    // Refusing on that would lock out the people the gate exists to serve.
    geo = ready(FAR, 1_500);
    render(<WaitReportButtons mandalId="m" location={MANDAL} />);
    expect(screen.getByText(/more precise location/i)).toBeTruthy();
  });

  it('leaves the buckets open when no location is passed at all', () => {
    // The dwell prompt's path. It carries no `location` because presence
    // was already established by the tracker watching this device sit at
    // this mandal — a stronger claim than a fresh fix, and the only way
    // somebody who answered from home can still answer.
    geo = ready(FAR);
    render(<WaitReportButtons mandalId="m" />);
    expect(screen.getByText('5 min')).toBeTruthy();
  });
});

describe('the callers keep the gate', () => {
  const withoutComments = (path: string) =>
    readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('the mandal panel passes a location to the wait buckets', () => {
    // Without this prop the component silently has no gate, which looks
    // exactly like working code. Comments are stripped so this cannot
    // pass by matching the prose that explains it.
    const src = withoutComments('src/features/crowd/CrowdPanel.tsx');
    const tag = /<WaitReportButtons[^>]*\/>/.exec(src);
    expect(tag).not.toBeNull();
    expect(tag![0]).toMatch(/location=\{mandalLocation\}/);
  });

  it('the dwell prompt is the only caller without one', () => {
    const callers = [
      'src/features/crowd/CrowdPanel.tsx',
      'src/features/crowd/WaitPrompt.tsx',
      'src/features/crowd/CrowdReportButtons.tsx',
    ];
    const ungated = callers.filter((path) => {
      const src = withoutComments(path);
      const tag = /<WaitReportButtons[\s\S]*?\/>/.exec(src);
      return tag !== null && !/location=/.test(tag[0]);
    });
    // CrowdReportButtons' own follow-up is reached only after a colour
    // report, which the 1 km gate already allowed, so it needs no second
    // check. WaitPrompt is the deliberate exemption. Anything else
    // appearing here is a gate that was dropped by accident.
    expect(ungated).toEqual([
      'src/features/crowd/WaitPrompt.tsx',
      'src/features/crowd/CrowdReportButtons.tsx',
    ]);
  });
});
