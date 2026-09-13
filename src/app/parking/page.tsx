import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleParking, ExternalLink, Navigation, TriangleAlert, Ban, MapPin } from 'lucide-react';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import {
  ROAD_CLOSURES, CLOSURE_JUNCTIONS, CLOSURE_LAYER_TITLE, LINE_7_NOTE,
} from '@/content/diversions';
import { getAllGanpatis } from '@/services/ganpati';
import { haversine, formatDistance } from '@/lib/geo';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd, itemList } from '@/lib/seo/jsonld';
import { MiniMap } from '@/features/map/MiniMapLoader';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Ganpati parking and traffic diversions in Pune' },
  description:
    'The parking places, road closures after 17:00 and junctions published ' +
    'by the Pune City Traffic Police for Ganeshotsav — with the nearest ' +
    'mandal to each parking place, and directions.',
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

        <h1 className="font-display mt-2 text-[30px] font-bold leading-tight text-[var(--chandan)]">
          Parking &amp; road closures
        </h1>
        <p className="prose-measure mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
          What the Pune City Traffic Police have published for the festival:{' '}
          {PARKING.length} places to park, {ROAD_CLOSURES.length} stretches closed
          after 17:00, and {CLOSURE_JUNCTIONS.length} junctions named on the same
          plan. All of it is on the{' '}
          <Link href="/map" className="text-[var(--shendur)]">
            map
          </Link>{' '}
          too — parking as blue <span className="font-semibold text-[#6C8AB0]">P</span>{' '}
          discs, closures as dashed lines.
        </p>

        {/* Jump links: this page is now three lists and someone arriving
            from a WhatsApp forward wants one of them, not a scroll. */}
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-1.5">
          {[
            ['#parking', `Parking (${PARKING.length})`],
            ['#closures', `Closed roads (${ROAD_CLOSURES.length})`],
            ['#junctions', `Junctions (${CLOSURE_JUNCTIONS.length})`],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 text-[13px] text-[var(--muted)]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Everything on one frame, before the lists.
            Someone deciding where to leave a vehicle is comparing parking
            against closures against the mandal they are heading for, and
            three separate lists cannot answer that — the relationship
            between them is spatial. Interactive, so it can be panned into
            the peth the reader actually cares about. */}
        <div className="mt-5 h-[300px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] sm:h-[380px]">
          <MiniMap mandals={ganpatis} showTraffic interactive />
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
          Mandal pins, metro stations, parking as blue P discs and closures as
          dashed lines. Zoom in for the names — they appear as the lanes become
          legible rather than crowding the view. The{' '}
          <Link href="/map" className="text-[var(--shendur)]">
            full map
          </Link>{' '}
          has live queue colours and search.
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

        <h2
          id="parking"
          className="font-display mt-8 flex scroll-mt-6 items-center gap-2 text-[21px] font-bold text-[var(--chandan)]"
        >
          <CircleParking size={19} aria-hidden="true" className="shrink-0 text-[#6C8AB0]" />
          Where to park
        </h2>

        <ul className="mt-3 flex flex-col gap-2.5">
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

        {/* ---------------- Closures ---------------- */}
        <h2
          id="closures"
          className="font-display mt-10 flex scroll-mt-6 items-center gap-2 text-[21px] font-bold text-[var(--chandan)]"
        >
          <Ban size={19} aria-hidden="true" className="shrink-0 text-[#C8BCA8]" />
          Roads closed after 17:00
        </h2>
        <p className="prose-measure mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
          The police map&rsquo;s own layer is titled &ldquo;{CLOSURE_LAYER_TITLE}&rdquo;,
          so the hours are theirs. Stretch names and end points are quoted as
          published.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {ROAD_CLOSURES.map((c) => (
            <li
              key={c.name}
              className="rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3.5 py-2.5"
            >
              <p className="text-[14.5px] font-semibold leading-snug text-[var(--chandan)]">
                {c.name === 'Line 7' ? 'Unnamed stretch' : c.name}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {c.note || (c.name === 'Line 7' ? LINE_7_NOTE : 'No end points given on the map.')}
              </p>
            </li>
          ))}
        </ul>

        {/* ---------------- Junctions ---------------- */}
        <h2
          id="junctions"
          className="font-display mt-10 flex scroll-mt-6 items-center gap-2 text-[21px] font-bold text-[var(--chandan)]"
        >
          <MapPin size={19} aria-hidden="true" className="shrink-0 text-[#C8BCA8]" />
          Junctions on the closure plan
        </h2>
        <p className="prose-measure mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
          These {CLOSURE_JUNCTIONS.length} junctions are marked on the same
          layer. The map does not say what happens at each one — whether it is a
          barricade, a no-entry or a turning point — so neither does this page.
          Expect to be directed when you reach one.
        </p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {CLOSURE_JUNCTIONS.map((j) => (
            <li
              key={j.sourceName}
              className="rounded-[var(--radius-chip)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-1.5 text-[13px] text-[var(--chandan)]"
            >
              {j.no !== null && (
                <span className="mr-1.5 font-mono text-[11px] tabular-nums text-[#C8BCA8]">
                  {j.no}
                </span>
              )}
              {j.name}
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            What this page does not have
          </h2>
          <p className="prose-measure mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            The parking numbering skips 8, 18, 23 and 24. Those were not
            published, so they are not here — a list running 1 to 27 with four
            invented entries would be worse than a list with gaps.
          </p>
          <p className="prose-measure mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            No capacity, no charges, no whether-it-is-full, and no live
            confirmation that a closure is in force tonight. This is a plan
            captured on{' '}
            {new Date(PARKING_SOURCE.captured).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
            , and police arrangements change on the day.
          </p>
        </div>
      </div>
    </main>
  );
}
