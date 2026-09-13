'use client';

import { useCrowdDisplayFor } from './useCrowdDisplay';
import type { CrowdDisplay } from './crowd-display';
import { cn } from '@/lib/utils';
import type { PriorInput } from '@/services/crowd/crowd-prior';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Compact crowd indicator for cards, list rows and map callouts.
 *
 * Three states, never confused. A filled badge is what people reported.
 * A half-filled one prefixed "Observed" is what devices near the mandal
 * were seen doing, with nobody reporting. A dashed, hollow one prefixed
 * "Estimated" is what the app expects from the hour and the day of the
 * festival — see features/crowd/crowd-display.
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
   * How much of the dot is filled in, matching the map pins exactly:
   * filled is a report, half is something the devices were observed
   * doing, hollow is the clock model. It reads in greyscale, which the
   * word beside it does not.
   */
  fill = 'filled',
}: {
  level: CrowdLevel;
  size?: number;
  fill?: 'filled' | 'half' | 'hollow';
}) {
  const color = CROWD_COLOR[level];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0', SHAPE[level])}
      style={{
        width: size,
        height: size,
        background:
          fill === 'filled'
            ? color
            : fill === 'half'
              ? `color-mix(in srgb, ${color} 30%, transparent)`
              : 'transparent',
        boxShadow: fill === 'filled' ? undefined : `inset 0 0 0 1.5px ${color}`,
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

  const { level, source } = display;
  const fill = source === 'reported' ? 'filled' : source === 'observed' ? 'half' : 'hollow';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1',
        'text-[12px] font-semibold leading-none',
        'border backdrop-blur-sm',
        // Dashed, like the panel's expectation box: an estimate is drawn
        // as an outline of a badge rather than a badge. An observation is
        // a solid border — it is a measurement, just not a report.
        source === 'estimated' && 'border-dashed',
        className
      )}
      style={{
        color: CROWD_COLOR[level],
        borderColor: `color-mix(in srgb, ${CROWD_COLOR[level]} ${
          source === 'estimated' ? 34 : 40
        }%, transparent)`,
        background:
          source === 'estimated'
            ? 'rgb(20 16 12 / 0.72)'
            : `color-mix(in srgb, ${CROWD_COLOR[level]} ${
                source === 'observed' ? 9 : 14
              }%, rgb(20 16 12 / 0.82))`,
      }}
      // Read aloud, "Estimated short" is a fragment. This is the sentence.
      title={
        source === 'estimated'
          ? 'Estimated from the time of day — nobody has reported this mandal in the last 90 minutes'
          : source === 'observed'
            ? 'Nobody has reported this mandal — this is what devices near it were seen doing'
            : undefined
      }
    >
      <CrowdDot level={level} fill={fill} />
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
