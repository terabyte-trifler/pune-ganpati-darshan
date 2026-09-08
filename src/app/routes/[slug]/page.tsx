import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Footprints, MapPin } from 'lucide-react';
import { getRoutes, getRouteBySlug, computeRouteTotals } from '@/services/routes';
import { RouteDetailView } from '@/features/planner/RouteDetailView';
import { ShareButton } from '@/features/discovery/ShareButton';
import { formatDistance, formatDuration } from '@/lib/geo';
import { env } from '@/lib/env';

export const revalidate = 3600;

export async function generateStaticParams() {
  const routes = await getRoutes();
  return routes.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const route = await getRouteBySlug(slug);
  if (!route) return { title: 'Route not found' };

  const totals = computeRouteTotals(route);
  const title = `${route.title} — ${totals.stopCount} mandals, about ${formatDuration(totals.totalS)}`;
  const description =
    route.summary ??
    `A ${formatDistance(totals.distanceM)} walking route through ${totals.stopCount} Pune Ganpati mandals.`;

  return {
    title,
    description,
    alternates: { canonical: `/routes/${route.slug}` },
    openGraph: { title, description, url: `/routes/${route.slug}`, type: 'article' },
  };
}

export default async function RoutePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const route = await getRouteBySlug(slug);
  if (!route) notFound();

  const totals = computeRouteTotals(route);

  // Structured data: an itinerary of places, which is what this is.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: route.title,
    description: route.summary ?? undefined,
    url: `${env.NEXT_PUBLIC_APP_URL}/routes/${route.slug}`,
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: route.stops.length,
      itemListElement: route.stops.map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Place',
          name: s.ganpati.name,
          url: `${env.NEXT_PUBLIC_APP_URL}/ganpati/${s.ganpati.slug}`,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: s.ganpati.location.lat,
            longitude: s.ganpati.location.lng,
          },
        },
      })),
    },
  };

  return (
    <main id="main" className="pb-nav md:pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-4 pt-[calc(var(--safe-top)+16px)]">
        <Link
          href="/routes"
          className="inline-flex items-center gap-1 text-[13px] text-[var(--shendur)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          All routes
        </Link>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.01em] text-[var(--chandan)]">
              {route.title}
            </h1>
            {route.titleMr && (
              <p lang="mr" className="mt-1 text-[15px] text-[var(--muted)]">{route.titleMr}</p>
            )}
          </div>
          <ShareButton
            title={route.title}
            text={route.summary ?? undefined}
            path={`/routes/${route.slug}`}
          />
        </div>

        {route.description && (
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
            {route.description}
          </p>
        )}

        {/* ---------------- Totals ---------------- */}
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {[
            { icon: MapPin, label: 'stops', value: String(totals.stopCount) },
            { icon: Footprints, label: 'walking', value: formatDistance(totals.distanceM) },
            { icon: Clock, label: 'in total', value: formatDuration(totals.totalS) },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] p-3"
            >
              <Icon size={14} aria-hidden="true" className="text-[var(--shendur)]" />
              <dd className="mt-1 text-[18px] font-bold leading-none text-[var(--chandan)]">
                {value}
              </dd>
              <dt className="mt-1 text-[11px] text-[var(--faint)]">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <RouteDetailView route={route} totals={totals} />
        </div>
      </div>
    </main>
  );
}
