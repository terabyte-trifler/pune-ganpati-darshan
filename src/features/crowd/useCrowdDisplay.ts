'use client';

import { useMemo } from 'react';
import { useCrowdState, useClockMs, useCrowdStatus } from './useCrowd';
import { useFestivalPhase } from './FestivalPhaseProvider';
import { crowdDisplayFor, priorInputOf, type CrowdDisplay } from './crowd-display';
import type { PriorInput } from '@/services/crowd/crowd-prior';
import { features } from '@/lib/env';

/**
 * The colour every surface draws, measured or estimated.
 *
 * One hook so the map, the tracker, the cards and the panel cannot
 * disagree: a pin that says "Est. moving" and a card beside it that says
 * nothing at all is worse than either on its own.
 */

/** The catalogue fields this needs. Anything Ganpati-shaped satisfies it. */
export interface DisplayInput {
  id: string;
  darshanMinutes: number | null;
  peakDarshanMinutes: number | null;
  prominence: number;
}

/**
 * Everything a consumer can actually see, as one string.
 *
 * The shared clock ticks every thirty seconds and the prior is a function
 * of it, so this hook recomputes twice a minute whether or not anything
 * changed. Handing a new object back each time would rebuild the route
 * markers on every MiniMap — real DOM markers, torn down and recreated —
 * twice a minute, for nothing. Memoising on this signature keeps the
 * identity stable until a colour, a label or a report time moves.
 */
function signatureOf(displays: Record<string, CrowdDisplay>): string {
  return Object.keys(displays)
    .sort()
    .map((id) => {
      const d = displays[id];
      return `${id}:${d.pinKey}:${d.label}:${d.lastUpdated ?? ''}`;
    })
    .join('|');
}

/**
 * Displays for many mandals, keyed by id.
 *
 * The returned object is held by reference and replaced only when a
 * colour or a label actually changes. Without that, the shared 30-second
 * clock would hand the map a new object every half minute and it would
 * re-upload its whole source for nothing.
 */
export function useCrowdDisplays(
  mandals: DisplayInput[]
): Record<string, CrowdDisplay> {
  const state = useCrowdState();
  const phase = useFestivalPhase();
  const nowMs = useClockMs();

  const next = useMemo(() => {
    /**
     * With the feature off, every mandal reads as unreported.
     *
     * Gating the components stopped the panels and the report buttons,
     * but this hook is what colours the map pins — so a queue reported
     * before the switch was thrown would still have painted a pin green
     * or red, days after anyone could confirm it. The read path has to
     * close with the write path or the map goes on making a claim the
     * rest of the site has withdrawn.
     */
    if (!features.crowd) return {} as Record<string, CrowdDisplay>;

    const at = nowMs === null ? null : new Date(nowMs);
    const out: Record<string, CrowdDisplay> = {};
    for (const m of mandals) {
      const display = crowdDisplayFor(
        state.byMandalId[m.id] ?? null,
        priorInputOf(m),
        phase,
        at
      );
      if (display) out[m.id] = display;
    }
    return out;
  }, [mandals, state, phase, nowMs]);

  const signature = signatureOf(next);
  // Deliberately keyed on the signature alone: `next` is recomputed on
  // every clock tick and is excluded so that an identical result keeps
  // its identity. See signatureOf.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => next, [signature]);
}

/** One mandal — for a badge or a panel that already has its own status. */
export function useCrowdDisplayFor(
  mandalId: string,
  prior: PriorInput | null | undefined
): CrowdDisplay | null {
  const { status } = useCrowdStatus(mandalId);
  const phase = useFestivalPhase();
  const nowMs = useClockMs();

  // Keyed on the prior's three numbers rather than on the object, so a
  // caller may build it inline — `prior={{ ...g }}` — without handing this
  // a new identity on every render and re-deriving a display that cannot
  // have changed.
  const { darshanMinutes = null, peakDarshanMinutes = null, prominence = 0 } = prior ?? {};
  const hasPrior = Boolean(prior);

  return useMemo(
    () =>
      crowdDisplayFor(
        status,
        hasPrior ? { darshanMinutes, peakDarshanMinutes, prominence } : null,
        phase,
        nowMs === null ? null : new Date(nowMs)
      ),
    [status, hasPrior, darshanMinutes, peakDarshanMinutes, prominence, phase, nowMs]
  );
}
