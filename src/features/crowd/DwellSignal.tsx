'use client';

import { useDwellSignal } from './useDwellSignal';
import type { PaceMandal } from './pace';

/**
 * Mounts the passive dwell signal. Renders nothing, ever.
 *
 * Mounted once, in the root layout, so it runs wherever the person
 * actually is. It lived on the map first, on the reasoning that the map
 * is what stays open while you walk; that was wrong twice over. Day one
 * of the festival produced a single countable sample in the whole city,
 * and the surfaces people were really on — the home screen, the explore
 * grid, a route — had no tracker running at all.
 *
 * Collecting the same visit several times was the worry that kept it
 * narrow. It no longer applies: there is one mount, the visit clock lives
 * in module state so navigating between pages does not restart it, and
 * every row carries a per-(device, mandal, day) key that collapses
 * duplicates in both the scoring and the summary.
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
