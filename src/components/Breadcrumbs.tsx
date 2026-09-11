import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { JsonLd, breadcrumbList, type Crumb } from '@/lib/seo/jsonld';

/**
 * A visible trail, plus the structured data that matches it.
 *
 * Both halves are emitted here together on purpose. BreadcrumbList that
 * describes a trail the visitor cannot see is markup contradicting the
 * page, and the two drifting apart is what happens when they live in
 * different files.
 *
 * It earns its place for a human too: most arrivals on a mandal page come
 * cold from search, landing three levels deep with no idea the rest of
 * the site exists. The trail is the cheapest way to say "this is one of
 * twenty-nine, in a peth, on a map".
 *
 * `Home` is always first and the current page is always last and
 * unlinked — a self-link on the final crumb is the most common way this
 * markup gets flagged.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const crumbs: Crumb[] = [{ name: 'Home', url: '/' }, ...trail];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />
      <nav aria-label="Breadcrumb" className="mb-1">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[12px] text-[var(--faint)]">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.name}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight size={11} aria-hidden="true" className="opacity-60" />
                )}
                {last || !c.url ? (
                  <span aria-current={last ? 'page' : undefined} className="truncate">
                    {c.name}
                  </span>
                ) : (
                  <Link
                    href={c.url}
                    className="truncate transition-colors hover:text-[var(--chandan)]"
                  >
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
