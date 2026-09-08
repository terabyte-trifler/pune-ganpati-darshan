'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Search, LocateFixed, X, ChevronRight } from 'lucide-react';
import { BottomSheet, type Detent } from './BottomSheet';
import { useCrowdState } from '@/features/crowd/useCrowd';
import { MapUnavailable } from './MapUnavailable';
import { MapErrorBoundary } from './MapErrorBoundary';
import type { MapFailure } from './MapCanvas';
import type { CrowdLevel } from '@/types/crowd';
import { MapSkeleton } from './MapSkeleton';
import { Chip } from '@/components/ui/Chip';
import { GanpatiImage } from '@/components/ui/GanpatiImage';
import { CategoryBadge } from '@/components/ui/Badge';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFavorites } from '@/hooks/useFavorites';
import { haversine, formatDistance } from '@/lib/geo';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { Area, Ganpati, GanpatiCategory } from '@/types/ganpati';

/**
 * The map surface.
 *
 * MapLibre is code-split so its ~200 KB is only paid for on this route (§33),
 * and it is client-only because it needs a real canvas.
 */
const MapCanvas = dynamic(
  () => import('./MapCanvas').then((m) => m.MapCanvas),
  { ssr: false, loading: () => <MapSkeleton /> }
);

type FilterKey = 'nearby' | 'maanache' | 'famous' | 'historic' | 'local' | 'saved';

const FILTERS: Array<{ key: FilterKey; label: string; labelMr?: string }> = [
  { key: 'nearby', label: 'Nearby' },
  { key: 'maanache', label: 'मानाचे गणपती', labelMr: 'मानाचे गणपती' },
  { key: 'famous', label: 'Famous' },
  { key: 'historic', label: 'Historic' },
  { key: 'local', label: 'Neighbourhood' },
  { key: 'saved', label: 'Saved' },
];

export function MapView({ ganpatis, areas }: { ganpatis: Ganpati[]; areas: Area[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detent, setDetent] = useState<Detent>('half');
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  // No API key to misconfigure, so failures are environmental: no WebGL, a
  // refused graphics context, or unreachable tiles.
  const [mapFailure, setMapFailure] = useState<MapFailure | null>(null);

  /**
   * One subscription for every marker on the map. The store polls once
   * for the whole city, so adding crowd colour to 23 markers costs one
   * request per 20 seconds rather than one per marker (§22).
   */
  const crowdState = useCrowdState();
  const crowdLevels = useMemo(() => {
    const out: Record<string, CrowdLevel> = {};
    for (const [id, status] of Object.entries(crowdState.byMandalId)) {
      if (status.status) out[id] = status.status;
    }
    return out;
  }, [crowdState]);

  const { state: geo, request: requestLocation } = useGeolocation();
  const { items: saved, hydrated } = useFavorites();

  useEffect(() => {
    trackEvent('map_opened');
  }, []);

  const userLocation = geo.status === 'ready' ? geo.position : null;

  const toggleFilter = (key: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else {
        next.add(key);
        // "Nearby" needs a position to mean anything.
        if (key === 'nearby' && geo.status === 'idle') requestLocation();
      }
      return next;
    });
  };

  /** Filtered + distance-annotated list driving both the map and the sheet. */
  const visible = useMemo(() => {
    const categoryFilters = [...filters].filter((f) =>
      ['maanache', 'famous', 'historic', 'local'].includes(f)
    ) as GanpatiCategory[];

    let list = ganpatis;

    if (categoryFilters.length > 0) {
      list = list.filter((g) => categoryFilters.includes(g.category));
    }
    if (areaFilter) {
      list = list.filter((g) => g.area.slug === areaFilter);
    }
    if (filters.has('saved') && hydrated) {
      list = list.filter((g) => saved.includes(g.slug));
    }

    const withDistance = list.map((g) => ({
      ganpati: g,
      distanceM: userLocation
        ? haversine(userLocation, { lat: g.location.lat, lng: g.location.lng })
        : null,
    }));

    if (filters.has('nearby') && userLocation) {
      return withDistance
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0))
        .slice(0, 12);
    }

    return withDistance.sort((a, b) =>
      userLocation
        ? (a.distanceM ?? 0) - (b.distanceM ?? 0)
        : b.ganpati.prominence - a.ganpati.prominence
    );
  }, [ganpatis, filters, areaFilter, saved, hydrated, userLocation]);

  const visibleGanpatis = useMemo(() => visible.map((v) => v.ganpati), [visible]);
  const selected = visible.find((v) => v.ganpati.slug === selectedSlug);

  const handleSelect = useCallback((slug: string | null) => {
    setSelectedSlug(slug);
    if (slug) setDetent('collapsed');
  }, []);

  const mapsOff = mapFailure !== null;

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* ---------------- Map layer ---------------- */}
      {mapsOff ? (
        <MapUnavailable reason={mapFailure ?? 'tiles'} />
      ) : (
        <MapErrorBoundary fallback={<MapUnavailable reason="init" />}>
          <MapCanvas
            crowd={crowdLevels}
            ganpatis={visibleGanpatis}
            selectedSlug={selectedSlug}
            onSelect={handleSelect}
            userLocation={userLocation}
            onReady={(ok, failure) => setMapFailure(ok ? null : (failure ?? 'tiles'))}
          />
        </MapErrorBoundary>
      )}

      {/* ---------------- Top overlay ---------------- */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 px-3"
        style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}
      >
        <Link
          href="/explore"
          className="pointer-events-auto flex h-12 items-center gap-2.5 rounded-full border border-[var(--line-strong)] bg-[var(--raat)]/92 px-4 text-[14px] text-[var(--faint)] shadow-[var(--shadow-float)] backdrop-blur-xl"
        >
          <Search size={17} aria-hidden="true" className="text-[var(--shendur)]" />
          Search Pune Ganpati…
        </Link>

        <div className="scroll-x pointer-events-auto flex gap-2 pb-1">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              selected={filters.has(f.key)}
              onClick={() => toggleFilter(f.key)}
              lang={f.labelMr ? 'mr' : undefined}
            >
              {f.label}
            </Chip>
          ))}
          {areas.map((a) => (
            <Chip
              key={a.slug}
              selected={areaFilter === a.slug}
              onClick={() => setAreaFilter((cur) => (cur === a.slug ? null : a.slug))}
            >
              {a.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* ---------------- Locate button ---------------- */}
      {!mapsOff && (
        <button
          type="button"
          onClick={requestLocation}
          aria-label="Centre map on my location"
          className="absolute right-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--raat)]/92 shadow-[var(--shadow-float)] backdrop-blur-xl"
          style={{ bottom: 'calc(50dvh + 12px)' }}
        >
          <LocateFixed
            size={19}
            aria-hidden="true"
            className={geo.status === 'ready' ? 'text-[var(--tulsi)]' : 'text-[var(--chandan)]'}
          />
        </button>
      )}

      {/* ---------------- Selected mandal card ---------------- */}
      {selected && (
        <div className="absolute inset-x-3 bottom-[calc(14dvh+var(--nav-height))] z-40">
          <div className="relative flex gap-3 rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-[var(--dhoop)] p-2.5 shadow-[var(--shadow-float)]">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              <GanpatiImage ganpati={selected.ganpati} sizes="80px" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <CategoryBadge
                category={selected.ganpati.category}
                rank={selected.ganpati.manacheRank}
              />
              <h2 className="mt-1 clamp-2 text-[14px] font-semibold leading-tight text-[var(--chandan)]">
                {selected.ganpati.name}
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--faint)]">
                {selected.ganpati.area.name}
                {selected.distanceM !== null && (
                  <> · <span className="text-[var(--zendu)]">{formatDistance(selected.distanceM)}</span></>
                )}
              </p>
              <Link
                href={`/ganpati/${selected.ganpati.slug}`}
                className="mt-1.5 inline-flex items-center gap-0.5 text-[13px] font-semibold text-[var(--shendur)]"
              >
                View Ganpati
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSlug(null)}
              aria-label="Close"
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-[var(--faint)]"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Bottom sheet ---------------- */}
      <BottomSheet
        detent={detent}
        onDetentChange={setDetent}
        header={
          <div className="flex items-baseline justify-between px-1 pb-2">
            <h2 className="text-[15px] font-bold text-[var(--chandan)]">
              {filters.has('nearby') && userLocation
                ? 'Ganpati near you'
                : areaFilter
                  ? areas.find((a) => a.slug === areaFilter)?.name
                  : 'Ganpati in Pune'}
            </h2>
            <span className="text-[12px] text-[var(--faint)]">
              {visible.length} {visible.length === 1 ? 'mandal' : 'mandals'}
            </span>
          </div>
        }
      >
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] font-semibold text-[var(--chandan)]">
              No Ganpati found
            </p>
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              Try removing a filter.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] px-3">
            {visible.map(({ ganpati: g, distanceM }) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(g.slug)}
                  aria-current={g.slug === selectedSlug ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 py-2.5 text-left',
                    g.slug === selectedSlug && 'opacity-100'
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <GanpatiImage ganpati={g} sizes="56px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[var(--chandan)]">
                      {g.name}
                    </p>
                    <p lang="mr" className="truncate text-[12px] text-[var(--muted)]">
                      {g.nameMr}
                    </p>
                    <p className="text-[12px] text-[var(--faint)]">
                      {g.area.name}
                      {distanceM !== null && (
                        <> · <span className="text-[var(--zendu)]">{formatDistance(distanceM)}</span></>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--faint)]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>
    </div>
  );
}
