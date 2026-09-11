import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, AlertCircle } from 'lucide-react';
import { GUIDES, getGuide } from '@/content/guides';
import { getAllGanpatis } from '@/services/ganpati';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/lib/seo/jsonld';
import { env } from '@/lib/env';

export const revalidate = 3600;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: 'Guide not found' };

  return {
    // Absolute, like the other long page types: the layout's brand suffix
    // would push these past the point a result gets truncated.
    title: { absolute: guide.title },
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      type: 'article',
      publishedTime: guide.updated,
      modifiedTime: guide.updated,
    },
  };
}

/**
 * A guide page.
 *
 * `Article` rather than a richer type on purpose. These are explanatory
 * pieces about a festival, not events, not products and not reviews —
 * and a schema that claims more than the page delivers is the fastest
 * way to have every rich result on the domain discounted at once.
 *
 * The "last updated" date is rendered visibly as well as in the markup,
 * because for festival content staleness is the failure a reader
 * actually gets burned by, and a date only a crawler can see does not
 * help them.
 */
export default async function GuidePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const all = await getAllGanpatis();
  const bySlug = new Map(all.map((g) => [g.slug, g]));
  const base = env.NEXT_PUBLIC_APP_URL;

  const updated = new Date(guide.updated).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    url: `${base}/guides/${guide.slug}`,
    datePublished: guide.updated,
    dateModified: guide.updated,
    inLanguage: 'en-IN',
    author: { '@type': 'Person', name: 'Gurnoor Singh' },
    publisher: { '@id': `${base}/#organization` },
    isAccessibleForFree: true,
  };

  return (
    <main id="main" className="pb-nav md:pb-10">
      <JsonLd data={article} />
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+20px)]">
        <Breadcrumbs
          trail={[{ name: 'Guides', url: '/guides' }, { name: guide.heading }]}
        />

        <h1 className="font-display mt-2 text-[32px] font-bold leading-tight text-[var(--chandan)]">
          {guide.heading}
        </h1>
        {guide.headingMr && (
          <p className="mt-1 text-[15px] text-[var(--muted)]">{guide.headingMr}</p>
        )}
        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
          Last updated <time dateTime={guide.updated}>{updated}</time>
        </p>

        <div className="prose-measure mt-5 space-y-3.5">
          {guide.intro.map((p) => (
            <p key={p} className="text-[17px] leading-[1.68] text-[var(--chandan)]">
              {p}
            </p>
          ))}
        </div>

        {guide.sections.map((s) => (
          <section key={s.heading} className="mt-9">
            <h2 className="font-display text-[22px] font-bold text-[var(--chandan)]">
              {s.heading}
            </h2>
            <div className="prose-measure mt-3 space-y-3">
              {s.body.map((p) => (
                <p key={p} className="text-[16px] leading-[1.7] text-[var(--muted)]">
                  {p}
                </p>
              ))}
            </div>

            {s.mandals && s.mandals.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5">
                {s.mandals.map((ms) => {
                  const g = bySlug.get(ms);
                  if (!g) return null;
                  return (
                    <li key={ms}>
                      <Link
                        href={`/ganpati/${g.slug}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3.5 text-[15px] text-[var(--chandan)] transition-colors hover:border-[var(--shendur)]/40"
                      >
                        <span className="min-w-0 truncate">
                          {g.name}
                          <span className="ml-2 text-[12px] text-[var(--faint)]">
                            {g.area.name}
                          </span>
                        </span>
                        <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-[var(--shendur)]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}

        {guide.unverified && guide.unverified.length > 0 && (
          <div className="mt-9 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
            <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
              <AlertCircle size={13} aria-hidden="true" />
              Still being checked
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2">
              {guide.unverified.map((u) => (
                <li key={u} className="prose-measure text-[13px] leading-relaxed text-[var(--muted)]">
                  {u}
                </li>
              ))}
            </ul>
          </div>
        )}

        {guide.related && guide.related.length > 0 && (
          <section className="mt-9">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
              Related
            </h2>
            <ul className="mt-2.5 flex flex-col">
              {guide.related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-flex min-h-11 items-center gap-1.5 text-[14px] text-[var(--shendur)]"
                  >
                    {r.label}
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
