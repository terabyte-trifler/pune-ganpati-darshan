import { cn } from '@/lib/utils';
import type { CrowdDisplay } from './crowd-display';
import { CROWD_COLOR } from './CrowdBadge';
import type { CrowdLevel } from '@/types/crowd';

/**
 * How long the queue is, in the colour of how busy it is.
 *
 * The app knew this and never said it. A level — short, moving, heavy —
 * answers "should I go", and the next question every visitor has is "how
 * long will I stand there", which is the one that decides whether a plan
 * fits the evening. crowd-display has carried a figure all along and no
 * surface rendered it.
 *
 * Two different things can produce the number and they are not shown
 * alike:
 *
 *   reported   the median of what people standing there actually waited.
 *              A measurement. Stated plainly.
 *   modelled   this mandal's own darshan bounds read against the level
 *              people are reporting. A figure, not a measurement, so it
 *              is hedged with "about" and never given a false precision.
 *
 * Specific to the mandal either way. A heavy queue at Dagdusheth and a
 * heavy queue at a lane mandal are both heavy and are not both the same
 * wait — waitBounds in crowd-prior is where that difference lives, and
 * this reads from it rather than applying one number to all of them.
 */
export function QueueTime({
  level,
  wait,
  className,
  size = 'md',
  suffix = true,
}: {
  level: CrowdLevel | null;
  wait: { minutes: number; source: 'reported' | 'modelled' } | null;
  className?: string;
  size?: 'sm' | 'md';
  /**
   * Whether to say what the minutes are.
   *
   * A row with the full width of the screen can carry "90 min reported
   * wait". A card in a two-column grid cannot: it broke as "about 10 /
   * min / in the queue", three lines of one short phrase. There the badge
   * beside it already says whether the reading was reported or estimated,
   * so the number can stand alone without losing anything.
   */
  suffix?: boolean;
}) {
  if (!level || !wait || wait.minutes <= 0) return null;
  const { minutes } = wait;
  const reported = wait.source === 'reported';
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1 whitespace-nowrap font-semibold tabular-nums',
        size === 'sm' ? 'text-[12px]' : 'text-[13px]',
        className
      )}
      style={{ color: CROWD_COLOR[level] }}
      title={
        reported
          ? 'The middle of what people here have said they waited'
          : 'Worked out from this mandal’s own darshan time and how busy people say it is — not a measured wait'
      }
    >
      {/* "about" carries the whole difference between a measured wait and
          a worked-out one, and it is the word people already use for it. */}
      {reported ? '' : 'about '}
      {minutes} min
      {suffix && (
        <span className="font-normal text-[var(--faint)]">
          {reported ? 'reported wait' : 'in the queue'}
        </span>
      )}
    </span>
  );
}

/**
 * The same thing, for a caller that already holds a CrowdDisplay.
 *
 * Saves every such surface unpacking the two fields itself and getting
 * the null cases subtly different from its neighbours.
 */
export function QueueTimeFor({
  display,
  className,
  size = 'sm',
  suffix = true,
}: {
  display: CrowdDisplay | null;
  className?: string;
  size?: 'sm' | 'md';
  suffix?: boolean;
}) {
  if (!display) return null;
  return (
    <QueueTime
      level={display.level}
      wait={
        display.estimatedWaitMinutes != null && display.waitSource
          ? { minutes: display.estimatedWaitMinutes, source: display.waitSource }
          : null
      }
      className={className}
      size={size}
      suffix={suffix}
    />
  );
}
