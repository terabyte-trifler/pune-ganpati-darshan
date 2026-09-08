'use client';

import { useMemo } from 'react';
import { LocateFixed, Loader2 } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine } from '@/lib/geo';
import { GanpatiCard } from './GanpatiCard';
import { SectionHeader } from './SectionHeader';
import { Button } from '@/components/ui/Button';
import { trackEvent } from '@/services/analytics';
import type { Ganpati } from '@/types/ganpati';

/**
 * "Ganpati near you".
 *
 * Sorting happens locally against already-loaded mandals: no API call, no
 * cost, and it works with the network down (§35, §46). Coordinates never
 * leave the device.
 */
export function NearbyRail({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { state, request } = useGeolocation();

  const nearby = useMemo(() => {
    if (state.status !== 'ready') return [];
    return ganpatis
      .map((g) => ({
        ganpati: g,
        distanceM: haversine(state.position, { lat: g.location.lat, lng: g.location.lng }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 10);
  }, [ganpatis, state]);

  const handleLocate = () => {
    trackEvent('location_enabled');
    request();
  };

  return (
    <>
      <SectionHeader
        title="Ganpati near you"
        titleMr="तुमच्या जवळचे गणपती"
        href={state.status === 'ready' ? '/explore?sort=distance' : undefined}
      />

      {state.status === 'ready' ? (
        <div className="scroll-x flex gap-3 px-4 pb-1">
          {nearby.map(({ ganpati, distanceM }) => (
            <GanpatiCard key={ganpati.id} ganpati={ganpati} distanceM={distanceM} compact />
          ))}
        </div>
      ) : (
        <div className="mx-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          {state.status === 'denied' ? (
            <>
              <p className="text-[14px] font-semibold text-[var(--chandan)]">
                Location access is off
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                Turn it on in your browser settings to sort mandals by
                distance. Everything else works without it.
              </p>
            </>
          ) : state.status === 'unavailable' ? (
            <>
              <p className="text-[14px] font-semibold text-[var(--chandan)]">
                We couldn&rsquo;t get your location
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                Browse by area instead — the peths are all within a short walk
                of each other.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-[var(--chandan)]">
                See what&rsquo;s closest
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                Your location stays on your device — it is only used to sort
                this list.
              </p>
              <Button
                onClick={handleLocate}
                size="sm"
                className="mt-3"
                disabled={state.status === 'locating'}
              >
                {state.status === 'locating' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    Locating…
                  </>
                ) : (
                  <>
                    <LocateFixed size={15} aria-hidden="true" />
                    Near me
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      )}
    </>
  );
}
