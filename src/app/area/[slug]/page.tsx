import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAreas, getGanpatisByArea, getAllGanpatis, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';

/** Peth landing page — the highest-intent SEO surface for this product. */

export const revalidate = 3600;

export async function generateStaticParams() {
  const areas = await getAreas();
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const area = (await getAreas()).find((a) => a.slug === slug);
  if (!area) return { title: 'Area not found' };

  const count = (await getGanpatisByArea(slug)).length;
  const title = `Ganpati mandals in ${area.name}, Pune`;
  const description = `All ${count} Ganpati mandals in ${area.name} — locations, directions and darshan information for Ganeshotsav.`;

  return {
    title,
    description,
    alternates: { canonical: `/area/${slug}` },
    openGraph: { title, description, url: `/area/${slug}` },
  };
}

export default async function AreaPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [areas, categories, all] = await Promise.all([
    getAreas(), getCategories(), getAllGanpatis(),
  ]);
  const area = areas.find((a) => a.slug === slug);
  if (!area) notFound();

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="px-4 pt-[calc(var(--safe-top)+20px)]">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--chandan)]">
          Ganpati in {area.name}
        </h1>
        {area.nameMr && (
          <p lang="mr" className="mt-1 text-[15px] text-[var(--muted)]">{area.nameMr}</p>
        )}
        {area.isCore && (
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            Part of the old peth core — these mandals are within walking
            distance of each other.
          </p>
        )}
      </div>
      <ExploreView
        ganpatis={all}
        areas={areas}
        categories={categories}
        initialArea={slug}
      />
    </main>
  );
}
