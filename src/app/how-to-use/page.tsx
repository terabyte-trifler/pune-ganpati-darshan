import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Mail, Phone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'How to use',
  description:
    'A picture-by-picture guide to Pune Ganpati Darshan — read the live queue colours, report the crowd where you are standing, and build a walking, two-wheeler or metro route around the time you actually have.',
  alternates: { canonical: '/how-to-use' },
};

export const revalidate = 3600;

/**
 * How to use.
 *
 * Written for someone who has never opened the app and is not going to
 * read an essay before their evening starts. Every step is a screenshot of
 * the real, live app with the sentence that goes with it — not a diagram
 * and not a description of a screen the reader then has to go find.
 *
 * The order follows how the app actually gets used rather than how it is
 * built: what's short right now, tell everyone what you can see, the map,
 * then a route, then the reference material. Reporting the crowd comes
 * second on purpose — the tracker is only as good as the number of people
 * who tap those three buttons, so the ask arrives before anything else
 * competes for attention.
 *
 * The screenshots are captured from production at 390x844 @2x, which is a
 * mid-size Android in portrait — what most people are actually holding.
 * They live in /public/guide as WebP with explicit dimensions so the page
 * lays out before a single one of them has loaded.
 */

/** Half of the intrinsic pixel size: they are all 2x captures. */
type Shot = {
  src: string;
  alt: string;
  caption: string;
  w: number;
  h: number;
};

type Step = {
  n: number;
  id: string;
  title: string;
  /** Two or three words for the jump chips. */
  short: string;
  marathi: string;
  lede: string;
  /** The instructions. Short enough to follow while walking. */
  dos: string[];
  shots: Shot[];
  /** Optional callout: the thing people get wrong or ask about. */
  note?: { heading: string; body: string };
  cta?: { href: string; label: string };
};

const STEPS: Step[] = [
  {
    n: 1,
    id: 'crowd',
    title: 'See which queues are short right now',
    short: 'Live crowd',
    marathi: 'आत्ताची गर्दी',
    lede:
      'Open the app and the Live Crowd Tracker is already on the home page. It is the whole point of this app — the queue, not the walk, is what decides how many mandals you actually see tonight.',
    dos: [
      'The three mandals at the top are the shortest queues near you right now.',
      'Green means walk straight in. Yellow means there is a queue but it is moving. Red means thirty minutes or more.',
      'Grey means nobody has reported that one yet — not that it is empty.',
      'Every report expires after ninety minutes, so what you see is tonight, not last week.',
      'Tap “See every mandal on the map” to open the same colours across the whole city.',
    ],
    shots: [
      {
        src: '/guide/home.webp',
        alt: 'The Pune Ganpati Darshan home screen with the Live Crowd Tracker below the search bar',
        caption: 'The home screen. The tracker sits right under the search box — no tapping needed.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/tracker.webp',
        alt: 'The Live Crowd Tracker showing three mandals with short queues and a colour key',
        caption:
          'The tracker in full. The colour key at the bottom is the same key the map uses.',
        w: 358,
        h: 495,
      },
    ],
    note: {
      heading: 'Where the colours come from',
      body:
        'Devotees standing at the mandal, nobody else. No mandal, committee or sponsor can set its own colour, and a queue is only shown once two different people have reported it — one report on its own reads “Not confirmed yet”.',
    },
  },
  {
    n: 2,
    id: 'report',
    title: 'Tell everyone what the queue looks like',
    short: 'Report a queue',
    marathi: 'गर्दी कळवा',
    lede:
      'This is the part that keeps the app alive. If you are standing in the lane, three seconds of your evening tells everyone else in Pune whether to come.',
    dos: [
      'Allow location once. It never leaves your phone — the app only sends which mandal, never where you are.',
      'Walk up to a mandal and a “You’re here” card appears on the home screen with the three buttons.',
      'Or open any mandal’s page and use “How’s the crowd?” — you can report from up to 1.5 km away.',
      'Tap Short, Moving, or 30+ min. That is the whole thing. No account, no sign-in.',
      'You can report the same mandal again after an hour, so a report near the end of a queue is welcome too.',
    ],
    shots: [
      {
        src: '/guide/vote-nearby.webp',
        alt: 'A “You’re here” card naming the mandal with Short, Moving and 30+ min buttons',
        caption:
          'Standing at Dagdusheth. The app names the mandal for you — you just tap the colour.',
        w: 358,
        h: 191,
      },
      {
        src: '/guide/vote-mandal.webp',
        alt: 'The Crowd right now panel on a mandal page, showing Short and the three report buttons',
        caption:
          'On any mandal page. It shows the crowd now, and lets you correct it underneath.',
        w: 358,
        h: 312,
      },
      {
        src: '/guide/vote-too-far.webp',
        alt: 'The crowd panel telling the reader they are 10 km away and cannot report',
        caption:
          'Too far, and the buttons are gone. A queue is only worth reporting if you can see it.',
        w: 358,
        h: 263,
      },
    ],
    note: {
      heading: 'Nothing about you is stored',
      body:
        'Your coordinates are never sent to the server — the app works out on your own phone whether you are close enough, and sends only the mandal and the colour. No name, no account, no phone number, nothing sold to anyone.',
    },
  },
  {
    n: 3,
    id: 'map',
    title: 'Open the map and see all of it at once',
    short: 'The map',
    marathi: 'नकाशा',
    lede:
      'Map is the second button on the bottom bar. Every mandal in the app is on it, drawn in the colour of its queue this minute, along with the metro stations.',
    dos: [
      'The pin colour is the live queue: green, yellow, red, or grey for not yet reported.',
      'Metro stations are marked too. Mandai is drawn hollow because it is exit-only during the festival — you cannot get off there.',
      'Tap any pin and its card slides up with the crowd, the distance from you, and the same three report buttons.',
      'Tap “View Ganpati” on that card for the full page.',
      'The chips at the top — Nearby, मानाचे गणपती, Famous, Historic — narrow it down.',
    ],
    shots: [
      {
        src: '/guide/map.webp',
        alt: 'The map of Pune with green, yellow, red and grey mandal pins and metro stations',
        caption:
          'Green, yellow, red and grey, plus PMC, Kasba Peth and Mandai metro. All 29 mandals are listed underneath.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/map-selected.webp',
        alt: 'A selected mandal card over the map with Short, Moving and 30+ min report buttons',
        caption:
          'One pin tapped. You can report the crowd from here without leaving the map.',
        w: 390,
        h: 844,
      },
    ],
    cta: { href: '/map', label: 'Open the map' },
  },
  {
    n: 4,
    id: 'route',
    title: 'Build your own route',
    short: 'Build a route',
    marathi: 'स्वतःचा मार्ग',
    lede:
      'Short on time and want to cover as much as you can? Tap “Build my route”. It plans from where you are standing and counts the queue as well as the walk, because at the big mandals the queue is most of the evening.',
    dos: [
      'Say how long you have — one hour to six.',
      'Pick what you want: मानाचे गणपती, the famous ones, dekhava and light shows, historic mandals, calm temples, or surprise me.',
      'Choose how you are getting around — Walking, Two-wheeler or Metro.',
      'Tap Build my route and it opens your plan straight away.',
    ],
    shots: [
      {
        src: '/guide/build-time.webp',
        alt: 'The first question of the route builder: how long do you have, with six time options',
        caption: 'Step one. Queuing counts towards this, not just the walking.',
        w: 390,
        h: 520,
      },
      {
        src: '/guide/build-what.webp',
        alt: 'The second question: what do you want to see, with travel mode buttons underneath',
        caption:
          'Step two. Pick as many as you like, then Walking, Two-wheeler or Metro.',
        w: 390,
        h: 545,
      },
    ],
    cta: { href: '/start', label: 'Build a route' },
  },
  {
    n: 5,
    id: 'optimise',
    title: 'Optimise the order, then walk it',
    short: 'Optimise & go',
    marathi: 'क्रम सुधारा',
    lede:
      'Your plan opens with the stops in a sensible order and a straight-line estimate. One tap turns that into the real thing.',
    dos: [
      'Tap Optimise order. It reorders the stops so you walk the least and still see all of them, and redraws the line along the actual lanes.',
      'Watch the distance change — the dotted straight line becomes a solid path that follows real streets.',
      'Drag any stop by its handle to move it, or tap ✕ to drop it.',
      'On Metro it tells you where to board, which line, how many stops and where to get off.',
      'Tap “Start my darshan” to hand the whole route to Google Maps for turn-by-turn from your front door.',
    ],
    shots: [
      {
        src: '/guide/plan-before.webp',
        alt: 'A darshan plan with four stops joined by dotted straight lines and an estimated distance',
        caption: 'Before. Dotted lines, 3.5 km “estimated”, stops in the order they were picked.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/plan-after.webp',
        alt: 'The same plan after optimising, with a solid routed path and reordered stops',
        caption:
          'After Optimise order. Solid path along the lanes, stops reordered, real routed distance.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/metro.webp',
        alt: 'The metro card: board at Mandai, one stop, get off at Kasba Peth, then a 770 m walk',
        caption:
          'On Metro. Which station, which line, how many stops, and the walk at the other end.',
        w: 358,
        h: 267,
      },
      {
        src: '/guide/navigate.webp',
        alt: 'The Optimise order button above Start my darshan, which opens the route in Google Maps',
        caption:
          '“Start my darshan” opens the whole route in Google Maps, starting from where you are.',
        w: 390,
        h: 400,
      },
    ],
    note: {
      heading: 'It starts from you',
      body:
        'If you are already closer to stop 2 than to stop 1, the app says so and offers to begin there instead. Long routes open in Google Maps in parts, because Google takes only nine stops between start and finish — each part picks up where the last one ended, so no mandal is skipped.',
    },
  },
  {
    n: 6,
    id: 'mandals',
    title: 'Look up any mandal',
    short: 'All mandals',
    marathi: 'सर्व मंडळे',
    lede:
      'Explore is the full list — every mandal in the app with its live queue on the card, searchable by name, mandal or area.',
    dos: [
      'Search by English or Marathi name, by mandal, or by peth.',
      'Each card carries the queue colour, the Manache rank where it has one, and the peth.',
      'Open one for its story, its exact spot, and the crowd right now.',
      'Get directions sends you straight there. Add to darshan drops it into your route.',
      'The heart saves it to Saved, on this phone, no account needed.',
    ],
    shots: [
      {
        src: '/guide/explore.webp',
        alt: 'The Explore grid of mandal cards, each with a queue badge',
        caption: 'All 29 mandals, each card showing its live queue.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/mandal.webp',
        alt: 'A mandal page for Shrimant Dagdusheth Halwai Ganpati with directions and crowd panel',
        caption:
          'A mandal page: what it is, directions, add to your darshan, and the crowd right now.',
        w: 390,
        h: 844,
      },
    ],
    cta: { href: '/explore', label: 'See all mandals' },
  },
  {
    n: 7,
    id: 'routes',
    title: 'Or take a ready-made route',
    short: 'Curated routes',
    marathi: 'तयार मार्ग',
    lede:
      'No time to plan anything? Routes has walks already put together — the Manache Paach in ceremonial order, the Sadashiv Peth stretch after dark, the late-night one for short queues.',
    dos: [
      '“Good for right now” picks the ones that suit the actual time of day in Pune.',
      'Every route shows stops, distance and a time that already includes queuing.',
      'Open one to see the stops in order on a map.',
      'Start it from where you are, or add it to your own darshan and change it.',
    ],
    shots: [
      {
        src: '/guide/routes.webp',
        alt: 'The curated routes page with Good for right now and All routes sections',
        caption:
          'Curated routes. The time shown includes queuing, which is what decides whether it fits.',
        w: 390,
        h: 844,
      },
      {
        src: '/guide/route-detail.webp',
        alt: 'A single curated route with its stops drawn on a map',
        caption: 'Inside a route: the stops in order, on the map, ready to start.',
        w: 390,
        h: 844,
      },
    ],
    cta: { href: '/routes', label: 'Browse routes' },
  },
  {
    n: 8,
    id: 'about',
    title: 'Something wrong, or an idea? Tell the developer',
    short: 'Contact',
    marathi: 'संपर्क',
    lede:
      'One person built this and there is no support desk — which means the email and the phone number at the bottom of every page reach him directly, and something you point out today can be fixed tonight.',
    dos: [
      'A mandal missing, a pin in the wrong lane, a name spelt wrong, timings that are not right — say so and it gets corrected.',
      'Ideas are just as welcome as problems. Much of what is here came from someone asking for it.',
      'Write to singhgurnoor080@gmail.com or call +91 62830 31102. Both are on the About page.',
      'If it is a mistake in the app, mention which mandal or which screen — that is usually enough to find it.',
      'Your data, in the footer, lists everything kept on your phone and clears any of it with one tap.',
    ],
    shots: [
      {
        src: '/guide/footer.webp',
        alt: 'The site footer with Explore, Plan and About columns',
        caption: 'The footer, on every page. Everything in the app is reachable from here.',
        w: 390,
        h: 517,
      },
      {
        src: '/guide/about.webp',
        alt: 'The About page with the author, contact details and section links',
        caption: 'About: who built it, why, and how to reach them.',
        w: 390,
        h: 844,
      },
    ],
    note: {
      heading: 'Free, and not a business',
      body:
        'No ads, no fees, no account, nothing sold to anyone. An independent project run at one person’s own cost, not affiliated with any mandal, trust or festival committee — so there is nobody to complain to but him, and he reads all of it.',
    },
    cta: { href: '/about#contact', label: 'Contact details' },
  },
];

/** The three colours, stated once and reused by every screen in the app. */
const KEY = [
  { color: 'var(--crowd-short)', label: 'Short', meaning: 'Walk straight in' },
  { color: 'var(--crowd-moving)', label: 'Moving', meaning: 'A queue, but it moves' },
  { color: 'var(--crowd-long)', label: '30+ min', meaning: 'Heavy, settle in' },
  { color: 'var(--faint)', label: 'Grey', meaning: 'Not reported yet' },
];

function Figure({ shot }: { shot: Shot }) {
  return (
    <figure className="m-0 shrink-0 snap-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
          static asset already served as WebP; next/image would add a
          request and a layout wrapper for no gain. */}
      <img
        src={shot.src}
        alt={shot.alt}
        width={shot.w}
        height={shot.h}
        loading="lazy"
        decoding="async"
        className="block w-[248px] rounded-[14px] border border-[var(--line-strong)] bg-[var(--raat)] sm:w-[280px]"
        style={{ aspectRatio: `${shot.w} / ${shot.h}` }}
      />
      <figcaption className="mt-2 w-[248px] text-[12px] leading-[1.55] text-[var(--faint)] sm:w-[280px]">
        {shot.caption}
      </figcaption>
    </figure>
  );
}

export default function HowToUsePage() {
  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--muted)]"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Pune Ganpati
        </Link>

        <h1 className="font-display mt-2 text-[32px] font-bold leading-tight text-[var(--chandan)]">
          How to use this app
        </h1>
        <p className="mt-1 text-[14px] text-[var(--muted)]">कसे वापरावे</p>

        <p className="prose-measure mt-4 text-[17px] leading-[1.65] text-[var(--chandan)]">
          Eight steps, each with a picture of the real screen. You do not need
          an account, you do not need to pay, and nothing here needs setting up
          — the only thing worth allowing is location, once.
        </p>

        {/* The colour key, up front. Everything after this leans on it. */}
        <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
            The only thing to memorise
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
            {KEY.map((k) => (
              <li key={k.label} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: k.color }}
                />
                <span className="min-w-0 text-[13px] leading-[1.45]">
                  <span className="font-semibold text-[var(--chandan)]">{k.label}</span>
                  <span className="block text-[var(--faint)]">{k.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Jump links. A guide people come back to for one step. */}
        {/* Chips rather than a block of underlined links: eight of those in
            a row reads as a warning, not a table of contents. */}
        <nav aria-label="Steps" className="mt-5 flex flex-wrap gap-1.5">
          {STEPS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 py-1.5 text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--chandan)]"
            >
              <span className="font-mono text-[11px] tabular-nums text-[var(--shendur)]">
                {s.n}
              </span>
              {s.short}
            </a>
          ))}
        </nav>

        <div className="mt-9 flex flex-col gap-11">
          {STEPS.map((step) => (
            <section key={step.id} id={step.id} className="scroll-mt-6">
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[13px] font-bold tabular-nums text-[var(--shendur)]"
                >
                  {String(step.n).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[23px] font-bold leading-tight text-[var(--chandan)]">
                    {step.title}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-[var(--faint)]">{step.marathi}</p>
                </div>
              </div>

              <p className="prose-measure mt-3 text-[16px] leading-[1.68] text-[var(--muted)]">
                {step.lede}
              </p>

              <ol className="mt-4 flex flex-col gap-2.5">
                {step.dos.map((d, i) => (
                  <li key={d} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-[3px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] font-mono text-[11px] tabular-nums text-[var(--zendu)]"
                    >
                      {i + 1}
                    </span>
                    <span className="prose-measure text-[15px] leading-[1.6] text-[var(--chandan)]">
                      {d}
                    </span>
                  </li>
                ))}
              </ol>

              {/* Screenshots side by side, scrolling in their own track so a
                  narrow phone never scrolls the page sideways. */}
              <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
                {step.shots.map((shot) => (
                  <Figure key={shot.src} shot={shot} />
                ))}
              </div>

              {step.note && (
                <div className="prose-measure mt-4 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[var(--chandan)]">
                    {step.note.heading}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                    {step.note.body}
                  </p>
                </div>
              )}

              {step.cta && (
                <Link
                  href={step.cta.href}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-[var(--shendur)]"
                >
                  {step.cta.label}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <h2 className="font-display text-[18px] font-bold text-[var(--chandan)]">
            Stuck, or spotted something wrong?
          </h2>
          <p className="prose-measure mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
            Suggestions and corrections go to the same place — one person, who
            answers. Tell him what you saw and where.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <a
              href="mailto:singhgurnoor080@gmail.com"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] font-semibold text-[var(--chandan)]"
            >
              <Mail size={15} aria-hidden="true" className="text-[var(--shendur)]" />
              Email
            </a>
            <a
              href="tel:+916283031102"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] font-semibold text-[var(--chandan)]"
            >
              <Phone size={15} aria-hidden="true" className="text-[var(--shendur)]" />
              Call
            </a>
            <Link
              href="/about#contact"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-4 text-[14px] text-[var(--muted)]"
            >
              More ways
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
