import type { Metadata } from 'next';
import { getAllGanpatis } from '@/services/ganpati';
import { StartWizard } from '@/features/planner/StartWizard';

export const metadata: Metadata = {
  title: 'Build your darshan route',
  description:
    'Tell us how long you have and what you want to see, and we’ll build a walkable Pune Ganpati darshan route that actually fits — queuing time included.',
  alternates: { canonical: '/start' },
};

export const revalidate = 3600;

export default async function StartPage() {
  const mandals = await getAllGanpatis();
  return (
    <main id="main">
      <StartWizard mandals={mandals} />
    </main>
  );
}
