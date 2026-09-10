import type { Metadata } from 'next';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { ExploreView } from '@/features/search/ExploreView';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Explore Pune Ganpati mandals',
  description:
    'Search and filter every Pune Ganpati mandal by name, peth, category or distance.',
  alternates: { canonical: '/explore' },
};

export const revalidate = 3600;

export default async function ExplorePage() {
  const [ganpatis, areas, categories] = await Promise.all([
    getAllGanpatis(), getAreas(), getCategories(),
  ]);

  return (
    <main id="main" className="pb-nav md:pb-10">
      <h1 className="sr-only">Explore Pune Ganpati mandals</h1>
      <ExploreView ganpatis={ganpatis} areas={areas} categories={categories} />
      <SiteFooter className="mx-auto mt-10 max-w-2xl px-4" />
    </main>
  );
}
