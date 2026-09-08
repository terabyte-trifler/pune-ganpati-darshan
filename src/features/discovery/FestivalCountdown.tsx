import { getFestivalPhase } from '@/lib/festival';
import type { FestivalConfig } from '@/types/ganpati';

/**
 * Festival status strip.
 *
 * Phase comes from configuration, so a new year needs a data change only
 * (§26). Rendered on the server: the value changes at most once a day, and
 * shipping a client timer for it would be waste.
 */
export function FestivalCountdown({ config }: { config: FestivalConfig }) {
  const phase = getFestivalPhase(config);

  const { line, sub } = (() => {
    switch (phase.phase) {
      case 'before':
        return {
          line: phase.daysUntil === 1 ? 'Ganpati is tomorrow' : `${phase.daysUntil} days to Ganpati`,
          sub: config.tagline ?? `Ganeshotsav ${config.year}`,
        };
      case 'during':
        return {
          line: config.greetingEn,
          sub: phase.isVisarjan
            ? `Visarjan · day ${phase.day} of ${phase.totalDays}`
            : `Day ${phase.day} of ${phase.totalDays}`,
        };
      case 'after':
        return {
          line: `Ganeshotsav ${config.year} has ended`,
          sub: 'Mandal information stays available year-round',
        };
    }
  })();

  return (
    <div className="flex items-center gap-3 rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)]/70 px-3.5 py-2 backdrop-blur">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--zendu)]"
        style={{ boxShadow: '0 0 10px 2px rgb(242 169 59 / 0.55)' }}
      />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-[var(--chandan)]">{line}</p>
        <p className="truncate text-[11px] text-[var(--faint)]">{sub}</p>
      </div>
      {phase.phase === 'during' && (
        <span lang="mr" className="ml-auto shrink-0 text-[12px] font-semibold text-[var(--pital)]">
          {config.greetingMr}
        </span>
      )}
    </div>
  );
}
