import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd, itemList } from '@/lib/seo/jsonld';
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

  /** The mandals in this category, in the order the page lists them. */
  const inCategory = all.filter((g) => g.category === slug);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="px-4 pt-[calc(var(--safe-top)+20px)]">
        <JsonLd
          data={itemList(
            category.name,
            inCategory.map((g) => ({ name: g.name, url: `/ganpati/${g.slug}` }))
          )}
        />
        <Breadcrumbs
          trail={[
            { name: 'Ganpati mandals', url: '/explore' },
            { name: category.name },
          ]}
        />
        <h1 className="font-display text-[30px] font-bold text-[var(--chandan)]">
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
