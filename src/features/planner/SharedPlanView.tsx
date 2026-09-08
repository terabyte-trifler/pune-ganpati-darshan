'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListPlus } from 'lucide-react';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { StartRouteButton } from './StartRouteButton';
import { GanpatiImage } from '@/components/ui/GanpatiImage';
import { Button } from '@/components/ui/Button';
import { ShareButton } from '@/features/discovery/ShareButton';
import { usePlan } from '@/hooks/useLocalCollection';
import { trackEvent } from '@/services/analytics';
import type { Ganpati } from '@/types/ganpati';

/**
 * A saved plan opened from its share link.
 *
 * Read-only, with an explicit action to adopt it. Same rule as the stateless
 * share form: opening someone else's route must not quietly overwrite the
 * darshan the visitor has already built.
 */
export function SharedPlanView({
  stops, shareId,
}: {
  stops: Ganpati[];
  shareId: string;
}) {
  const router = useRouter();
  const { items: mine, replace, hydrated } = usePlan();

  const adopt = () => {
    replace(stops.map((s) => s.slug));
    trackEvent('plan_created', { props: { source: 'shared-plan', shareId } });
    router.push('/plan');
  };

  return (
    <>
      <MiniMap mandals={stops} ordered className="mt-4 h-60 w-full" />

      {/* Navigate it directly, without having to adopt it first. */}
      <StartRouteButton
        stops={stops}
        mode="walk"
        source={`shared-plan:${shareId}`}
        label="Start this darshan"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="md" onClick={adopt} className="flex-1">
          <ListPlus size={16} aria-hidden="true" />
          Add to my darshan
        </Button>
        <ShareButton
          title="A Ganpati darshan route"
          text={`${stops.length} mandals in Pune`}
          path={`/plan/${shareId}`}
        />
      </div>

      {hydrated && mine.length > 0 && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
          You already have {mine.length} {mine.length === 1 ? 'stop' : 'stops'} saved.
          Using this route replaces them —{' '}
          <Link href="/plan" className="text-[var(--shendur)] underline">
            keep yours instead
          </Link>
          .
        </p>
      )}

      <h2 className="mb-2 mt-6 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
        Route order
      </h2>
      <ol className="space-y-2">
        {stops.map((stop, index) => (
          <li
            key={stop.id}
            className="flex items-center gap-3 surface rounded-[var(--radius-card)] border border-[var(--line)] p-2.5"
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--shendur)]/40 text-[12px] font-bold text-[var(--shendur)]"
            >
              {index + 1}
            </span>
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <GanpatiImage ganpati={stop} sizes="48px" />
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/ganpati/${stop.slug}`}
                className="block truncate text-[14px] font-semibold text-[var(--chandan)]"
              >
                {stop.name}
              </Link>
              <p className="truncate text-[12px] text-[var(--faint)]">{stop.area.name}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
