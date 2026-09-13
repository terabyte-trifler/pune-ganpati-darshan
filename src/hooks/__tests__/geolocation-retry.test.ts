import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGeolocation, retryLocation, requestLocation, resetGeolocationForTesting,
} from '@/hooks/useGeolocation';

/**
 * Recovering from a failed fix.
 *
 * The bug this pins: in the peths the first `getCurrentPosition` often
 * times out, the state went to 'unavailable', and nothing ever tried
 * again — `autoLocate` only runs from 'idle' and the watch only starts
 * once a position exists. The report controls then asked the visitor to
 * "turn on location" for a permission they had already granted, and the
 * only way out was reloading the page.
 */

type Cb = (p: unknown) => void;
type Err = (e: { code: number; PERMISSION_DENIED: number }) => void;

let calls: Array<{ ok: Cb; fail: Err }>;

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: Cb, fail: Err) => calls.push({ ok, fail }),
      watchPosition: () => 1,
      clearWatch: () => {},
    },
  });
  resetGeolocationForTesting();
});

afterEach(() => {
  resetGeolocationForTesting();
  vi.useRealTimers();
});

/** Fail the most recent request the way a timeout does. */
const failLast = (code = 2) =>
  calls.at(-1)!.fail({ code, PERMISSION_DENIED: 1 });

describe('a fix that fails', () => {
  it('is retried without the page being reloaded', () => {
    const { result } = renderHook(() => useGeolocation());
    requestLocation();
    expect(calls).toHaveLength(1);

    // act, because the state lives outside React and the hook re-reads it
    // through useSyncExternalStore.
    act(() => failLast());
    expect(result.current.state.status).toBe('unavailable');

    // The whole point: time passes and it tries again on its own.
    vi.advanceTimersByTime(9_000);
    expect(calls.length).toBeGreaterThan(1);
  });

  it('gives up rather than draining the battery forever', () => {
    renderHook(() => useGeolocation());
    requestLocation();
    for (let i = 0; i < 12; i++) {
      failLast();
      vi.advanceTimersByTime(9_000);
    }
    // Bounded: a phone in a lane with no sky must not retry endlessly.
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('starts over when the person asks again', () => {
    renderHook(() => useGeolocation());
    requestLocation();
    for (let i = 0; i < 12; i++) {
      failLast();
      vi.advanceTimersByTime(9_000);
    }
    const exhausted = calls.length;

    // A tap on "Try again" is a new request, not a continuation.
    retryLocation();
    expect(calls.length).toBe(exhausted + 1);
    failLast();
    vi.advanceTimersByTime(9_000);
    expect(calls.length).toBeGreaterThan(exhausted + 1);
  });

  it('never retries a permission that was refused', () => {
    const { result } = renderHook(() => useGeolocation());
    requestLocation();
    act(() => failLast(1)); // PERMISSION_DENIED
    expect(result.current.state.status).toBe('denied');

    const after = calls.length;
    vi.advanceTimersByTime(60_000);
    // Retrying cannot un-deny it, and re-prompting would be harassment.
    expect(calls.length).toBe(after);
  });

  it('stops retrying once a position arrives', () => {
    renderHook(() => useGeolocation());
    requestLocation();
    failLast();
    vi.advanceTimersByTime(9_000);

    calls.at(-1)!.ok({ coords: { latitude: 18.5143, longitude: 73.8553, accuracy: 25 } });
    const after = calls.length;
    vi.advanceTimersByTime(60_000);
    expect(calls.length).toBe(after);
  });
});
