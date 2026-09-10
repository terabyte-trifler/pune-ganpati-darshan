import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The one place the app admits a person made it.
 *
 * There was nowhere at all to reach the maker, and no route to the licences
 * page except from a single mandal page — so the OpenStreetMap credit the
 * data licence asks for was effectively unreachable, and so was any way to
 * report that a mandal is in the wrong place.
 *
 * Not rendered on the map or inside the planner. Those are working
 * surfaces where the page ends at a control, not at a colophon.
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'border-t border-[var(--line)] px-1 pb-6 pt-5 text-[12px] leading-relaxed text-[var(--faint)]',
        className
      )}
    >
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Link href="/about" className="min-h-11 py-3 text-[var(--muted)] underline">
          About
        </Link>
        <Link href="/licences" className="min-h-11 py-3 text-[var(--muted)] underline">
          Data &amp; licences
        </Link>
      </nav>
      <p className="mt-1">
        Built by{' '}
        <Link href="/about" className="text-[var(--muted)] underline">
          Gurnoor Singh
        </Link>{' '}
        ·{' '}
        <a
          href="https://fennrstudio.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--muted)] underline"
        >
          Fennr Studio
        </a>
      </p>
      <p className="mt-1">
        An independent project — not affiliated with any mandal, trust or
        festival committee.
      </p>
    </footer>
  );
}
