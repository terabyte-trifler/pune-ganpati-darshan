import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, Footprints, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { getRoutes, computeRouteTotals, routesForNow } from '@/services/routes';
import { formatDistance, formatDuration } from '@/lib/geo';
import { Button } from '@/components/ui/Button';
import type { CuratedRoute } from '@/types/ganpati';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Curated darshan routes',
  description:
    'Ready-made walking routes through Pune’s Ganpati mandals — the Manache Paach morning walk, evening dekhava trails and short express routes.',
  alternates: { canonical: '/routes' },
};

export const revalidate = 3600;

const TIME_LABEL: Record<string, string> = {
  morning: 'Best in the morning',
  afternoon: 'Best in the afternoon',
  evening: 'Best after dark',
  night: 'Best late',
  any: 'Any time',
};

function RouteCard({ route, highlight = false }: { route: CuratedRoute; highlight?: boolean }) {
  const totals = computeRouteTotals(route);

  return (
    <li>
      <Link
        href={`/routes/${route.slug}`}
        prefetch={false}
        className={`group flex flex-col gap-2 rounded-[var(--radius-card)] border p-4 transition-colors ${
          highlight
            ? 'border-[var(--pital)]/35 bg-[var(--dhoop)]'
            : 'border-[var(--line)] bg-[var(--dhoop)] hover:border-[var(--shendur)]/40'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold leading-tight text-[var(--chandan)]">
              {route.title}
            </h3>
            {route.titleMr && (
              <p lang="mr" className="mt-0.5 text-[12px] text-[var(--muted)]">{route.titleMr}</p>
            )}
          </div>
          <ChevronRight
            size={17}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--faint)] transition-transform group-hover:translate-x-0.5"
          />
        </div>

        {route.summary && (
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">{route.summary}</p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--faint)]">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {totals.stopCount} stops
          </span>
          <span className="inline-flex items-center gap-1">
            <Footprints size={12} aria-hidden="true" />
            {formatDistance(totals.distanceM)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-[var(--zendu)]">
            <Clock size={12} aria-hidden="true" />
            about {formatDuration(totals.totalS)}
          </span>
        </div>

        <p className="text-[12px] text-[var(--faint)]">
          {TIME_LABEL[route.timeOfDay] ?? 'Any time'} · includes about{' '}
          {formatDuration(totals.darshanS)} queuing and darshan
        </p>
      </Link>
    </li>
  );
}

export default async function RoutesPage() {
  const routes = await getRoutes();
  const now = routesForNow(routes);
  const nowSlugs = new Set(now.map((r) => r.slug));
  const rest = routes.filter((r) => !nowSlugs.has(r.slug));

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <h1 className="font-display text-[30px] font-bold text-[var(--chandan)]">
          Curated darshan routes
        </h1>
        <p lang="mr" className="mt-1 text-[14px] text-[var(--muted)]">दर्शन मार्ग</p>
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-[var(--muted)]">
          Each route is ordered for walking, and the time shown includes
          queuing — which is what actually decides whether a plan fits your
          afternoon.
        </p>

        {now.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-1 flex items-center gap-1.5 text-[17px] font-bold text-[var(--chandan)]">
              <Sparkles size={15} aria-hidden="true" className="text-[var(--zendu)]" />
              Good for right now
            </h2>
            <p className="mb-3 text-[12px] text-[var(--faint)]">
              Based on the time of day in Pune.
            </p>
            <ul className="space-y-3">
              {now.map((r) => <RouteCard key={r.id} route={r} highlight />)}
            </ul>
          </section>
        )}

        {rest.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-[17px] font-bold text-[var(--chandan)]">
              All routes
            </h2>
            <ul className="space-y-3">
              {rest.map((r) => <RouteCard key={r.id} route={r} />)}
            </ul>
          </section>
        )}

        <section className="mt-8 rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-gradient-to-br from-[#2a1a0e] to-[var(--dhoop)] p-5">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">
            Build your own
          </h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
            Tell us how long you have and what you want to see, and we&rsquo;ll
            put a route together — or pick mandals yourself.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href="/start">Build my route</Link></Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/plan">Pick mandals myself</Link>
            </Button>
          </div>
        </section>
      </div>
      <SiteFooter className="mx-auto mt-10 max-w-2xl px-4" />
    </main>
  );
}
