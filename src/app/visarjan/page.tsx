import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Radio, TriangleAlert, Clock, Ban } from 'lucide-react';
import {
  VISARJAN_SOURCE, VISARJAN_CLOSURES, VISARJAN_RESTRICTIONS,
  PROCESSION_ROUTE, POLICE_TRACKER, KASBA_START,
} from '@/content/visarjan';
import { getAllGanpatis } from '@/services/ganpati';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { DRAWN_CLOSURES, TOTAL_CLOSURES } from '@/lib/maps/visarjan-layer';
import { OSM_CREDIT, VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Visarjan day in Pune — the procession, and the roads that close' },
  description:
    'Anant Chaturdashi in Pune: the seventeen road stretches the Traffic ' +
    'Police close and when, the four roads the miravnuk takes, the order ' +
    'of the Manache Paach, and the police tracker for where it has reached.',
  alternates: { canonical: '/visarjan' },
};

/**
 * Visarjan day.
 *
 * Every other page of this app answers "which mandal, and how long is the
 * queue". On Anant Chaturdashi that question expires around mid-morning:
 * the idols leave the mandaps and the city's attention moves to the
 * procession. This page is what the app has to say on that one day.
 *
 * It deliberately does not carry a departure schedule. Only Kasba's time
 * is published; the rest move when the mandal ahead of them moves. See the
 * note at the top of `content/visarjan.ts`.
 *
 * The live position of the procession is the police's to publish, not
 * ours, so the tracker is the first thing on the page rather than a
 * footnote — it is the only source that is right at the hour you read it.
 */
export default async function VisarjanPage() {
  const ganpatis = await getAllGanpatis();
  const manache = ganpatis
    .filter((g) => g.manacheRank !== null)
    .sort((a, b) => (a.manacheRank ?? 0) - (b.manacheRank ?? 0));

  // Frame on the corridor itself, not on the mandals: the Manache Paach
  // sit inside the peths, and fitting them leaves Karve Road and Jedhe
  // Chowk off the edge of a map that exists to show exactly those.
  const corridorFrame = VISARJAN_GEOMETRY.flatMap((g) =>
    g.segments.flat().map(([lng, lat]) => ({ lat, lng }))
  );

  // Grouped by hour, because the notice is a timetable and reading it as
  // seventeen separate rows hides the shape of the day.
  const byTime = VISARJAN_CLOSURES.reduce<Record<string, typeof VISARJAN_CLOSURES>>(
    (acc, c) => ({ ...acc, [c.from]: [...(acc[c.from] ?? []), c] }),
    {}
  );

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Breadcrumbs trail={[{ name: 'Visarjan' }]} />

        <h1 className="font-display mt-2 text-[30px] font-bold leading-tight text-[var(--chandan)]">
          Visarjan day
        </h1>
        <p className="prose-measure mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
          On Anant Chaturdashi the mandals leave their mandaps and{' '}
          {PROCESSION_ROUTE.mandals} of them take the procession down{' '}
          {PROCESSION_ROUTE.roads.slice(0, -1).join(', ')} and{' '}
          {PROCESSION_ROUTE.roads.at(-1)}, converging at{' '}
          {PROCESSION_ROUTE.convergesAt}. It runs through the night and into
          the next morning.
        </p>

        {/* The live answer, first. Everything below it is a plan made
            yesterday; this is the only thing that knows the hour. */}
        <a
          href={POLICE_TRACKER.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--pital)]/40 bg-gradient-to-r from-[var(--pital)]/[0.12] to-transparent p-4"
        >
          <Radio className="mt-0.5 h-5 w-5 shrink-0 text-[var(--zendu)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-[var(--pital)]">
              Where has the miravnuk reached?
              <ExternalLink className="ml-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-[13.5px] leading-relaxed text-[var(--muted)]">
              The Pune Police track it themselves, at {POLICE_TRACKER.label} —{' '}
              {POLICE_TRACKER.shows}. We link it rather than copy it: a
              position we cached an hour ago would be worse than none.
            </span>
          </span>
        </a>

        {/* The corridor on one frame. The list below is a timetable and
            cannot show the shape of the day: which roads the procession
            takes, and how much of the centre that puts behind a
            barricade. Interactive, so it can be panned into the peth the
            reader actually lives in. */}
        <MiniMap
          mandals={manache}
          showVisarjan
          interactive
          frameOn={corridorFrame}
          className="mt-6 h-[380px] w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] sm:h-[460px]"
        />
        <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
            What the map shows
          </h2>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--muted)]">
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-7 shrink-0 rounded-full"
                style={{ background: '#F2A93B', boxShadow: '0 0 10px #F2A93B88' }}
              />
              The miravnuk&rsquo;s four roads, converging at{' '}
              {PROCESSION_ROUTE.convergesAt}
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-0 w-7 shrink-0 border-t-2 border-dashed"
                style={{ borderColor: '#C8BCA8' }}
              />
              Closed stretches, each labelled with its hour
            </li>
          </ul>
          <p className="prose-measure mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
            {DRAWN_CLOSURES} of the {TOTAL_CLOSURES} closures are drawn. The
            rest name a junction we have no verified position for, and a
            guessed end point draws a confident line down the wrong road —
            so they stay in the list below, where the notice&rsquo;s own
            words are exact. A road missing from the map is not an open
            road. Roads {OSM_CREDIT}.
          </p>
        </div>

        {/* ---------------- The order ---------------- */}
        <h2 className="font-display mt-8 text-[20px] font-bold text-[var(--chandan)]">
          The Manache Paach, in order
        </h2>
        <p className="prose-measure mt-2 text-[14px] leading-[1.7] text-[var(--muted)]">
          {KASBA_START}
        </p>

        <ol className="mt-4 space-y-1.5">
          {manache.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/ganpati/${g.slug}`}
                className="flex min-h-11 items-center gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] px-3.5 py-2.5"
              >
                <span className="font-display shrink-0 text-[18px] font-bold text-[var(--zendu)]">
                  {g.manacheRank}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold text-[var(--chandan)]">
                    {g.name}
                  </span>
                  <span lang="mr" className="block truncate text-[13px] text-[var(--faint)]">
                    {g.nameMr}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {/* ---------------- Closures ---------------- */}
        <h2 className="font-display mt-8 text-[20px] font-bold text-[var(--chandan)]">
          What closes, and when
        </h2>
        <p className="prose-measure mt-2 text-[14px] leading-[1.7] text-[var(--muted)]">
          {VISARJAN_CLOSURES.length} stretches, in the order the notice
          closes them. They reopen as the procession clears them, not at a
          set hour.
        </p>

        <div className="mt-4 space-y-3">
          {Object.entries(byTime).map(([time, closures]) => (
            <div
              key={time}
              className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4"
            >
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--shendur)]">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {time}
              </h3>
              <ul className="mt-2.5 space-y-2">
                {closures.map((c) => (
                  <li key={c.road} className="text-[14px] leading-relaxed">
                    <span className="font-semibold text-[var(--chandan)]">{c.road}</span>
                    <span className="text-[var(--muted)]"> — {c.stretch}</span>
                    {c.disputed && (
                      <span className="mt-0.5 block text-[12px] text-[var(--faint)]">
                        {c.disputed}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---------------- Restrictions ---------------- */}
        <h2 className="font-display mt-8 text-[20px] font-bold text-[var(--chandan)]">
          Also in force
        </h2>
        <ul className="mt-3 space-y-2.5">
          {VISARJAN_RESTRICTIONS.map((r) => (
            <li
              key={r.title}
              className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4"
            >
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-[var(--faint)]" aria-hidden="true" />
              <span>
                <span className="block text-[14.5px] font-semibold text-[var(--chandan)]">
                  {r.title}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-relaxed text-[var(--muted)]">
                  {r.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="prose-measure mt-4 text-[14px] leading-[1.7] text-[var(--muted)]">
          Parking is the same list as every other day of the festival —{' '}
          <Link href="/parking" className="text-[var(--shendur)]">
            the places the police published
          </Link>
          , though the roads reaching some of them close through the morning.
        </p>

        {/* ---------------- What we do not know ---------------- */}
        <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--line-strong)] p-4">
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shendur)]"
            aria-hidden="true"
          />
          <p className="prose-measure text-[13.5px] leading-relaxed text-[var(--muted)]">
            Queue times on this site stop meaning anything once a mandal has
            left its mandap, so the app stops showing them on visarjan
            afternoon rather than showing you a number it no longer believes.
            No mandal but Kasba publishes a departure time, and we have not
            invented the rest.
          </p>
        </div>

        {/* Provenance last, as on /parking: it bounds everything above. */}
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">
            Closures, parking ban and the heavy-vehicle ban are from the{' '}
            {VISARJAN_SOURCE.authority} notice for Anant Chaturdashi, signed
            by {VISARJAN_SOURCE.signedBy}, as reported on{' '}
            {VISARJAN_SOURCE.reports.map((r, i) => (
              <span key={r.url}>
                {i > 0 && ' and '}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--shendur)]"
                >
                  {r.name}
                </a>
              </span>
            ))}
            . Written up on {VISARJAN_SOURCE.captured}. Police arrangements
            change on the day — the tracker above is the one that is current.
          </p>
        </div>
      </div>
    </main>
  );
}
