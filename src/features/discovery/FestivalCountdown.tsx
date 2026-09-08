import { getFestivalPhase } from '@/lib/festival';
import type { FestivalConfig } from '@/types/ganpati';

/**
 * Festival status strip.
 *
 * Phase comes from configuration, so a new year needs a data change only
 * (§26). Rendered on the server: the value changes at most once a day, and
 * shipping a client timer for it would be waste.
 *
 * During the festival this is the emotional anchor of the page — it is the
 * one element that should feel like an occasion rather than a UI chip — so
 * the "during" state gets brass, a lit dot and the Marathi greeting given
 * equal weight to the English.
 */
export function FestivalCountdown({ config }: { config: FestivalConfig }) {
  const phase = getFestivalPhase(config);
  const during = phase.phase === 'during';

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
    <div
      className={[
        'relative flex items-center gap-3 overflow-hidden rounded-full px-4 py-2.5',
        'border backdrop-blur',
        during
          ? 'border-[var(--pital)]/40 bg-gradient-to-r from-[var(--pital)]/[0.14] via-[var(--shendur)]/[0.08] to-transparent'
          : 'border-[var(--line-strong)] bg-[var(--dhoop)]/70',
      ].join(' ')}
    >
      {/* A lit lamp rather than a status dot. */}
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {during && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--zendu)] opacity-60" />
        )}
        <span
          className="relative inline-flex h-2 w-2 rounded-full bg-[var(--zendu)]"
          style={{ boxShadow: 'var(--glow-zendu)' }}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={[
            'truncate text-[13px] font-semibold',
            during ? 'text-[var(--pital)]' : 'text-[var(--chandan)]',
          ].join(' ')}
        >
          {line}
        </p>
        <p className="truncate text-[12px] text-[var(--faint)]">{sub}</p>
      </div>

      {during && (
        <span
          lang="mr"
          className="ml-auto shrink-0 font-display text-[13px] font-bold text-[var(--zendu)]"
        >
          {config.greetingMr}
        </span>
      )}
    </div>
  );
}
