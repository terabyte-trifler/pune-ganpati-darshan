'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GanpatiGlyph } from '@/components/ui/GanpatiGlyph';

/**
 * The site footer.
 *
 * Rendered once from the root layout rather than pasted onto each page, so
 * a page added later gets it without anyone remembering to. It hides
 * itself on the surfaces where a colophon is wrong.
 *
 * Those exclusions are the whole reason this is a client component. The
 * map is a full-bleed canvas with a sheet over it and has no bottom to put
 * anything at; the admin console is a private tool and not part of the
 * public site; /offline is what the service worker serves when there is no
 * network, and a footer full of links that cannot load is a bad joke at
 * that moment.
 */

const HIDDEN_ON = ['/map', '/admin', '/offline'];

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Explore',
    links: [
      { href: '/explore', label: 'All mandals' },
      { href: '/map', label: 'Live crowd map' },
      { href: '/saved', label: 'Saved' },
    ],
  },
  {
    heading: 'Plan',
    links: [
      { href: '/start', label: 'Build a route' },
      { href: '/routes', label: 'Curated routes' },
      { href: '/plan', label: 'Your darshan' },
    ],
  },
  {
    heading: 'About',
    links: [
      { href: '/about', label: 'About this app' },
      { href: '/about#data', label: 'Your data' },
      { href: '/licences', label: 'Data & licences' },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <footer className="mt-14 border-t border-[var(--line)] bg-[var(--dhoop)]/40">
      {/* The bottom nav is md:hidden, so its clearance is too. Written out
          rather than reusing .pb-nav, whose specificity ties with Tailwind's
          responsive utilities and wins or loses on stylesheet order. */}
      <div className="mx-auto max-w-5xl px-4 pb-[calc(var(--nav-height)+var(--safe-bottom)+24px)] pt-9 md:pb-12">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          {/* ---- Wordmark ---- */}
          <div className="md:col-span-5 md:max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <GanpatiGlyph
                className="h-7 w-7 text-[var(--pital)]"
                knockout="var(--raat)"
              />
              <span className="font-display text-[16px] font-bold text-[var(--chandan)]">
                Pune Ganpati Darshan
              </span>
            </Link>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--muted)]">
              Live queue reports from devotees, and walkable routes that count
              the queue as well as the walk. Free for everyone, always.
            </p>
          </div>

          {/* ---- Links ---- */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-3 gap-x-4 gap-y-6 sm:gap-x-6 md:col-span-7"
          >
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
                  {col.heading}
                </h2>
                <ul className="mt-2 flex flex-col">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link
                        href={l.href}
                        className="inline-flex min-h-[34px] items-center text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--chandan)]"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* ---- Colophon ---- */}
        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--line)] pt-5 text-[12px] leading-relaxed text-[var(--faint)] sm:flex-row sm:items-baseline sm:justify-between">
          <p>
            Built by{' '}
            <Link href="/about" className="text-[var(--muted)] hover:text-[var(--chandan)]">
              Gurnoor Singh
            </Link>{' '}
            at{' '}
            <a
              href="https://fennrstudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--chandan)]"
            >
              Fennr Studio
            </a>
          </p>
          <p className="max-w-md text-pretty sm:text-right">
            Free and non-commercial — no ads, no fees, nothing sold. An
            independent project, not affiliated with any mandal, trust or
            festival committee.
          </p>
        </div>
      </div>
    </footer>
  );
}
