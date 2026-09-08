import type { Metadata } from 'next';
import { getAllGanpatis } from '@/services/ganpati';
import { SavedView } from '@/features/favorites/SavedView';

export const metadata: Metadata = {
  title: 'Saved mandals',
  description: 'The Pune Ganpati mandals you have saved.',
  robots: { index: false },
  alternates: { canonical: '/saved' },
};

export const revalidate = 3600;

export default async function SavedPage() {
  const ganpatis = await getAllGanpatis();
  return (
    <main id="main" className="pb-nav pt-[calc(var(--safe-top)+20px)] md:pb-10">
      <h1 className="font-display mb-1 px-4 text-[28px] font-bold text-[var(--chandan)]">
        Saved
      </h1>
      <SavedView ganpatis={ganpatis} />
    </main>
  );
}
