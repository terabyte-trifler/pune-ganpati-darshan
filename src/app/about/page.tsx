import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone, ArrowLeft, ExternalLink } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

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

        <h1 className="font-display mt-2 text-[30px] font-bold leading-tight text-[var(--chandan)]">
          About
        </h1>
        <p className="mt-1.5 text-[14px] text-[var(--muted)]">
          Built by{' '}
          <span className="font-semibold text-[var(--chandan)]">Gurnoor Singh</span>
          {' '}— Terabyte Trifler
        </p>

        {/* ---------------- Why ---------------- */}
        <section className="mt-7">
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
            Why I built this
          </h2>
          <div className="mt-2.5 space-y-3.5 text-[15px] leading-relaxed text-[var(--muted)]">
            <p>
              Every Ganeshotsav the same evening plays out. You set off with a
              list of mandals, and somewhere around the second one you realise
              the list was never a plan. Nobody tells you that Dagdusheth alone
              can take the better part of an hour, so the five mandals you were
              going to see become two, and you spend the rest of the night
              walking between them.
            </p>
            <p>
              Almost every guide to the festival is a list. A list cannot tell
              you what fits. This app counts the <em>queue</em> as well as the
              walk, because at the big mandals the queue is most of the evening
              — so when it says three hours, it means three hours.
            </p>
            <p>
              The other half is that queues change by the hour and no list can
              keep up. So the app asks the people who are already standing
              there. Anyone within a short distance of a mandal can report
              whether the queue is short, moving or long, it takes one tap, and
              everyone else sees it on the map straight away. Reports expire
              after ninety minutes, because a queue from two hours ago is not
              news. When nobody has reported, the app says so rather than
              guessing — an unknown queue is never dressed up as a calm one.
            </p>
            <p>
              It is free, it has no ads, and it needs no account. Nothing you
              do here is tied to your name, and your location is used on your
              phone to work out what is near you — it is never stored.
            </p>
          </div>

          <p className="mt-4 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
            An independent side project. Not affiliated with any mandal, trust
            or festival committee, and timings and queue reports come from
            devotees rather than from the mandals themselves.
          </p>
        </section>

        {/* ---------------- Contact ---------------- */}
        <section className="mt-8">
          <h2 className="text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
            Get in touch
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
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

        <SiteFooter className="mt-10" />
      </div>
    </main>
  );
}
