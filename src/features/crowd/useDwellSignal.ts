'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useClockMs } from './useCrowd';
import {
  paceZones, stepDwell, initialDwellState,
  type DwellState, type PaceMandal,
} from './pace';

/**
 * Drives the dwell tracker from the device's own location. Shadow mode.
 *
 * Everything that decides anything lives in `pace.ts` as a pure reducer;
 * this only supplies fixes and time, and posts what the reducer says to
 * post. That split is the whole reason the behaviour is testable without
 * a browser.
 *
 * ---------------------------------------------------------------------
 * What this does NOT do, deliberately.
 *
 * It asks for nothing. It reads the geolocation state the app already
 * has — which the visitor granted for "near you" and for reporting — and
 * never triggers a permission prompt of its own. A passive signal that
 * costs the visitor a dialogue is not passive.
 *
 * It sends no coordinates. The zone is resolved on the device and only a
 * mandal id leaves, exactly as `atMandal` already works.
 *
 * It never surfaces anything. No state is returned, nothing renders, and
 * the crowd panel cannot see it. For this festival the signal exists only
 * to be compared against real reports afterwards.
 *
 * The clock ticks every 30s (useClockMs), which sets the resolution of
 * the dwell measurement. That is far finer than the 90s and 360s
 * thresholds it feeds, so nothing is lost by not running a timer of its
 * own.
 */

export function useDwellSignal(mandals: PaceMandal[], enabled: boolean): void {
  const { state: geo } = useGeolocation();
  const nowMs = useClockMs();

  // Stable for the life of the catalogue; recomputing it on every tick
  // would be 841 haversines a minute for no reason.
  const zones = useMemo(() => (enabled ? paceZones(mandals) : []), [mandals, enabled]);

  const state = useRef<DwellState>(initialDwellState);
  // One in-flight post at a time. A dropped sample costs a little
  // calibration precision and nothing else, so there is no retry.
  const posting = useRef(false);

  useEffect(() => {
    if (!enabled || nowMs === null || zones.length === 0) return;

    const position = geo.status === 'ready' ? geo.position : null;
    const accuracyM = geo.status === 'ready' ? geo.accuracyM : null;

    const { state: next, emit } = stepDwell(
      state.current,
      nowMs,
      position,
      accuracyM,
      zones
    );
    state.current = next;

    if (!emit || posting.current) return;
    posting.current = true;

    void fetch('/api/crowd/dwell', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(emit),
      keepalive: true,
    })
      .catch(() => {
        // Silent by design. The endpoint returns 404 when the shadow flag
        // is off, and a visitor must never see a console error for a
        // feature that shows them nothing.
      })
      .finally(() => {
        posting.current = false;
      });
  }, [enabled, nowMs, geo, zones]);
}
