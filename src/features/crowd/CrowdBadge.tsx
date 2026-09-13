'use client';

import { useCrowdDisplayFor } from './useCrowdDisplay';
import type { CrowdDisplay } from './crowd-display';
import { cn } from '@/lib/utils';
import type { PriorInput } from '@/services/crowd/crowd-prior';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Compact crowd indicator for cards, list rows and map callouts.
 *
 * Two states, never confused. A filled badge is what people reported. A
 * dashed, hollow one prefixed "Estimated" is what the app expects from
 * the hour and the day of the festival, shown only where nobody has reported
 * — see features/crowd/crowd-display.
 *
 * It still renders nothing at all when there is neither: outside the
 * festival, and on visarjan afternoon, an absent badge means "we don't
 * know", and an empty state must never be dressed up as a short queue
 * (§32, §33).
 */

export const CROWD_COLOR: Record<CrowdLevel, string> = {
  short: 'var(--crowd-short)',
  moving: 'var(--crowd-moving)',
  long: 'var(--crowd-long)',
};

/**
 * Level is carried by shape as well as colour, so the badge still reads
 * for a colour-blind user and in greyscale (§37 of the app brief).
 */
const SHAPE: Record<CrowdLevel, string> = {
  short: 'rounded-full',
  moving: 'rounded-[2px]',
  long: 'rounded-[2px] rotate-45',
};

export function CrowdDot({
  level,
  size = 8,
  /**
   * Outline only, for a level the app worked out rather than was told.
   *
   * The same distinction the pins make, in the same visual language: a
   * filled mark is a report, a hollow one is an estimate. It reads in
   * greyscale, which the word beside it does not.
   */
  hollow = false,
}: {
  level: CrowdLevel;
  size?: number;
  hollow?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0', SHAPE[level])}
      style={{
        width: size,
        height: size,
        background: hollow ? 'transparent' : CROWD_COLOR[level],
        boxShadow: hollow ? `inset 0 0 0 1.5px ${CROWD_COLOR[level]}` : undefined,
      }}
    />
  );
}

/** Presentational form — takes a display directly, for server-rendered lists. */
export function CrowdBadgeView({
  display,
  className,
}: {
  display: CrowdDisplay | null;
  className?: string;
}) {
  if (!display) return null;

  const { level, estimated } = display;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1',
        'text-[12px] font-semibold leading-none',
        'border backdrop-blur-sm',
        // Dashed, like the panel's expectation box: an estimate is drawn
        // as an outline of a badge rather than a badge.
        estimated && 'border-dashed',
        className
      )}
      style={{
        color: CROWD_COLOR[level],
        borderColor: `color-mix(in srgb, ${CROWD_COLOR[level]} ${estimated ? 34 : 40}%, transparent)`,
        background: estimated
          ? 'rgb(20 16 12 / 0.72)'
          : `color-mix(in srgb, ${CROWD_COLOR[level]} 14%, rgb(20 16 12 / 0.82))`,
      }}
      // Read aloud, "Estimated short" is a fragment. This is the sentence.
      title={
        estimated
          ? `Estimated from the time of day — nobody has reported this mandal in the last 90 minutes`
          : undefined
      }
    >
      <CrowdDot level={level} hollow={estimated} />
      {/* Truncates rather than overflows: "Estimated moving" is long, and
          the badge sits in a corner of a half-width card. */}
      <span className="truncate">{display.label}</span>
      {/* The count stays off THIS surface deliberately, and that is now a
          narrower decision than it was.

          A badge sits on a map pin and on a card in a grid: its job is
          triage at a glance, and a second number competing with the label
          costs more there than it pays. The strength information it cannot
          carry is no longer lost, though — the detail panel now shows the
          count alongside the confidence wording, which is the surface
          where someone is actually deciding whether to walk over.
          Admins read the raw counts at /admin/crowd. */}
    </span>
  );
}

/**
 * Live form — subscribes to the shared store.
 *
 * `prior` is optional and its absence is a real decision, not an
 * oversight: a surface that passes it gets an "Estimated" badge where nobody
 * has reported, and one that does not shows nothing there, exactly as
 * before. Anywhere a mandal's catalogue entry is to hand, pass it.
 */
export function CrowdBadge({
  mandalId,
  prior,
  className,
}: {
  mandalId: string;
  prior?: PriorInput;
  className?: string;
}) {
  const display = useCrowdDisplayFor(mandalId, prior);
  return <CrowdBadgeView display={display} className={className} />;
}
