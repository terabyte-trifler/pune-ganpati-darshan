'use client';

import { TrendingDown, TrendingUp, Minus, Users } from 'lucide-react';
import { useClockMs, useCrowdStatus } from './useCrowd';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { CrowdReportButtons } from './CrowdReportButtons';
import type { CrowdStatus } from '@/types/crowd';
import { crowdExpectation, type PriorInput } from '@/services/crowd/crowd-prior';
import type { FestivalPhase } from '@/lib/festival';

/**
 * "Crowd right now" — the mandal detail panel.
 *
 * Two jobs: say what devotees are reporting, and make it one tap to add
 * your own. Everything it displays is hedged to what it actually knows.
 * There is no state in which this panel asserts a queue length; it
 * reports what people said and how many said it, and when nobody has
 * said anything it says that instead of guessing (§33).
 */

const CONFIDENCE_WORDING = {
  low: 'Early signal',
  medium: 'Fair signal',
  high: 'Strong signal',
} as const;

function TrendLine({ status }: { status: CrowdStatus }) {
  if (status.trend === 'unknown') return null;

  const config = {
    improving: { Icon: TrendingDown, text: 'Crowd appears to be easing', tone: 'var(--crowd-short)' },
    worsening: { Icon: TrendingUp, text: 'Crowd appears to be building', tone: 'var(--crowd-long)' },
    stable: { Icon: Minus, text: 'Holding steady', tone: 'var(--muted)' },
  }[status.trend];

  return (
    <p className="mt-2 flex items-center gap-1.5 text-[13px]" style={{ color: config.tone }}>
      <config.Icon size={14} aria-hidden="true" />
      {config.text}
    </p>
  );
}

/** "3 min ago". Minute resolution — second-level precision implies more
 *  certainty than a crowdsourced reading has. */
function agoText(ms: number | null): string | null {
  if (ms === null) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

export function CrowdPanel({
  mandalId,
  mandalName,
  mandalLocation,
  reportingEnabled,
  prior,
  festivalPhase,
}: {
  mandalId: string;
  mandalName: string;
  /** Used only to decide whether a report counts as made on site. */
  mandalLocation: { lat: number; lng: number };
  reportingEnabled: boolean;
  /**
   * The mandal's curated wait figures, for the "usually" fallback.
   *
   * Passed in rather than fetched, and the expectation is computed HERE on
   * the device rather than server-side, for one reason: a prior attached
   * to the crowd API response would need that request to succeed, and the
   * moment it is most wanted — 9pm in a peth lane with the cells
   * saturated — is exactly when it will not. Computed from static props
   * and the clock, it works with no network at all.
   */
  prior?: PriorInput;
  festivalPhase?: FestivalPhase;
}) {
  const { status, stale, unavailable, loading } = useCrowdStatus(mandalId);
  // Null until hydrated: the server's clock is not the device's, so
  // rendering a relative time there would mismatch on hydration.
  const nowMs = useClockMs();

  const level = status?.status ?? null;
  const ageMs =
    nowMs !== null && status?.lastUpdated
      ? Math.max(0, nowMs - Date.parse(status.lastUpdated))
      : null;
  const ago = agoText(Number.isFinite(ageMs) ? ageMs : null);

  // Lane B. Consulted only where Lane A is silent, and never merged with
  // it — see services/crowd/crowd-prior. nowMs is null until hydration,
  // which also keeps this out of the server render: an expectation is a
  // function of the reader's clock, not the build's.
  const expectation =
    !level && prior && festivalPhase && nowMs !== null
      ? crowdExpectation(prior, festivalPhase, new Date(nowMs))
      : null;

  return (
    <section
      className="surface mt-6 rounded-[var(--radius-card)] border border-[var(--line)] p-4"
      aria-labelledby="crowd-heading"
    >
      <h2
        id="crowd-heading"
        className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]"
      >
        <Users size={13} aria-hidden="true" />
        Crowd right now
      </h2>

      {/* ---------------- Current state ----------------

          A measured reading wins outright. Everything else — offline,
          still loading, or simply unreported — falls through to the same
          branch, which always ends with the expectation.

          This order matters and it was wrong at first: `unavailable` used
          to be tested before anything else, so a visitor with no network
          got "temporarily unavailable" and nothing more. That is the one
          case the prior exists for — no network is when a live status
          cannot arrive — and it was the one case that skipped it. */}
      {level ? (
        <>
          <p
            className="mt-2.5 flex items-center gap-2 text-[22px] font-bold leading-none"
            style={{ color: CROWD_COLOR[level] }}
          >
            <CrowdDot level={level} size={12} />
            {status?.label}
          </p>

          {/* The count, restored — and the reason the old objection no
              longer holds.

              It was hidden because "1 recent report" reads as a broken
              feature rather than an early one. But a status is only shown
              once MIN_DEVICES_FOR_STATUS distinct devices agree, and
              reportCount counts reports, so on anything displayed here the
              number is at least two. The feared "1" is structurally
              impossible on this line — and the one-report case already
              says so in words ("One person has reported this mandal").

              Both cues are kept because they are not the same claim. The
              count is the evidence; the confidence wording also accounts
              for agreement, so five reports split three ways is "Early
              signal" despite the count. Showing the number alone would
              overstate exactly that case. */}
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            {status && (
              <>
                <span className="font-semibold text-[var(--chandan)] tabular-nums">
                  {status.reportCount}
                </span>{' '}
                {status.reportCount === 1 ? 'report' : 'reports'} in the last 90
                min
                <span className="text-[var(--faint)]">
                  {' · '}
                  {CONFIDENCE_WORDING[status.confidence]}
                </span>
              </>
            )}
          </p>

          {ago && (
            <p className="mt-1 text-[12px] text-[var(--faint)]">
              {stale ? `Last known — updated ${ago}` : `Updated ${ago}`}
            </p>
          )}

          {status && <TrendLine status={status} />}

          <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
            Reported by devotees in the last 90 minutes. Not a measured queue
            time.
          </p>
        </>
      ) : (
        <>
          {unavailable ? (
            <>
              <p className="mt-2.5 text-[15px] font-semibold text-[var(--chandan)]">
                Live reports could not load
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                No connection, or the reports are temporarily unreachable.
                Everything else on this page still works.
              </p>
            </>
          ) : loading && !status ? (
            <div className="mt-3 h-6 w-40 animate-pulse rounded bg-[var(--line-strong)]" />
          ) : (
            <>
              <p className="mt-2.5 text-[15px] font-semibold text-[var(--chandan)]">
                No recent reports
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                Nobody has reported {mandalName} in the last 90 minutes. If you
                are there, you would be the first.
              </p>
            </>
          )}

          {/* The expectation. Deliberately styled unlike a reading: the
              dot is hollow, the wording starts "Usually", and the figure
              is a rounded range in prose rather than a headline number.
              Someone glancing at this must not be able to mistake it for
              something a person reported. */}
          {expectation && (
            <div className="mt-3 rounded-[var(--radius-field)] border border-dashed border-[var(--line-strong)] px-3 py-2.5">
              <p
                className="flex items-center gap-2 text-[14px] font-semibold"
                style={{ color: CROWD_COLOR[expectation.level] }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px]"
                  style={{ borderColor: CROWD_COLOR[expectation.level] }}
                />
                {expectation.label} at this hour
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
                {expectation.detail}
              </p>
            </div>
          )}
        </>
      )}

      {/* ---------------- Report ---------------- */}
      {reportingEnabled && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <CrowdReportButtons mandalId={mandalId} location={mandalLocation} />
        </div>
      )}
    </section>
  );
}
