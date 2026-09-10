import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, ArrowLeft, ExternalLink } from 'lucide-react';
import { StoredData } from '@/features/settings/StoredData';
import { AuthorAvatar } from '@/features/settings/AuthorAvatar';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Pune Ganpati Darshan exists, who built it, and how to get in touch. An independent side project by Gurnoor Singh — not affiliated with any mandal, trust or festival committee.',
  alternates: { canonical: '/about' },
};

export const revalidate = 3600;

/**
 * About.
 *
 * Deliberately plain. The rest of the app is a tool used one-handed in a
 * crowd at night; this is the one page somebody reads sitting down, and it
 * has one job — say who made this, why, and how to reach them.
 *
 * The contact details are the owner's own and are published at their
 * request, which is what makes a small independent project trustworthy:
 * there is a person on the other end of it.
 */

const LAST_UPDATED = '10 September 2026';

const SECTIONS = [
  { id: 'why', label: 'Why' },
  { id: 'what', label: 'What it does' },
  { id: 'contact', label: 'Contact' },
  { id: 'data', label: 'Your data' },
  { id: 'terms', label: 'Terms' },
  { id: 'disclaimer', label: 'Disclaimer' },
];

const DOES = [
  'Routes built around the time you actually have, counting the queue as well as the walk',
  'Live queue reports from devotees, on the map, expiring after ninety minutes',
  'Metro-aware — which station to board, where to change, where to get off',
  'Free and non-commercial — no ads, no fees, and nothing tied to your name',
];

const LINKS = [
  { label: 'X', handle: '@singhgurnoor080', href: 'https://x.com/singhgurnoor080' },
  {
    label: 'Instagram',
    handle: '@terabyte_trifler',
    href: 'https://www.instagram.com/terabyte_trifler/',
  },
  { label: 'Fennr Studio', handle: 'fennrstudio.com', href: 'https://fennrstudio.com' },
];

export default function AboutPage() {
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
          About
        </h1>

        <div className="mt-4 flex items-center gap-3">
          <AuthorAvatar name="Gurnoor Singh" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[var(--chandan)]">
              Gurnoor Singh
            </p>
            <p className="text-[13px] text-[var(--muted)]">
              Terabyte Trifler · Pune
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--faint)]">
              Updated {LAST_UPDATED}
            </p>
          </div>
        </div>

        {/* Anchors, so a link can point at the terms or the disclaimer
            rather than at the top of a long page. */}
        <nav className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          {SECTIONS.map((sx) => (
            <a key={sx.id} href={`#${sx.id}`} className="text-[var(--shendur)] underline">
              {sx.label}
            </a>
          ))}
        </nav>

        {/* ---------------- Why ---------------- */}
        {/* ---------------- Why ----------------
            Four lines, and they are the pitch rather than the story.
            This ran to six paragraphs of how a darshan evening goes wrong,
            which is a thing to read rather than a thing to grasp — and the
            reader is usually standing up. */}
        <section id="why" className="mt-7">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Why I built this
          </h2>
          <div className="prose-measure mt-3 space-y-3 text-[17px] leading-[1.65] text-[var(--chandan)]">
            <p>
              Ganeshotsav is a crowd problem before it is a walking problem. At
              the big mandals the queue is most of the evening — Dagdusheth
              alone can take an hour.
            </p>
            <p className="text-[16px] text-[var(--muted)]">
              So the app tracks the crowd live. Anyone standing at a mandal taps
              short, moving or long, and everyone else sees it on the map within
              seconds. Then it plans your route around that, counting the queue
              as well as the walk.
            </p>
            <p className="text-[16px] text-[var(--muted)]">
              It is free and it is not a business. No ads, no fees, no
              account, and nothing about you is sold to anyone.
            </p>
          </div>

          <p className="prose-measure mt-4 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            A non-commercial side project, run at my own cost and free for
            everyone. Not affiliated with any mandal, trust or festival
            committee, and timings and queue reports come from devotees rather
            than from the mandals themselves.
          </p>
        </section>

        {/* ---------------- What it does ---------------- */}
        <section id="what" className="mt-8">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            What it does
          </h2>
          <p className="prose-measure mt-3 text-[16px] leading-[1.72] text-[var(--muted)]">
            Pune&rsquo;s Ganeshotsav fills the old peth lanes with sarvajanik
            mandals — the Manache Paach, the big dekhava sets, the light shows
            that only run after dark. This app is for getting round them on
            foot without guesswork.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {DOES.map((d) => (
              <li
                key={d}
                className="prose-measure flex gap-2.5 text-[15px] leading-[1.7] text-[var(--muted)]"
              >
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--shendur)]"
                />
                {d}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------- Contact ---------------- */}
        <section id="contact" className="mt-8">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Get in touch
          </h2>
          <p className="prose-measure mt-2 text-[15px] leading-[1.7] text-[var(--muted)]">
            A wrong timing, a missing mandal, a mandal in the wrong place on the
            map — tell me and I will fix it. Corrections from people who were
            actually there are the only way this stays accurate.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <a
              href="mailto:singhgurnoor080@gmail.com"
              className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5 text-[14px] text-[var(--chandan)]"
            >
              <Mail size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
              singhgurnoor080@gmail.com
            </a>
            <a
              href="tel:+916283031102"
              className="flex min-h-11 items-center gap-2.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5 text-[14px] text-[var(--chandan)]"
            >
              <Phone size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
              +91 62830 31102
            </a>
          </div>

          <ul className="mt-2 flex flex-col gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5"
                >
                  <span className="text-[14px] text-[var(--chandan)]">
                    {l.label}
                    <span className="ml-2 text-[13px] text-[var(--muted)]">{l.handle}</span>
                  </span>
                  <ExternalLink
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--faint)]"
                  />
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
            I also run{' '}
            <a
              href="https://fennrstudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--shendur)] underline"
            >
              Fennr Studio
            </a>
            , where I build software for other people the rest of the year.
          </p>
        </section>

        {/* ---------------- Stored data ---------------- */}
        <section id="data" className="mt-9">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Your data
          </h2>
          <p className="prose-measure mt-3 text-[16px] leading-[1.72] text-[var(--muted)]">
            There is no account, so there is nothing about you on a server to
            delete. Six small things are kept on your own device, and you can
            remove any of them here.
          </p>

          <StoredData />

          <div className="prose-measure mt-4 space-y-3.5 text-[14px] leading-[1.7] text-[var(--muted)]">
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Location.
              </strong>{' '}
              Used on your phone to work out which mandals are near you and
              whether you are close enough to report a queue. It is never sent
              to the server and never stored — a queue report carries a yes or
              no, not a position.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Queue reports.
              </strong>{' '}
              Stored with an anonymous device id so the same phone cannot
              report the same mandal twice in an hour. No name and no account.
              Your IP address is not kept either — a salted one-way hash of it
              is, purely so one connection cannot flood the tracker, and the
              address itself cannot be recovered from it. Reports stop counting
              after ninety minutes and are deleted after that.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Analytics.
              </strong>{' '}
              Page views are counted with a session id that lasts until you
              close the tab. The city the request came from is recorded — city
              and no finer, resolved before the request reaches the app, with
              no coordinates, no postal code and no IP address kept. Nothing is
              sold, and there are no third-party trackers or ad networks.
            </p>
          </div>
        </section>

        {/* ---------------- Policies ---------------- */}
        <section id="terms" className="mt-9">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Terms of use
          </h2>
          <div className="prose-measure mt-3 space-y-3.5 text-[15px] leading-[1.72] text-[var(--muted)]">
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Use it freely.
              </strong>{' '}
              Free for planning your own darshan, with no account and no ads.
              Nothing here is sold and nothing is behind a payment — it is run
              at my own cost.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Don&rsquo;t scrape or resell it.
              </strong>{' '}
              The catalogue and the queue data are assembled by hand and
              corrected by people who were actually there. Please don&rsquo;t
              republish them as your own.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Report what you saw.
              </strong>{' '}
              False queue reports send people to the wrong place on the busiest
              nights of the year. Reporting is limited per device, so one phone
              cannot swing a mandal&rsquo;s reading.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Credit where it is due.
              </strong>{' '}
              Map data is © OpenStreetMap contributors, under the{' '}
              <Link href="/licences" className="text-[var(--shendur)] underline">
                Open Database Licence
              </Link>
              . Mandal names, photographs and the festival itself belong to the
              mandals.
            </p>
          </div>
        </section>

        <section id="disclaimer" className="mt-8">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
            Disclaimer
          </h2>
          <div className="prose-measure mt-3 space-y-3.5 text-[15px] leading-[1.72] text-[var(--muted)]">
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Everything here is an estimate.
              </strong>{' '}
              Every time is a guess, every queue reading is somebody&rsquo;s
              opinion from up to ninety minutes ago, and both can be wrong.
              Timings are not confirmed by the mandals.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                People on the ground know better than this app.
              </strong>{' '}
              Follow the police and the mandal volunteers over anything you read
              here. Keep to marked routes, and don&rsquo;t navigate by phone
              while walking in a crowd. Visarjan days close roads at short
              notice.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Routes are walked, not driven.
              </strong>{' '}
              Vehicle access to the peths is restricted during the festival,
              which is why there is no driving mode.
            </p>
            <p>
              <strong className="font-semibold text-[var(--chandan)]">
                Offered as-is.
              </strong>{' '}
              A non-commercial side project with no warranty, not affiliated
              with any mandal, trust, festival committee, the Pune Municipal
              Corporation or Maharashtra Metro. It is not a registered
              non-profit or a charity, and it does not collect donations.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
