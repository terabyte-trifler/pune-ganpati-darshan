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

/**
 * The builder, on its own.
 *
 * Just the two questions — nothing else on the page. The planner carries
 * the same builder inline, which is right when you already have a route on
 * screen and are changing it; here there is nothing to change yet, so the
 * plan header and the stop list would be answering a question nobody
 * asked.
 *
 * Building writes the plan and moves to /plan, which is where a route is
 * looked at and reordered. That is a handoff between two different jobs,
 * not the confirmation step that used to sit inside this one.
 */
export default async function StartPage() {
  const mandals = await getAllGanpatis();
  return (
    <main id="main">
      <StartWizard mandals={mandals} />
    </main>
  );
}
