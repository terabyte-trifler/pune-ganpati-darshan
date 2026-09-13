'use client';

import { createContext, useContext, useMemo } from 'react';
import { getFestivalPhase, type FestivalPhase } from '@/lib/festival';
import { useClockMs } from './useCrowd';
import type { FestivalConfig } from '@/types/ganpati';

/**
 * The festival's dates, made available to every client surface.
 *
 * The "usually" prior needs to know which day of the festival it is, and
 * until now only the mandal detail page did — it was handed the phase as
 * a prop from its own server component. The prior now colours grey pins
 * on every map and rows in the tracker, so the dates have to reach
 * components several levels down that never fetched anything.
 *
 * A context rather than prop-drilling through four map components, and
 * the config rather than the phase: the phase depends on the reader's
 * clock, and a phase computed on the server would be wrong for anyone
 * reading across midnight IST on a page that was rendered hours earlier.
 *
 * Three dates and a greeting. Nothing here is per-visitor, so it is safe
 * to ship in a static page's payload.
 */

const Ctx = createContext<FestivalConfig | null>(null);

export function FestivalConfigProvider({
  config,
  children,
}: {
  config: FestivalConfig;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={config}>{children}</Ctx.Provider>;
}

export function useFestivalConfig(): FestivalConfig | null {
  return useContext(Ctx);
}

/**
 * Which day of the festival it is on the reader's device, or null.
 *
 * Null before hydration — `useClockMs` returns null on the server — so
 * anything derived from this is absent from the server render and appears
 * on the client. That is deliberate: see crowd-display.
 */
export function useFestivalPhase(): FestivalPhase | null {
  const config = useContext(Ctx);
  const nowMs = useClockMs();

  return useMemo(
    () => (config && nowMs !== null ? getFestivalPhase(config, new Date(nowMs)) : null),
    [config, nowMs]
  );
}
