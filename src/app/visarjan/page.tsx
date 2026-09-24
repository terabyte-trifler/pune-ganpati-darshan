import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, Radio, TriangleAlert, Clock, Ban } from 'lucide-react';
import {
  VISARJAN_SOURCE, VISARJAN_CLOSURES, VISARJAN_RESTRICTIONS,
  PROCESSION_ROUTE, POLICE_TRACKER, KASBA_START,
  MANACHE_ASSEMBLY, MANDALS_WITH_SCHEDULES, TIMELINE_SOURCES,
  DIVERSION_POINTS, RING_ROAD_ADVICE, NO_PARKING_ROADS, OUTLYING_AREAS,
} from '@/content/visarjan';
import { mergedTimings, mandalsWithTimings } from '@/lib/visarjan-timings';
import { TimingsTimeline } from '@/features/visarjan/TimingsTimeline';
import { UpNext } from '@/features/visarjan/UpNext';
import { getFestivalConfig } from '@/services/ganpati';
import { isVisarjanImminent, getFestivalPhase } from '@/lib/festival';
import { getAllGanpatis } from '@/services/ganpati';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MiniMap } from '@/features/map/MiniMapLoader';
import {
  DRAWN_CLOSURES, TOTAL_CLOSURES, DRAWN_DIVERSIONS, TOTAL_DIVERSIONS,
  DRAWN_CHECKPOINTS, ALL_CHECKPOINTS, RING_LENGTH_KM, RING_STOPS, POLICE_SOURCE,
  PARKING_COUNT,
} from '@/lib/maps/visarjan-layer';
import { POLICE_PARKING } from '@/content/visarjan-police';
import { OSM_CREDIT, VISARJAN_GEOMETRY } from '@/content/visarjan-geometry';
import { RING_PATH } from '@/content/visarjan-ringroad';

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
  const [ganpatis, festival] = await Promise.all([getAllGanpatis(), getFestivalConfig()]);
  const rows = mergedTimings();

  // The day and its eve are different states, and the clock means
  // different things in each: on the eve every published hour is still
  // ahead, but on tomorrow's clock, not tonight's.
  const phase = getFestivalPhase(festival);
  const isVisarjanDay = phase.phase === 'during' && phase.isVisarjan;
  const isEve = isVisarjanImminent(festival) && !isVisarjanDay;
  const timingMandals = mandalsWithTimings(rows);
  const manache = ganpatis
    .filter((g) => g.manacheRank !== null)
    .sort((a, b) => (a.manacheRank ?? 0) - (b.manacheRank ?? 0));

  // Frame on the corridor and the ring together, not on the mandals: the
  // Manache Paach sit inside the peths, and fitting them leaves Karve
  // Road and Jedhe Chowk off the edge of a map that exists to show
  // exactly those.
  //
  // The ring is included because leaving it out put only a fifth of it on
  // screen — green fragments running off two edges, which reads as a
  // broken line rather than a loop. It costs about half a zoom level: the
  // frame goes from 4.2 km wide to 5.3, and the peths stay legible.
  const corridorFrame = [
    ...VISARJAN_GEOMETRY.flatMap((g) => g.segments.flat()),
    ...RING_PATH,
  ].map(([lng, lat]) => ({ lat, lng }));

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

        {/* Jump links. The page is nearly seven screens and is mostly
            reached from a forwarded link, so the reader arrives wanting
            one of these sections rather than the top of a scroll —
            exactly the reasoning /parking already follows.

            Plain anchors, not buttons: they work before hydration and
            they survive being shared as a URL. */}
        <nav
          aria-label="Sections of this page"
          className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
        >
          {[
            ['#timings', 'Timings'],
            ['#closures', `Closed roads (${VISARJAN_CLOSURES.length})`],
            ['#map', 'Map'],
            ['#order', 'Manache Paach'],
            ['#diversions', 'Diversions'],
            ['#rules', 'Parking & bans'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 text-[13px] text-[var(--muted)]"
            >
              {label}
            </a>
          ))}
        </nav>

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
        <UpNext rows={rows} isVisarjanDay={isVisarjanDay} isEve={isEve} />

        <div id="map" className="scroll-mt-4" />
        <MiniMap
          mandals={ganpatis}
          showVisarjan
          showParking={false}
          showPedestrianFlow={false}
          uniformPins
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
                className="h-1 w-7 shrink-0 rounded-full"
                style={{ background: '#5FB872' }}
              />
              The ring road — the way round, and the only line here that
              means go
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-0 w-7 shrink-0 border-t-2 border-dashed"
                style={{ borderColor: '#C8BCA8' }}
              />
              Closed stretches, each labelled with its hour
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full border-2"
                style={{ background: '#14100C', border: '2px solid #FFFFFF' }}
              />
              Kasba&rsquo;s checkpoints, each carrying the hour it is due
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-[#0E1724]"
                style={{ background: '#6C8AB0', border: '1.5px solid #14100C' }}
              >
                P
              </span>
              The {PARKING_COUNT} places the police name for today — chosen
              to stay reachable from the ring
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: '#c9a227', border: '1.5px solid #14100C' }}
              />
              All {ganpatis.length} mandals, one colour — no queue is claimed
              once the idols have left
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full border-2"
                style={{ borderColor: '#E2621B', background: '#14100C' }}
              />
              Diversion points — where you are turned around
            </li>
          </ul>
          <p className="prose-measure mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
            The roads are the{' '}
            <a
              href={POLICE_SOURCE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--shendur)]"
            >
              {POLICE_SOURCE.authority}&rsquo;s own plan
            </a>{' '}
            — their geometry, not our reconstruction of it. Where the two
            disagreed, theirs wins; they agreed to within 30 m on every road
            we had already drawn.
          </p>
          <p className="prose-measure mt-2 text-[11.5px] leading-relaxed text-[var(--faint)]">
            {DRAWN_CHECKPOINTS} of Kasba&rsquo;s {ALL_CHECKPOINTS} checkpoints are
          marked, each verified to sit on the corridor itself rather than
          merely to share a name — the test that rejected a &ldquo;Vaibhav&rdquo;
          2.3&nbsp;km away. The other{' '}
          {ALL_CHECKPOINTS - DRAWN_CHECKPOINTS} are in the list below with
          their times.{' '}
          {DRAWN_CLOSURES} of the {TOTAL_CLOSURES} closures are drawn. The
            rest name a junction we have no verified position for, and a
            guessed end point draws a confident line down the wrong road —
            so they stay in the list below, where the notice&rsquo;s own
            words are exact. A road missing from the map is not an open
            road. Roads {OSM_CREDIT}.
          </p>
        </div>

        {/* ---------------- Timings ----------------
            One list, ordered by the clock, because that is how the
            question arrives on the day: not "when does Kasba go" but
            "what comes past here in the next hour". */}
        <h2
          id="timings"
          className="font-display mt-8 scroll-mt-4 text-[20px] font-bold text-[var(--chandan)]"
        >
          Timings for the day
        </h2>
        <p className="prose-measure mt-2 text-[14px] leading-[1.7] text-[var(--muted)]">
          Every time any mandal has published, in one list. These are
          intentions, not observations — the procession is known for
          running late, so take this as the order and rhythm of the day and
          the{' '}
          <a
            href={POLICE_TRACKER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--shendur)]"
          >
            live tracker
          </a>{' '}
          as the hour.
        </p>

        <TimingsTimeline
          rows={rows}
          mandals={timingMandals}
          isToday={isVisarjanDay}
        />

        <p className="prose-measure mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-3.5 text-[13px] leading-relaxed text-[var(--muted)]">
          {MANACHE_ASSEMBLY}
        </p>

        <p className="prose-measure mt-3 text-[12px] leading-relaxed text-[var(--faint)]">
          {MANDALS_WITH_SCHEDULES} of the mandals on this site have published
          times. The others have not, and each moves when the one ahead of it
          moves, so there is no hour to print for them. Beware of the timings
          circulating for the Manache Paach that read like this list — 11:45
          for Kasba, 10:00 for Tambdi Jogeshwari — as those are the{' '}
          <em>aagman</em> times from 14 September, not the procession. Grey
          markers are{' '}
          <a href={TIMELINE_SOURCES.policeUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--shendur)]">
            police
          </a>
          ; marigold are the mandal&rsquo;s own, Kasba&rsquo;s checkpoints
          coming from its trust&rsquo;s published Laxmi Road schedule.
        </p>

        {/* ---------------- The order ---------------- */}
        <h2
          id="order"
          className="font-display mt-8 scroll-mt-4 text-[20px] font-bold text-[var(--chandan)]"
        >
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
        <h2
          id="closures"
          className="font-display mt-8 scroll-mt-4 text-[20px] font-bold text-[var(--chandan)]"
        >
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
                    {/* Marked as not-the-notice, in its own colour. A
                        local report can be more current than an order
                        written days ahead, and must still never be read
                        as the order. */}
                    {c.localNote && (
                      <span className="mt-1 block text-[12px] leading-relaxed text-[var(--shendur)]">
                        <strong className="font-semibold">On the ground:</strong>{' '}
                        <span className="text-[var(--muted)]">{c.localNote}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ---------------- Diversions ---------------- */}
        <h2
          id="diversions"
          className="font-display mt-8 scroll-mt-4 text-[20px] font-bold text-[var(--chandan)]"
        >
          Where you will be turned around
        </h2>
        <p className="prose-measure mt-2 text-[14px] leading-[1.7] text-[var(--muted)]">
          A different fact from a road being shut, and the more useful one
          if you are riding: these are the junctions the police named as
          diversion points, where the decision gets made for you as the
          procession reaches the road behind them.
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {DIVERSION_POINTS.map((d) => (
            <li
              key={d.name}
              className="flex items-baseline gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] px-3.5 py-2.5"
            >
              <span
                aria-hidden="true"
                className="mt-1 h-2 w-2 shrink-0 rounded-full border-2"
                style={{
                  borderColor: d.lat ? 'var(--shendur)' : 'var(--line-strong)',
                  background: 'transparent',
                }}
              />
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--chandan)]">
                  {d.name}
                </span>
                <span className="block text-[12.5px] text-[var(--faint)]">{d.road}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="prose-measure mt-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
          {DRAWN_DIVERSIONS} of the {TOTAL_DIVERSIONS} are on the map above —
          the ones the police&rsquo;s own closure map already gives a position
          for. The rest are named here and not placed, for the same reason
          the undrawn closures are not: a junction guessed onto the wrong
          corner is worse than one you find yourself.
        </p>

        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
            Going round, not through
          </h3>
          <p className="prose-measure mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
            {RING_ROAD_ADVICE}
          </p>
          <p className="prose-measure mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            It is drawn on the map above in green, as a{' '}
            {RING_LENGTH_KM} km loop through{' '}
            {RING_STOPS.map((r) => r.name).slice(0, -1).join(', ')} and{' '}
            {RING_STOPS.at(-1)?.name} — the one line up there that means go
            rather than do not.
          </p>
          <p className="prose-measure mt-2 text-[11.5px] leading-relaxed text-[var(--faint)]">
            Where the ring meets a closed road it is the closure that holds,
            not the ring. They touch at the junctions on purpose: Nal Stop
            is a point on this loop and the end of the Karve Road closure,
            which is exactly why the police name it a diversion point. The
            police regulate those junctions as the restrictions come in
            through the day, so treat the loop as a direction of travel
            rather than a guaranteed road.
          </p>
        </div>

        {/* ---------------- Restrictions ---------------- */}
        <h2
          id="rules"
          className="font-display mt-8 scroll-mt-4 text-[20px] font-bold text-[var(--chandan)]"
        >
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
          {OUTLYING_AREAS.slice(0, -1).join(', ')} and {OUTLYING_AREAS.at(-1)}{' '}
          have their own arrangements for the day, separate from the central
          plan on this page. No-parking orders also cover{' '}
          {NO_PARKING_ROADS.length} roads alongside the procession corridor.
        </p>

        <h3 className="mt-6 text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
          Where the police say to park today
        </h3>
        <p className="prose-measure mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          {POLICE_PARKING.length} places, from the police&rsquo;s own visarjan
          map — a different and shorter list than the one the rest of the
          festival uses, because most of the usual places sit behind a road
          that shuts this morning. They are marked on the map above as blue
          P discs.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {POLICE_PARKING.map((p) => (
            <li
              key={p.name}
              className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2 text-[13.5px] text-[var(--chandan)]"
            >
              {p.name}
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
