import type { Metadata } from 'next';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';

export const metadata: Metadata = {
  title: 'Explore Pune Ganpati mandals',
  description:
    'Search and filter every Pune Ganpati mandal by name, peth, category or distance.',
  alternates: { canonical: '/explore' },
};

export const revalidate = 3600;

/**
 * `?focus=1` means the visitor tapped a search affordance to get here —
 * the home page and the map both have one — so the field takes focus and
 * the keyboard opens. Read here rather than with useSearchParams so the
 * page keeps rendering statically.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const [{ focus }, ganpatis, areas, categories] = await Promise.all([
    searchParams, getAllGanpatis(), getAreas(), getCategories(),
  ]);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <h1 className="sr-only">Explore Pune Ganpati mandals</h1>
      <ExploreView
        ganpatis={ganpatis}
        areas={areas}
        categories={categories}
        autoFocus={focus === '1'}
      />
    </main>
  );
}
