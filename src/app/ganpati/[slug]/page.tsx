import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Clock, CalendarDays } from 'lucide-react';
import { getAllGanpatis, getGanpatiBySlug } from '@/services/ganpati';
import { CategoryBadge, TempleBadge, ConfidenceBadge, CATEGORY_LABEL } from '@/components/ui/Badge';
import { GanpatiImage } from '@/components/ui/GanpatiImage';
import { SaveButton } from '@/features/favorites/SaveButton';
import { ShareButton } from '@/features/discovery/ShareButton';
import { AddToPlanButton } from '@/features/planner/AddToPlanButton';
import { DirectionsButton } from '@/features/discovery/DirectionsButton';
import { GanpatiCard } from '@/features/discovery/GanpatiCard';
import { ViewTracker } from '@/features/discovery/ViewTracker';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { CrowdPanel } from '@/features/crowd/CrowdPanel';
import { haversine } from '@/lib/geo';
import { env } from '@/lib/env';

/**
 * Mandal detail page.
 *
 * Statically generated per slug with full metadata, so the URL is
 * independently shareable and indexable without going through the app
 * shell (§53).
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const all = await getAllGanpatis();
  return all.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = await getGanpatiBySlug(slug);
  if (!g) return { title: 'Ganpati not found' };

  const title = `${g.name} — timings, location & directions`;
  const description =
    g.description ??
    `${g.name} in ${g.area.name}, Pune. Location, directions and darshan information for Ganeshotsav.`;

  return {
    title,
    description,
    alternates: { canonical: `/ganpati/${g.slug}` },
    openGraph: {
      title,
      description,
      url: `/ganpati/${g.slug}`,
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function GanpatiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getGanpatiBySlug(slug);
  if (!g) notFound();

  const all = await getAllGanpatis();
  const nearby = all
    .filter((o) => o.slug !== g.slug)
    .map((o) => ({
      ganpati: o,
      distanceM: haversine(
        { lat: g.location.lat, lng: g.location.lng },
        { lat: o.location.lat, lng: o.location.lng }
      ),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 6);

  /**
   * Structured data. `Place` rather than `LocalBusiness` — a mandal is not
   * a business, and openingHours is omitted because we do not have verified
   * timings (§41).
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: g.name,
    alternateName: g.nameMr ?? undefined,
    description: g.description ?? undefined,
    url: `${env.NEXT_PUBLIC_APP_URL}/ganpati/${g.slug}`,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: g.location.lat,
      longitude: g.location.lng,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: g.location.address ?? undefined,
      addressLocality: g.area.name,
      addressRegion: 'Maharashtra',
      addressCountry: 'IN',
    },
  };

  return (
    <main id="main" className="pb-nav md:pb-10">
      <ViewTracker ganpatiId={g.id} slug={g.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------------- Hero image ---------------- */}
      <div className="relative aspect-[4/3] w-full sm:aspect-[21/9]" style={{ containerType: 'inline-size' }}>
        <GanpatiImage ganpati={g} priority sizes="100vw" showCredit />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--raat)] to-transparent"
        />
        <Link
          href="/explore"
          aria-label="Back to explore"
          className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-[var(--raat)]/70 backdrop-blur"
          style={{ top: 'calc(var(--safe-top) + 12px)' }}
        >
          <ArrowLeft size={19} aria-hidden="true" />
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* ---------------- Identity ---------------- */}
        {/* Pulled up over the hero gradient; needs its own stacking
            context or the image container paints over it. */}
        <div className="relative z-10 -mt-6 flex flex-wrap items-center gap-2">
          <CategoryBadge category={g.category} rank={g.manacheRank} />
          {g.isTemple && <TempleBadge />}
          <span className="rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)] px-2 py-0.5 text-[12px] font-medium text-[var(--muted)]">
            {g.area.name}
          </span>
          <ConfidenceBadge confidence={g.confidence} />
        </div>

        <h1 className="font-display mt-3 text-[30px] font-bold leading-tight text-[var(--chandan)]">
          {g.name}
        </h1>
        {g.nameMr && (
          <p lang="mr" className="mt-1 text-[16px] text-[var(--muted)]">{g.nameMr}</p>
        )}

        {g.description && (
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">
            {g.description}
          </p>
        )}

        {/*
          Primary actions, pinned to the bottom of the viewport on phones once
          they would scroll away. "Get directions" is the whole point of the
          page, and on a phone held one-handed it was otherwise stranded above
          the fold after any scrolling. `sticky` keeps it in normal flow until
          that happens, so nothing is duplicated and desktop is unaffected.
        */}
        <div
          className="sticky z-20 -mx-4 mt-5 border-t border-[var(--line)] bg-[var(--raat)]/95 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
          style={{ bottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
        >
          <div className="flex items-center gap-2">
            <DirectionsButton ganpati={g} className="flex-1" />
            <SaveButton slug={g.slug} name={g.name} />
            <ShareButton
              title={g.name}
              text={g.description ?? undefined}
              path={`/ganpati/${g.slug}`}
            />
          </div>
          <AddToPlanButton slug={g.slug} name={g.name} full className="mt-2" />
        </div>

        {/* ---------------- Facts ---------------- */}
        {/* Each wrapper holds only <dt>/<dd>; the icon lives inside the <dt>,
            because a <dl> may not contain arbitrary nested elements. */}
        {/* Crowd sits above the reference details on purpose: timings and
            history do not change, but whether there is a 40-minute queue
            right now is the thing someone standing on Laxmi Road opened
            this page to find out. */}
        <CrowdPanel
          mandalId={g.id}
          mandalName={g.name}
          mandalLocation={g.location}
          reportingEnabled={g.crowdReportingEnabled}
        />

        <dl className="mt-6 divide-y divide-[var(--line)] overflow-hidden surface rounded-[var(--radius-card)] border border-[var(--line)]">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 p-3.5">
            <dt className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--faint)]">
              <MapPin size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
              Location
            </dt>
            <dd className="col-span-2 mt-0.5 pl-[23px] text-[14px] text-[var(--chandan)]">
              {g.location.address ?? `${g.area.name}, Pune`}
            </dd>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-3 p-3.5">
            <dt className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--faint)]">
              <Clock size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
              Darshan timings
            </dt>
            <dd className="col-span-2 mt-0.5 pl-[23px] text-[14px] text-[var(--chandan)]">
                {g.timings.open && g.timings.close ? (
                  `${g.timings.open} – ${g.timings.close}`
                ) : (
                  /* We do not invent timings. See docs/01-product-audit.md D2. */
                  <span className="text-[var(--muted)]">
                    Not announced yet — most mandals confirm timings a few days
                    before the festival.
                  </span>
                )}
            </dd>
            {g.timings.note && (
              <dd className="col-span-2 mt-1 pl-[23px] text-[13px] text-[var(--muted)]">
                {g.timings.note}
              </dd>
            )}
          </div>

          {g.establishedYear && (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 p-3.5">
              <dt className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--faint)]">
                <CalendarDays size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
                Established
              </dt>
              <dd className="col-span-2 mt-0.5 pl-[23px] text-[14px] text-[var(--chandan)]">
                {g.establishedYear}
              </dd>
            </div>
          )}
        </dl>

        {/* ---------------- Photos ---------------- */}
        {g.images.length > 1 && (
          <section className="mt-5">
            <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
              Photos
            </h2>
            <div className="scroll-x -mx-4 flex gap-2 px-4">
              {g.images.map((image) => (
                <figure key={image.id} className="w-[190px] shrink-0 [scroll-snap-align:start]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-field)]">
                    <Image
                      src={image.url}
                      alt={image.alt ?? g.name}
                      fill
                      sizes="190px"
                      className="object-cover"
                    />
                  </div>
                  {image.credit && (
                    <figcaption className="mt-1 truncate text-[10px] text-[var(--faint)]">
                      {image.credit}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
              Each photograph is credited to its photographer.{' '}
              <Link href="/licences" className="text-[var(--shendur)] underline">
                Sources and licences
              </Link>
            </p>
          </section>
        )}

        {/* ---------------- Where it is ---------------- */}
        <section className="mt-4">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
            Where it is
          </h2>
          <MiniMap mandals={[g]} zoom={16} className="h-56 w-full" />
          <p className="mt-1.5 text-[12px] text-[var(--faint)]">
            {g.confidence === 'verified'
              ? 'Location is cross-checked.'
              : 'Location is accurate to the lane rather than the doorway.'}
          </p>
        </section>

        {/* ---------------- Visitor tip ---------------- */}
        {g.visitorTip && (
          <aside className="mt-4 rounded-[var(--radius-card)] border border-[var(--zendu)]/25 bg-[var(--zendu)]/[0.07] p-4">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[var(--zendu)]">
              Before you go
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--chandan)]">
              {g.visitorTip}
            </p>
          </aside>
        )}

        {/* ---------------- Tags ---------------- */}
        {g.tags.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <li
                key={t}
                className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--faint)]"
              >
                {t.replace(/-/g, ' ')}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------- Nearby ---------------- */}
      <section className="mt-10">
        <div className="mb-3 px-4">
          <h2 className="text-[17px] font-bold text-[var(--chandan)]">Nearby mandals</h2>
          <p className="text-[12px] text-[var(--muted)]">
            Walking distance from {g.name.replace(/^(Shri|Shrimant)\s+/i, '')}
          </p>
        </div>
        <div className="scroll-x flex gap-3 px-4 pb-1">
          {nearby.map(({ ganpati, distanceM }) => (
            <GanpatiCard key={ganpati.id} ganpati={ganpati} distanceM={distanceM} compact />
          ))}
        </div>
      </section>

      <p className="mt-8 px-4 text-[12px] leading-relaxed text-[var(--faint)]">
        {g.confidence === 'verified'
          ? 'Location and history for this mandal are cross-checked. Timings are set by the mandal each year.'
          : 'This entry is compiled from community information. Coordinates are accurate to the lane rather than the doorway.'}{' '}
        <Link
          href={`/category/${g.category}`}
          className="mt-2 inline-flex min-h-11 items-center text-[var(--shendur)] underline"
        >
          More {CATEGORY_LABEL[g.category]} mandals
        </Link>
      </p>
    </main>
  );
}
