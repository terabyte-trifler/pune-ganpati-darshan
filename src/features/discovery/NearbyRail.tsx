'use client';

import { useMemo } from 'react';
import { LocateFixed, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine } from '@/lib/geo';
import { GanpatiCard } from './GanpatiCard';
import { SectionHeader } from './SectionHeader';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { Ganpati } from '@/types/ganpati';

/**
 * "Ganpati near you".
 *
 * Always shows mandals. It previously showed a permission-request card and
 * nothing else until location was granted — so the most valuable answer on
 * the page ("which one is closest") was a consent dialog, and a visitor who
 * declined saw an empty section forever.
 *
 * Now it lists the best-known mandals immediately and re-sorts by distance
 * once location is available. Sorting happens locally against already-loaded
 * data: no API call, no cost, works offline, and coordinates never leave the
 * device.
 */
export function NearbyRail({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { state, request } = useGeolocation();
  const located = state.status === 'ready';

  const items = useMemo(() => {
    const withDistance = ganpatis.map((g) => ({
      ganpati: g,
      distanceM: located
        ? haversine(state.position, { lat: g.location.lat, lng: g.location.lng })
        : null,
    }));

    return located
      ? withDistance.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0)).slice(0, 8)
      : withDistance.sort((a, b) => b.ganpati.prominence - a.ganpati.prominence).slice(0, 8);
  }, [ganpatis, located, state]);

  const handleLocate = () => {
    trackEvent('location_enabled');
    request();
  };

  return (
    <>
      <SectionHeader
        title={located ? 'Ganpati near you' : "Pune's best known"}
        titleMr={located ? 'तुमच्या जवळचे गणपती' : 'प्रसिद्ध गणपती'}
        href={located ? '/explore?sort=distance' : '/explore'}
      />

      {/* The location control sits above the list, so the list is never
          replaced by a prompt. */}
      {!located && (
        <div className="mb-3 px-4">
          <button
            type="button"
            onClick={handleLocate}
            disabled={state.status === 'locating'}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full border px-4',
              'border-[var(--shendur)]/40 bg-[var(--shendur)]/10 text-[13px] font-semibold',
              'text-[var(--shendur)] transition-colors active:scale-[0.97] disabled:opacity-60'
            )}
          >
            {state.status === 'locating' ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Finding you…
              </>
            ) : (
              <>
                <LocateFixed size={15} aria-hidden="true" />
                Sort by what&rsquo;s closest
              </>
            )}
          </button>

          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
            {state.status === 'denied'
              ? 'Location is off in your browser. Showing the best-known mandals instead.'
              : state.status === 'unavailable'
                ? "We couldn't get your location. Showing the best-known mandals instead."
                : 'Your location stays on your device and is only used to sort this list.'}
          </p>
        </div>
      )}

      <div className="scroll-x flex gap-3 px-4 pb-1">
        {items.map(({ ganpati, distanceM }, i) => (
          <GanpatiCard
            key={ganpati.id}
            ganpati={ganpati}
            distanceM={distanceM}
            compact
            priority={i < 2}
          />
        ))}
      </div>
    </>
  );
}
