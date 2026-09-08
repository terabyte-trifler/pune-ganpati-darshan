'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search, X, SlidersHorizontal, LocateFixed } from 'lucide-react';
import { GanpatiCard } from '@/features/discovery/GanpatiCard';
import { Chip } from '@/components/ui/Chip';
import { searchGanpatis } from '@/services/search';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFavorites } from '@/hooks/useFavorites';
import { haversine } from '@/lib/geo';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { Area, Ganpati, GanpatiCategory } from '@/types/ganpati';

/**
 * Explore: search + filters over the full catalogue.
 *
 * Search runs against in-memory data via `useDeferredValue`, so typing stays
 * responsive without a debounce timer and without a request per keystroke
 * (§18). Filters are generated from the data rather than hardcoded (§19).
 */

const DISTANCE_BANDS = [1000, 3000, 5000, 10_000] as const;

export function ExploreView({
  ganpatis, areas, categories, initialCategory, initialArea,
}: {
  ganpatis: Ganpati[];
  areas: Area[];
  categories: Array<{ key: GanpatiCategory; name: string; nameMr: string | null }>;
  initialCategory?: GanpatiCategory;
  initialArea?: string;
}) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Set<GanpatiCategory>>(
    new Set(initialCategory ? [initialCategory] : [])
  );
  const [areaFilter, setAreaFilter] = useState<Set<string>>(
    new Set(initialArea ? [initialArea] : [])
  );
  const [radiusM, setRadiusM] = useState<number | null>(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const { state: geo, request: requestLocation } = useGeolocation();
  const { items: saved, hydrated } = useFavorites();

  const userLocation = geo.status === 'ready' ? geo.position : null;

  // Report searches that found nothing — the most actionable analytics
  // signal for a catalogue product (§40).
  useEffect(() => {
    if (deferredQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      const hits = searchGanpatis(ganpatis, deferredQuery);
      trackEvent(hits.length === 0 ? 'search_no_results' : 'search_performed', {
        props: { q: deferredQuery.slice(0, 40), results: hits.length },
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [deferredQuery, ganpatis]);

  const results = useMemo(() => {
    let list = deferredQuery.trim()
      ? searchGanpatis(ganpatis, deferredQuery, 50).map((h) => h.ganpati)
      : ganpatis;

    if (categoryFilter.size > 0) list = list.filter((g) => categoryFilter.has(g.category));
    if (areaFilter.size > 0) list = list.filter((g) => areaFilter.has(g.area.slug));
    if (savedOnly && hydrated) list = list.filter((g) => saved.includes(g.slug));

    const annotated = list.map((g) => ({
      ganpati: g,
      distanceM: userLocation
        ? haversine(userLocation, { lat: g.location.lat, lng: g.location.lng })
        : null,
    }));

    const withinRadius = radiusM !== null && userLocation
      ? annotated.filter((a) => (a.distanceM ?? Infinity) <= radiusM)
      : annotated;

    // Search relevance order is preserved; otherwise distance, else prominence.
    if (deferredQuery.trim()) return withinRadius;
    return withinRadius.sort((a, b) =>
      userLocation
        ? (a.distanceM ?? 0) - (b.distanceM ?? 0)
        : b.ganpati.prominence - a.ganpati.prominence
    );
  }, [
    ganpatis, deferredQuery, categoryFilter, areaFilter, savedOnly,
    saved, hydrated, userLocation, radiusM,
  ]);

  const activeFilterCount =
    categoryFilter.size + areaFilter.size + (radiusM ? 1 : 0) + (savedOnly ? 1 : 0);

  const toggle = <T,>(set: Set<T>, value: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  const clearAll = () => {
    setCategoryFilter(new Set());
    setAreaFilter(new Set());
    setRadiusM(null);
    setSavedOnly(false);
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* ---------------- Search ---------------- */}
      <div
        className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--raat)]/94 px-4 pb-3 backdrop-blur-xl"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={17}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--shendur)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Ganpati, mandal or area…"
              aria-label="Search Ganpati, mandal or area"
              enterKeyHint="search"
              className={cn(
                'h-12 w-full rounded-[var(--radius-field)] border border-[var(--line-strong)]',
                'bg-[var(--dhoop)] pl-11 pr-10 text-[15px] text-[var(--chandan)]',
                'placeholder:text-[var(--faint)] focus:border-[var(--shendur)]/60 focus:outline-none',
                // 16px prevents iOS Safari zooming the page on focus.
                'text-[16px] sm:text-[15px]'
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[var(--faint)]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-label={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
            className={cn(
              'relative grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-field)]',
              'border border-[var(--line-strong)] bg-[var(--dhoop)]',
              activeFilterCount > 0 && 'border-[var(--shendur)] text-[var(--shendur)]'
            )}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--shendur)] text-[11px] font-bold text-[#1a0e04]">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 space-y-3">
            <FilterRow label="Type">
              {categories.map((c) => (
                <Chip
                  key={c.key}
                  selected={categoryFilter.has(c.key)}
                  onClick={() => toggle(categoryFilter, c.key, setCategoryFilter)}
                >
                  {c.key === 'maanache' && c.nameMr ? c.nameMr : c.name}
                </Chip>
              ))}
              <Chip selected={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
                Saved
              </Chip>
            </FilterRow>

            <FilterRow label="Area">
              {areas.map((a) => (
                <Chip
                  key={a.slug}
                  selected={areaFilter.has(a.slug)}
                  onClick={() => toggle(areaFilter, a.slug, setAreaFilter)}
                >
                  {a.name}
                </Chip>
              ))}
            </FilterRow>

            <FilterRow label="Distance">
              {!userLocation ? (
                <Chip onClick={requestLocation} className="inline-flex items-center gap-1.5">
                  <LocateFixed size={13} aria-hidden="true" />
                  Use my location
                </Chip>
              ) : (
                DISTANCE_BANDS.map((m) => (
                  <Chip
                    key={m}
                    selected={radiusM === m}
                    onClick={() => setRadiusM((cur) => (cur === m ? null : m))}
                  >
                    &lt; {m / 1000} km
                  </Chip>
                ))
              )}
            </FilterRow>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[13px] font-medium text-[var(--shendur)]"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---------------- Results ---------------- */}
      <div className="px-4 pt-4">
        {/* Card titles are h3, so the page needs this level between them and
            the h1 — otherwise the heading order skips a rank and the document
            outline is wrong for screen readers. */}
        <h2 className="sr-only">
          {query ? `Search results for ${query}` : 'Mandals'}
        </h2>
        <p className="mb-3 text-[13px] text-[var(--faint)]" aria-live="polite">
          {results.length} {results.length === 1 ? 'mandal' : 'mandals'}
          {query && <> for &ldquo;{query}&rdquo;</>}
        </p>

        {results.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] px-4 py-10 text-center">
            <p className="text-[15px] font-semibold text-[var(--chandan)]">
              No Ganpati found
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">
              {query
                ? 'Try a shorter spelling, or search by peth — for example “Budhwar”.'
                : 'No mandals match these filters.'}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-3 text-[13px] font-semibold text-[var(--shendur)]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map(({ ganpati, distanceM }, i) => (
              <li key={ganpati.id}>
                <GanpatiCard
                  ganpati={ganpati}
                  distanceM={distanceM}
                  priority={i < 4}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </p>
      <div className="scroll-x flex gap-2 pb-1">{children}</div>
    </div>
  );
}
