import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { GUIDES } from '@/content/guides';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd, itemList } from '@/lib/seo/jsonld';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: 'Pune Ganpati guides — mandals, darshan and the festival' },
  description:
    'Guides to Pune’s Ganeshotsav: the Manache Paach, how darshan works, ' +
    'and what to expect in the peths during the festival.',
  alternates: { canonical: '/guides' },
};

/**
 * The guides index.
 *
 * It exists from the first guide rather than being added once there are
 * several, because a page with no parent is a page nothing links to, and
 * the breadcrumb trail on a guide has to lead somewhere real.
 */
export default function GuidesPage() {
  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <JsonLd
          data={itemList(
            'Pune Ganpati guides',
            GUIDES.map((g) => ({ name: g.title, url: `/guides/${g.slug}` }))
          )}
        />
        <Breadcrumbs trail={[{ name: 'Guides' }]} />

        <h1 className="font-display mt-2 text-[32px] font-bold leading-tight text-[var(--chandan)]">
          Guides
        </h1>
        <p className="prose-measure mt-2 text-[16px] leading-[1.7] text-[var(--muted)]">
          The parts of Pune’s Ganeshotsav that a map cannot tell you — what the
          Manache Paach are, how darshan actually works, and what to expect in
          the peths.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/guides/${g.slug}`}
                className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4 transition-colors hover:border-[var(--shendur)]/40"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-[19px] font-bold leading-tight text-[var(--chandan)]">
                    {g.heading}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-[var(--shendur)]" />
                </span>
                <span className="text-[14px] leading-relaxed text-[var(--muted)]">
                  {g.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
