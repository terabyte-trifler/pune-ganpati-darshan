'use client';

import { useCrowdStatus } from './useCrowd';
import { cn } from '@/lib/utils';
import type { CrowdLevel, CrowdStatus } from '@/types/crowd';

/**
 * Compact crowd indicator for cards, list rows and map callouts.
 *
 * Renders nothing when there are no recent reports. That is the rule the
 * whole feature stands on: an absent badge means "we don't know", and an
 * empty state must never be dressed up as a short queue (§32, §33). A
 * "No recent reports" chip on every card before the festival starts would
 * also be noise on top of being useless, so the explicit empty wording
 * lives in the detail panel where there is room to explain it.
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

export function CrowdDot({ level, size = 8 }: { level: CrowdLevel; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block shrink-0', SHAPE[level])}
      style={{ width: size, height: size, background: CROWD_COLOR[level] }}
    />
  );
}

/** Presentational form — takes a status directly, for server-rendered lists. */
export function CrowdBadgeView({
  status,
  className,
}: {
  status: CrowdStatus | null;
  className?: string;
}) {
  if (!status?.status || status.reportCount === 0) return null;

  const level = status.status;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1',
        'text-[12px] font-semibold leading-none',
        'border backdrop-blur-sm',
        className
      )}
      style={{
        color: CROWD_COLOR[level],
        borderColor: `color-mix(in srgb, ${CROWD_COLOR[level]} 40%, transparent)`,
        background: `color-mix(in srgb, ${CROWD_COLOR[level]} 14%, rgb(20 16 12 / 0.82))`,
      }}
    >
      <CrowdDot level={level} />
      {status.label}
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

/** Live form — subscribes to the shared store. */
export function CrowdBadge({
  mandalId,
  className,
}: {
  mandalId: string;
  className?: string;
}) {
  const { status } = useCrowdStatus(mandalId);
  return <CrowdBadgeView status={status} className={className} />;
}
