import type { Metadata } from 'next';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';
import { JsonLd, itemList } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Explore Pune Ganpati mandals',
  description:
    'Search and filter every Pune Ganpati mandal by name, peth, category or distance.',
  alternates: { canonical: '/explore' },
};

export const revalidate = 3600;

/**
 * Static, and it has to stay that way.
 *
 * This page awaited `searchParams` to read `?focus=1`, under a comment
 * claiming that kept it static. It does the opposite: touching
 * searchParams in a server component opts the route out of static
 * rendering entirely. The `revalidate = 3600` above was dead, every visit
 * to a nav tab returned `private, no-store` on a cache MISS, and each one
 * paid a function invocation plus getAllGanpatis + getAreas +
 * getCategories — to decide whether a text field should take focus.
 *
 * ExploreView reads the parameter on the client now, where the focus call
 * already lived. Nothing renders differently; the page is simply cacheable
 * again. Do not reintroduce searchParams here.
 */
export default async function ExplorePage() {
  const [ganpatis, areas, categories] = await Promise.all([
    getAllGanpatis(), getAreas(), getCategories(),
  ]);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <JsonLd
        data={itemList(
          'Ganpati mandals in Pune',
          ganpatis.map((g) => ({ name: g.name, url: `/ganpati/${g.slug}` }))
        )}
      />
      <h1 className="sr-only">Explore Pune Ganpati mandals</h1>
      <ExploreView
        ganpatis={ganpatis}
        areas={areas}
        categories={categories}
      />
    </main>
  );
}
