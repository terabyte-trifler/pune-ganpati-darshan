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
 *   observed   the median the dwell devices measured. Also a measurement,
 *              but a one-sided one — it misses anybody who closed the tab
 *              mid-queue and counts everybody admiring the dekhava from
 *              outside, so it under-reads by construction. It is shown
 *              only where it exceeds the modelled figure, and it is
 *              phrased "at least", which is the true claim: devices stood
 *              here this long, so the queue was at least this long.
 *   override   minutes somebody from the team asserted after going and
 *              looking. A measurement, stated plainly like a reported
 *              one — but never CALLED a report, because one named person
 *              is not "people here".
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
  wait: { minutes: number; source: 'reported' | 'observed' | 'modelled' | 'override' } | null;
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
  const observed = wait.source === 'observed';
  // Asserted by somebody from the team who went and looked. Stated as
  // plainly as a reported wait, because it is a measurement — just not
  // one a visitor made, which is why it is not called one.
  const checked = wait.source === 'override';
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
          : checked
            ? 'Checked by the Pune Ganpati Darshan team'
            : observed
            ? 'Measured from phones that stood here — the queue was at least this long, and may be longer'
            : 'Worked out from this mandal’s own darshan time and how busy people say it is — not a measured wait'
      }
    >
      {/* Three different claims, three different words. Nothing for a
          reported wait, which is simply what people said they stood.
          "at least" for the devices, which under-read by construction and
          so can only ever establish a floor. "about" for the model, which
          is a worked-out figure and not a measurement at all. */}
      {reported || checked ? '' : observed ? 'at least ' : 'about '}
      {minutes} min
      {suffix && (
        <span className="font-normal text-[var(--faint)]">
          {reported ? 'reported wait'
            : checked ? 'checked wait'
              : observed ? 'measured here' : 'in the queue'}
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
