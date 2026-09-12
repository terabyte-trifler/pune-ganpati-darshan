'use client';

import { useDwellSignal } from './useDwellSignal';
import type { PaceMandal } from './pace';

/**
 * Mounts the passive dwell signal. Renders nothing, ever.
 *
 * Placed on the map, which is the surface where someone walking the peths
 * actually has the app open — a mandal page is read and closed, the map
 * stays up while you move. Mounting it on every page would collect the
 * same observations several times over from one device.
 *
 * `enabled` is threaded from the server rather than read here, so the
 * shadow flag lives in one place and a build with it off ships no
 * collection at all.
 */
export function DwellSignal({
  mandals,
  enabled,
}: {
  mandals: PaceMandal[];
  enabled: boolean;
}) {
  useDwellSignal(mandals, enabled);
  return null;
}
