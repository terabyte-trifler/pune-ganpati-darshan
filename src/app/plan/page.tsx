import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllGanpatis } from '@/services/ganpati';
import { PlannerView } from '@/features/planner/PlannerView';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'Plan your darshan',
  description:
    'Choose the Pune Ganpati mandals you want to visit and get them ordered into the shortest walkable darshan route.',
  alternates: { canonical: '/plan' },
};

export const revalidate = 3600;

/**
 * The planner reads `?stops=` so a shared route opens for the recipient, and
 * `useSearchParams` needs a Suspense boundary or the whole page opts out of
 * static rendering. The fallback mirrors the planner's own layout so nothing
 * shifts when it resolves.
 */
function PlannerSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-4 w-32 rounded" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export default async function PlanPage() {
  const ganpatis = await getAllGanpatis();
  return (
    <main id="main" className="pb-nav md:pb-10">
      <Suspense fallback={<PlannerSkeleton />}>
        <PlannerView ganpatis={ganpatis} />
      </Suspense>
    </main>
  );
}
