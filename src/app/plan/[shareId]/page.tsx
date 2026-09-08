import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { getPlanByShareId } from '@/services/plans';
import { getAllGanpatis } from '@/services/ganpati';
import { SharedPlanView } from '@/features/planner/SharedPlanView';
import type { Ganpati } from '@/types/ganpati';

/**
 * A saved, shareable darshan.
 *
 * Rendered on the server from the share id, so the link survives the sender
 * clearing their browser and works for a recipient who has never opened the
 * app — unlike the stateless `?stops=` form, which carries the whole route in
 * the URL.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params;
  const plan = await getPlanByShareId(shareId);
  if (!plan) return { title: 'Plan not found', robots: { index: false } };

  const title = `${plan.title} — ${plan.stops.length} Pune Ganpati mandals`;
  return {
    title,
    description: `A shared darshan route: ${plan.stops.map((s) => s.name).slice(0, 4).join(', ')}${plan.stops.length > 4 ? ' and more' : ''}.`,
    // Shared plans are personal links, not indexable pages.
    robots: { index: false, follow: false },
    openGraph: { title, type: 'article' },
  };
}

export default async function SharedPlanPage({
  params,
}: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const [plan, ganpatis] = await Promise.all([
    getPlanByShareId(shareId),
    getAllGanpatis(),
  ]);
  if (!plan) notFound();

  const bySlug = new Map(ganpatis.map((g) => [g.slug, g]));
  const stops = plan.stops
    .map((s) => bySlug.get(s.slug))
    .filter((g): g is Ganpati => Boolean(g));

  return (
    <main id="main" className="pb-nav md:pb-10">
      <div className="mx-auto max-w-2xl px-4 pt-[calc(var(--safe-top)+16px)]">
        <Link href="/plan" className="inline-flex items-center gap-1 text-[13px] text-[var(--shendur)]">
          <ArrowLeft size={14} aria-hidden="true" />
          Your darshan
        </Link>

        <h1 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight text-[var(--chandan)]">
          {plan.title}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
          <MapPin size={13} aria-hidden="true" />
          {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
          {plan.origin?.label && <> · from {plan.origin.label}</>}
        </p>

        <SharedPlanView stops={stops} shareId={plan.shareId} />
      </div>
    </main>
  );
}
