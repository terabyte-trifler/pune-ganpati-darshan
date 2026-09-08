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

  // The visible text, reused verbatim inside the accessible name. WCAG 2.5.3
  // requires the accessible name to contain the visible label; the previous
  // wording ("Add {name} to your darshan") did not contain "Add to darshan",
  // so voice control could not activate it by its visible words.
  const visibleLabel = inPlan
    ? `In darshan${items.length > 1 ? ` (${items.length})` : ''}`
    : 'Add to darshan';

  return (
    <Button
      variant={inPlan ? 'secondary' : 'secondary'}
      size="md"
      full={full}
      onClick={() => toggle(slug)}
      aria-pressed={inPlan}
      aria-label={
        inPlan ? `${visibleLabel} — tap to remove ${name}` : `${visibleLabel} — ${name}`
      }
      className={cn(inPlan && 'border-[var(--tulsi)]/50 text-[var(--tulsi)]', className)}
    >
      {inPlan ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      {visibleLabel}
    </Button>
  );
}
