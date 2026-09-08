import Link from 'next/link';
import { Search, Route as RouteIcon, ChevronRight } from 'lucide-react';
import {
  getAllGanpatis, getAreas, getFestivalConfig, getManachePaach,
} from '@/services/ganpati';
import { getRoutes, computeRouteTotals } from '@/services/routes';
import { formatDuration } from '@/lib/geo';
import { FestivalCountdown } from '@/features/discovery/FestivalCountdown';
import { SectionHeader } from '@/features/discovery/SectionHeader';
import { GanpatiCard } from '@/features/discovery/GanpatiCard';
import { NearbyRail } from '@/features/discovery/NearbyRail';
import { Button } from '@/components/ui/Button';

/**
 * Homepage.
 *
 * A Server Component: the catalogue is in the initial HTML, so the page is
 * useful before hydration on a slow connection (§33). The only client
 * island is the nearby rail, which needs geolocation.
 *
 * Revalidated hourly — mandal data changes rarely, and the countdown moves
 * once a day.
 */
export const revalidate = 3600;

export default async function HomePage() {
  const [festival, all, manache, areas, routes] = await Promise.all([
    getFestivalConfig(),
    getAllGanpatis(),
    getManachePaach(),
    getAreas(),
    getRoutes(),
  ]);

  const iconic = all.filter((g) => g.category !== 'maanache').slice(0, 8);
  const coreAreas = areas.filter((a) => a.isCore);

  return (
    <main id="main" className="pb-nav md:pb-8">
      {/* ---------------- Hero ---------------- */}
      <section className="grain relative overflow-hidden px-4 pt-[calc(var(--safe-top)+20px)]">
        {/* Warm glow anchored behind the wordmark */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 h-64"
          style={{
            background:
              'radial-gradient(60% 60% at 50% 40%, rgb(226 98 27 / 0.28) 0%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-2xl">
          <FestivalCountdown config={festival} />

          <h1 className="mt-6 text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[var(--chandan)] sm:text-[42px]">
            Experience Pune&rsquo;s
            <span className="block bg-gradient-to-r from-[var(--zendu)] via-[var(--shendur)] to-[var(--pital)] bg-clip-text text-transparent">
              Ganpati
            </span>
          </h1>

          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--muted)]">
            Find the mandals near you, see the Manache Paach in ceremonial
            order, and plan a walkable darshan route through the old peths.
          </p>

          {/* Search is the most prominent control on the page (§6) */}
          <Link
            href="/explore"
            className="mt-5 flex h-14 items-center gap-3 rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--dhoop)] px-4 text-[15px] text-[var(--faint)] transition-colors hover:border-[var(--shendur)]/50"
          >
            <Search size={19} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
            Search Ganpati, mandal or area…
          </Link>

          <div className="mt-3 flex gap-2">
            <Button asChild size="md" className="flex-1">
              <Link href="/map">Open map</Link>
            </Button>
            <Button asChild variant="secondary" size="md" className="flex-1">
              <Link href="/start">
                <RouteIcon size={16} aria-hidden="true" />
                Build my route
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ---------------- Near you ---------------- */}
      <section className="mt-10">
        <NearbyRail ganpatis={all} />
      </section>

      {/* ---------------- Manache Paach ---------------- */}
      <section className="mt-10">
        <SectionHeader
          title="Manache Paach"
          titleMr="पुण्यातील मानाचे गणपती"
          href="/category/maanache"
        />
        <p className="mb-3 px-4 text-[13px] leading-relaxed text-[var(--muted)]">
          The five mandals with ceremonial precedence, in the order the
          procession follows.
        </p>
        <ol className="mx-4 divide-y divide-[var(--line)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--pital)]/25 bg-[var(--dhoop)]">
          {manache.map((g) => (
            <li key={g.id}>
              <Link
                href={`/ganpati/${g.slug}`}
                prefetch={false}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-[var(--dhoop-2)]"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--pital)]/40 text-[13px] font-bold text-[var(--pital)]"
                >
                  {g.manacheRank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--chandan)]">
                    {g.name}
                  </span>
                  <span lang="mr" className="block truncate text-[12px] text-[var(--muted)]">
                    {g.nameMr ?? g.area.name}
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--faint)]" />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- Iconic ---------------- */}
      <section className="mt-10">
        <SectionHeader title="Pune's most iconic" titleMr="प्रसिद्ध गणपती" href="/explore" />
        <div className="scroll-x flex gap-3 px-4 pb-1">
          {iconic.map((g, i) => (
            <GanpatiCard key={g.id} ganpati={g} compact priority={i < 2} />
          ))}
        </div>
      </section>

      {/* ---------------- Areas ---------------- */}
      <section className="mt-10">
        <SectionHeader title="Explore by area" titleMr="पेठेनुसार" />
        <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-3">
          {coreAreas.map((a) => (
            <Link
              key={a.id}
              href={`/area/${a.slug}`}
              className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] p-3 transition-colors hover:border-[var(--shendur)]/40"
            >
              <span className="block text-[14px] font-semibold text-[var(--chandan)]">
                {a.name}
              </span>
              <span lang="mr" className="block text-[12px] text-[var(--muted)]">
                {a.nameMr}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- Curated routes ---------------- */}
      <section className="mt-10">
        <SectionHeader title="Ready-made routes" titleMr="दर्शन मार्ग" href="/routes" />
        <div className="scroll-x flex gap-3 px-4 pb-1">
          {routes.slice(0, 5).map((r) => {
            const totals = computeRouteTotals(r);
            return (
              <Link
                key={r.id}
                href={`/routes/${r.slug}`}
                prefetch={false}
                className="w-[230px] shrink-0 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-3.5 [scroll-snap-align:start] transition-colors hover:border-[var(--shendur)]/40"
              >
                <h3 className="clamp-2 text-[14px] font-bold leading-tight text-[var(--chandan)]">
                  {r.title}
                </h3>
                {r.summary && (
                  <p className="clamp-2 mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                    {r.summary}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-[var(--faint)]">
                  {totals.stopCount} stops ·{' '}
                  <span className="text-[var(--zendu)]">
                    about {formatDuration(totals.totalS)}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------------- Plan CTA ---------------- */}
      <section className="mt-10 px-4">
        <div className="grain relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-gradient-to-br from-[#2a1a0e] to-[var(--dhoop)] p-5">
          <h2 className="text-[18px] font-bold text-[var(--chandan)]">
            Build your darshan
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
            Tell us how long you have and what you want to see. We count
            queuing as well as walking, so the plan actually fits.
          </p>
          <Button asChild size="md" className="mt-4">
            <Link href="/start">Build my route</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
