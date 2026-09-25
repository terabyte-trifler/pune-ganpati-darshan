'use client';

import { TrendingDown, TrendingUp, Minus, Users, Footprints, Hourglass } from 'lucide-react';
import { useClockMs, useCrowdStatus } from './useCrowd';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { CrowdReportButtons } from './CrowdReportButtons';
import { WaitReportButtons } from './WaitReportButtons';
import type { CrowdStatus } from '@/types/crowd';
import { crowdExpectation, type PriorInput } from '@/services/crowd/crowd-prior';
import type { FestivalPhase } from '@/lib/festival';
import { features } from '@/lib/env';

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

function CrowdPanelInner({
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
  const { status, stale, unavailable, loading, dwell } = useCrowdStatus(mandalId);
  // Null until hydrated: the server's clock is not the device's, so
  // rendering a relative time there would mismatch on hydration.
  const nowMs = useClockMs();

  const level = status?.status ?? null;
  /**
   * A reading with nobody behind it.
   *
   * Enough independent devices dwelled here that the app is willing to
   * put a colour on the mandal, but no person reported it — so every
   * sentence in this branch has to say what was seen rather than what
   * anyone claimed, and the dot is half-filled rather than solid.
   */
  const observed = status?.source === 'observed';
  /**
   * Held by hand.
   *
   * Nobody reported this — somebody with the app's account went and
   * looked, or spoke to someone who had. Every sentence below that would
   * otherwise say "devotees" has to say so, because the whole panel is
   * built on not claiming more than it knows.
   */
  const overridden = status?.source === 'override';
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
            <CrowdDot level={level} size={12} fill={observed ? 'half' : 'filled'} />
            {status?.label}
          </p>

          {/* No queue time here. This panel already answers it below, in
              "People waited about ...", with a caveat this line could not
              carry — that the figure is what devotees reported and not a
              measured queue. Two statements of the same number, one of
              them less careful than the other, is worse than one. */}

          {/* No count, by the owner's decision: visitors are never told how
              many people reported. The confidence wording already carries
              how solid the reading is — and it accounts for agreement as
              well as volume, which a bare number would not. Counts remain
              visible to admins at /admin/crowd and /admin/crowd-score. */}
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            {observed || overridden
              ? status?.detail
              : status && CONFIDENCE_WORDING[status.confidence]}
          </p>

          {ago && (
            <p className="mt-1 text-[12px] text-[var(--faint)]">
              {observed
                ? `Devices last seen ${ago}`
                : overridden
                  ? `Reported ${ago}`
                  : stale
                    ? `Last known — updated ${ago}`
                    : `Updated ${ago}`}
            </p>
          )}

          {status && <TrendLine status={status} />}

          {/* The one number here that was measured rather than judged, so
              it is stated plainly and attributed to the people who waited.
              "About" because it is a median of a handful of reports, not a
              promise about the queue in front of you. */}
          {status?.waitMedianMinutes !== null && status?.waitMedianMinutes !== undefined && (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-[var(--chandan)]">
              <Hourglass size={13} aria-hidden="true" className="text-[var(--shendur)]" />
              People waited about{' '}
              <span className="font-semibold">
                {status.waitMedianMinutes >= 60
                  ? `${Math.round((status.waitMedianMinutes / 60) * 10) / 10} hr`
                  : `${status.waitMedianMinutes} min`}
              </span>
            </p>
          )}

          {/* An observed reading says nothing here.
              It used to add "Nobody has reported this mandal in the last
              90 minutes", directly under a line already saying the
              devices were last seen thirteen minutes ago and above a
              sentence about what those devices did. Three blocks of text
              for one reading, two of them about the app's own plumbing
              rather than about the queue. The panel says what was seen
              and when; how it knows is not the visitor's problem. */}
          {/* An override says nothing here either, for the same reason.
              It used to explain itself — who set it, and that it stands
              for half an hour before live reports take over. Owner's
              decision to drop it: to a visitor this IS the reading, and a
              paragraph about how long the app will keep it is the app
              talking about itself. The level, the wait and the time it
              was reported are on screen already, and they are the
              answer. */}
          {!observed && !overridden && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
            Reported by devotees in the last 90 minutes. Not a measured queue time.
          </p>
          )}
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
          ) : status && status.reportCount > 0 ? (
            /* There IS a report, it just is not a reading yet — one device
               is not two. The aggregation already words this case
               precisely ("Not confirmed yet"), without a count, and this used to ignore it and print "Nobody
               has reported" instead, which is the exact lie the
               aggregation's own comment warns against. Use its wording. */
            <>
              <p className="mt-2.5 text-[15px] font-semibold text-[var(--chandan)]">
                {status.label}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                {status.detail}
              </p>
            </>
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
              {/* Named before it is read, not after. The prose below says
                  "not a report from anyone there", but somebody skimming a
                  coloured line does not reach the prose — and this is the
                  same word the map pins and the tracker rows use, so the
                  three surfaces teach each other. */}
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
                Estimated
              </p>
              <p
                className="mt-1 flex items-center gap-2 text-[14px] font-semibold"
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

      {/* ---------------- The dwell lane ----------------

          A third thing, rendered below whatever the panel decided above
          and never inside it. It does not change the colour, the label,
          the confidence or the trend — it says what devices near the
          mandal were observed doing, in a proportion rather than a count,
          and admits it cannot tell a queue from people looking.

          It appears under a measured reading as well as under a silence,
          because unlike the prior it is an observation rather than a
          guess, so it does not compete with Lane A for the same claim. */}
      {dwell && (
        <p className="prose-measure mt-3 flex gap-2 border-t border-[var(--line)] pt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
          <Footprints
            size={14}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--faint)]"
          />
          <span>{dwell.detail}</span>
        </p>
      )}

      {/* ---------------- Report ---------------- */}
      {reportingEnabled && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <CrowdReportButtons mandalId={mandalId} location={mandalLocation} />

          {/* Gated to 1 km, like the colour buttons above.
              It was open to anyone from anywhere, on the reasoning that a
              wait time is given after the fact — on the walk to the next
              mandal or on the bus home — so refusing it once somebody had
              moved on would throw away the best report in the app. True,
              but it cut the wrong way: a wait report is the heaviest
              signal the tracker has, and being the easiest to file from
              a sofa made the median the easiest number to move.
              The person who left and wants to answer properly is still
              asked, by the dwell prompt on the home page, which knows
              they were here. */}
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <WaitReportButtons mandalId={mandalId} location={mandalLocation} />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Off while `features.crowd` is false.
 *
 * A wrapper rather than an early return inside CrowdPanelInner: that
 * component calls hooks, and returning before them changes hook order,
 * which React forbids. Not mounting it at all is both legal and the
 * thing actually wanted — no request is made and no state is kept.
 */
export function CrowdPanel(props: Parameters<typeof CrowdPanelInner>[0]) {
  if (!features.crowd) return null;
  return <CrowdPanelInner {...props} />;
}
