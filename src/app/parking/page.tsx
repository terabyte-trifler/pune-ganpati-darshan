import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleParking, ExternalLink, Navigation, TriangleAlert } from 'lucide-react';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import { getAllGanpatis } from '@/services/ganpati';
import { haversine, formatDistance } from '@/lib/geo';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd, itemList } from '@/lib/seo/jsonld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Ganpati parking in Pune — the official police list' },
  description:
    'The 23 parking places published by the Pune City Traffic Police for ' +
    'Ganeshotsav, each with the nearest mandal and directions.',
  alternates: { canonical: '/parking' },
};

/**
 * Festival parking.
 *
 * The one question the app could not answer for anyone arriving by car or
 * two-wheeler. The list is the Traffic Police's own, and the page's job is
 * to be useful about it without adding a single claim they did not make:
 * no capacity, no fees, no "space available", no opening hours.
 *
 * What the app does add is the part the police map cannot: how far each
 * one is from the nearest mandal, computed from the catalogue's own
 * coordinates. That is a straight-line distance and says so — the peth
 * lanes do not run straight and the walk is always longer.
 *
 * Kept in the police's numbering rather than sorted by distance, so it can
 * be read side by side with a printed notice or a WhatsApp forward of the
 * same list. The gaps in that numbering are theirs.
 */
export default async function ParkingPage() {
  const ganpatis = await getAllGanpatis();

  const rows = PARKING.map((p) => {
    const nearest = ganpatis
      .map((g) => ({ g, d: haversine({ lat: p.lat, lng: p.lng }, g.location) }))
      .sort((a, b) => a.d - b.d)[0];
    return { p, nearest };
  });

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <JsonLd
          data={itemList(
            'Ganeshotsav parking in Pune',
            PARKING.map((p) => ({ name: p.name, url: `/parking#p${p.no}` }))
          )}
        />
        <Breadcrumbs trail={[{ name: 'Parking' }]} />

        <h1 className="font-display mt-2 flex items-center gap-2 text-[30px] font-bold leading-tight text-[var(--chandan)]">
          <CircleParking size={24} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
          Where to park
        </h1>
        <p className="prose-measure mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
          {PARKING.length} places the Pune City Traffic Police have published for
          the festival. They are on the{' '}
          <Link href="/map" className="text-[var(--shendur)]">
            map
          </Link>{' '}
          too, marked <span className="font-semibold text-[#6C8AB0]">P</span>.
        </p>

        {/* Provenance first, because it is what makes the list worth
            trusting — and what bounds it. */}
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            Taken from <strong className="text-[var(--chandan)]">
              {PARKING_SOURCE.authority}
            </strong>
            &rsquo;s own map, &ldquo;{PARKING_SOURCE.title.trim()}&rdquo;, prepared by{' '}
            {PARKING_SOURCE.credit}. Coordinates are theirs.
          </p>
          <a
            href={PARKING_SOURCE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
          >
            Open the police map
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <p className="prose-measure mt-1 flex gap-2 border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed text-[var(--faint)]">
            <TriangleAlert size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--zendu)]" />
            <span>
              This is a published plan, not a live view. It does not say how
              many vehicles fit, what it costs, or whether a place is open or
              already full tonight — and police arrangements can change on the
              day. Follow the barricades and the constable in front of you over
              anything on this page.
            </span>
          </p>
        </div>

        <ul className="mt-6 flex flex-col gap-2.5">
          {rows.map(({ p, nearest }) => (
            <li
              key={p.no}
              id={`p${p.no}`}
              className="scroll-mt-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-3.5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[#6C8AB0]/50 font-mono text-[11px] font-bold tabular-nums text-[#6C8AB0]"
                >
                  {p.no}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-[var(--chandan)]">
                    {p.name}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {p.kind === 'stretch'
                      ? 'A stretch of road — look along it rather than for a gate. '
                      : ''}
                    {nearest && (
                      <>
                        Nearest mandal:{' '}
                        <Link
                          href={`/ganpati/${nearest.g.slug}`}
                          className="text-[var(--chandan)] underline decoration-[var(--line-strong)]"
                        >
                          {nearest.g.name}
                        </Link>
                        , {formatDistance(nearest.d)} in a straight line.
                      </>
                    )}
                  </p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
                  >
                    <Navigation size={13} aria-hidden="true" />
                    Directions
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Two things this list does not have
          </h2>
          <p className="prose-measure mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            The numbering skips 8, 18, 23 and 24. Those were not published, so
            they are not here — a list running 1 to 27 with four invented
            entries would be worse than a list with gaps.
          </p>
          <p className="prose-measure mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            The same police map also carries road closures after 17:00 and the
            junctions being diverted. Those are not on this page yet: a closure
            shown a day late is worse than no closure at all, and they need
            checking against the current notice before they go anywhere near
            the app.
          </p>
        </div>
      </div>
    </main>
  );
}
