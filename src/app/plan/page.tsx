import type { Metadata } from 'next';
import { getAllGanpatis } from '@/services/ganpati';
import { PlannerView } from '@/features/planner/PlannerView';

export const metadata: Metadata = {
  title: 'Plan your darshan',
  description:
    'Choose the Pune Ganpati mandals you want to visit and get them ordered into the shortest walkable darshan route.',
  alternates: { canonical: '/plan' },
};

export const revalidate = 3600;

export default async function PlanPage() {
  const ganpatis = await getAllGanpatis();
  return (
    <main id="main" className="pb-nav md:pb-10">
      <PlannerView ganpatis={ganpatis} />
    </main>
  );
}
