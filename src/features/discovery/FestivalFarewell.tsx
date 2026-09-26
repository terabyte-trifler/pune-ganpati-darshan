import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { FestivalConfig } from '@/types/ganpati';

/**
 * The homepage once Ganeshotsav is over.
 *
 * Takes the whole first screen, because after visarjan the live parts of
 * the page — the crowd tracker, the routes for the hour — have nothing
 * left to say, and the one thing worth saying is the farewell every
 * procession ends on: पुढच्या वर्षी लवकर या, come back soon next year.
 *
 * The catalogue stays below it. Mandal pages are useful year-round and
 * are what search engines index, so this sits on top of the page rather
 * than replacing it.
 */
export function FestivalFarewell({ config }: { config: FestivalConfig }) {
  return (
    <section className="grain relative flex min-h-[calc(100svh-var(--nav-height)-var(--safe-bottom))] flex-col overflow-hidden px-4 pt-[var(--safe-top)] md:min-h-[100svh]">
      <div
        aria-hidden="true"
        className="rangoli pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          maskImage: 'radial-gradient(75% 60% at 50% 45%, #000 0%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(75% 60% at 50% 45%, #000 0%, transparent 78%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(55% 45% at 50% 42%, rgb(226 98 27 / 0.30) 0%, rgb(242 169 59 / 0.10) 50%, transparent 76%)',
        }}
      />
      <div aria-hidden="true" className="torana relative mt-4 opacity-80" />

      <div className="relative mx-auto flex max-w-xl flex-1 flex-col items-center justify-center py-10 text-center">
        <p
          lang="mr"
          className="font-display text-[20px] font-bold text-[var(--zendu)] sm:text-[24px]"
        >
          {config.greetingMr}
        </p>

        <h1 className="font-display mt-4 text-balance text-[40px] font-bold leading-[1.05] text-[var(--chandan)] sm:text-[60px]">
          Ganeshotsav,
          <span className="block bg-gradient-to-r from-[var(--zendu)] via-[var(--shendur)] to-[var(--pital)] bg-clip-text pb-1 text-transparent">
            meet you again&nbsp;next&nbsp;year
          </span>
        </h1>

        <p
          lang="mr"
          className="font-display mt-5 text-[22px] font-bold text-[var(--pital)] sm:text-[28px]"
        >
          पुढच्या वर्षी लवकर या
        </p>

        <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-[var(--muted)]">
          Thank you for walking the peths with us during Ganeshotsav{' '}
          {config.year}. The mandals stay here all year — come back when
          Bappa does.
        </p>

        <Link
          href="#after-festival"
          className="mt-9 inline-flex flex-col items-center gap-1 text-[12.5px] text-[var(--faint)] transition-colors hover:text-[var(--chandan)]"
        >
          Browse the mandals
          <ChevronDown size={18} aria-hidden="true" className="animate-bounce" />
        </Link>
      </div>

      <div aria-hidden="true" className="torana relative mb-4 rotate-180 opacity-80" />
    </section>
  );
}
