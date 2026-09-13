'use client';

import { useEffect, useMemo } from 'react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useClockMs } from './useCrowd';
import {
  paceZones, stepDwell, initialDwellState,
  type DwellState, type PaceMandal,
} from './pace';
import { getDeviceId } from './device';
import { noteQueued } from './wait-prompt-store';

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

/**
 * The visit in progress, shared by every surface that mounts the tracker.
 * See the note inside the hook.
 */
let trackerState: DwellState = initialDwellState;
/**
 * One in-flight post at a time, across surfaces. A dropped sample costs a
 * little calibration precision and nothing else, so there is no retry.
 */
let posting = false;

export function useDwellSignal(mandals: PaceMandal[], enabled: boolean): void {
  const { state: geo } = useGeolocation();
  const nowMs = useClockMs();

  // Stable for the life of the catalogue; recomputing it on every tick
  // would be 841 haversines a minute for no reason.
  const zones = useMemo(() => (enabled ? paceZones(mandals) : []), [mandals, enabled]);


  useEffect(() => {
    if (!enabled || nowMs === null || zones.length === 0) return;

    const position = geo.status === 'ready' ? geo.position : null;
    const accuracyM = geo.status === 'ready' ? geo.accuracyM : null;

    // Read at effect time, not render time: the module value is what
    // another surface may have advanced.
    const { state: next, emit } = stepDwell(
      trackerState,
      nowMs,
      position,
      accuracyM,
      zones
    );
    trackerState = next;

    if (!emit) return;

    /**
     * A finished queue is the moment to line up the wait question.
     *
     * Only on the final sample, and only for `queueing`: a walk-past
     * cannot be answered, and asking about one teaches people to ignore
     * the card. Nothing is sent here — it is a note on this device that
     * there is something worth asking about next time the app is opened.
     *
     * Kept outside the shadow-mode flag on purpose. Collection can be
     * switched off without taking the question with it, because the
     * answer is a person's own report rather than a passive observation.
     */
    if (emit.isFinal && emit.dwell === 'queueing') {
      noteQueued(emit.mandalId, emit.dwellSeconds);
    }

    if (posting) return;
    posting = true;

    // The device id now travels with the sample. It is never stored: the
    // route checks the block list with it and derives a per-(mandal, day)
    // key, which is what lands in the table. Without it a sample cannot be
    // counted as a device, and dwell can no longer be trusted to colour
    // anything on its own.
    const deviceId = getDeviceId();
    if (!deviceId) return;

    void fetch('/api/crowd/dwell', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...emit, deviceId }),
      keepalive: true,
    })
      .catch(() => {
        // Silent by design. The endpoint returns 404 when the shadow flag
        // is off, and a visitor must never see a console error for a
        // feature that shows them nothing.
      })
      .finally(() => {
        posting = false;
      });
  }, [enabled, nowMs, geo, zones]);
}
