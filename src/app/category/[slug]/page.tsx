import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';
import type { GanpatiCategory } from '@/types/ganpati';

export const revalidate = 3600;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ slug: c.key }));
}

export async function generateMetadata({
  params,
}: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.key === slug);
  if (!category) return { title: 'Category not found' };

  const title = `${category.name} Ganpati mandals in Pune`;
  const description = category.description ?? title;

  return {
    title,
    description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: { title, description, url: `/category/${slug}` },
  };
}

export default async function CategoryPage({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [categories, areas, all] = await Promise.all([
    getCategories(), getAreas(), getAllGanpatis(),
  ]);
  const category = categories.find((c) => c.key === slug);
  if (!category) notFound();

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="px-4 pt-[calc(var(--safe-top)+20px)]">
        <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--chandan)]">
          {category.name}
        </h1>
        {category.nameMr && (
          <p lang="mr" className="mt-1 text-[15px] text-[var(--pital)]">{category.nameMr}</p>
        )}
        {category.description && (
          <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-[var(--muted)]">
            {category.description}
          </p>
        )}
      </div>
      <ExploreView
        ganpatis={all}
        areas={areas}
        categories={categories}
        initialCategory={category.key as GanpatiCategory}
      />
    </main>
  );
}
