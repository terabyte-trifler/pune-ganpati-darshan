'use client';

import { Check, Plus } from 'lucide-react';
import { usePlan } from '@/hooks/useLocalCollection';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/** Adds/removes a mandal from the darshan plan held in localStorage. */
export function AddToPlanButton({
  slug, name, className, full = false,
}: {
  slug: string;
  name: string;
  className?: string;
  full?: boolean;
}) {
  const { has, toggle, hydrated, items } = usePlan();
  const inPlan = hydrated && has(slug);

  return (
    <Button
      variant={inPlan ? 'secondary' : 'secondary'}
      size="md"
      full={full}
      onClick={() => toggle(slug)}
      aria-pressed={inPlan}
      aria-label={inPlan ? `Remove ${name} from your darshan` : `Add ${name} to your darshan`}
      className={cn(inPlan && 'border-[var(--tulsi)]/50 text-[var(--tulsi)]', className)}
    >
      {inPlan ? (
        <>
          <Check size={16} aria-hidden="true" />
          In darshan{items.length > 1 ? ` (${items.length})` : ''}
        </>
      ) : (
        <>
          <Plus size={16} aria-hidden="true" />
          Add to darshan
        </>
      )}
    </Button>
  );
}
