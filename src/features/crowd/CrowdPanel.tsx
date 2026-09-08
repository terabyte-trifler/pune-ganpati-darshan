'use client';

import { useEffect, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, Minus, Users } from 'lucide-react';
import { getDeviceId, newRequestId } from './device';
import { useClockMs, useCrowdStatus } from './useCrowd';
import { applyCrowdStatus, refreshCrowd } from './crowd-store';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { CrowdLevel, CrowdStatus, CrowdSubmitResult } from '@/types/crowd';

/**
 * "Crowd right now" — the mandal detail panel.
 *
 * Two jobs: say what devotees are reporting, and make it one tap to add
 * your own. Everything it displays is hedged to what it actually knows.
 * There is no state in which this panel asserts a queue length; it
 * reports what people said and how many said it, and when nobody has
 * said anything it says that instead of guessing (§33).
 */

const OPTIONS: { level: CrowdLevel; label: string; hint: string }[] = [
  { level: 'short', label: 'Short', hint: 'Straight in, barely a queue' },
  { level: 'moving', label: 'Moving', hint: 'A queue, but it keeps moving' },
  { level: 'long', label: '30+ min', hint: 'Heavy — a long wait' },
];

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
  reportingEnabled,
}: {
  mandalId: string;
  mandalName: string;
  reportingEnabled: boolean;
}) {
  const { status, stale, unavailable, loading } = useCrowdStatus(mandalId);
  // Null until hydrated: the server's clock is not the device's, so
  // rendering a relative time there would mismatch on hydration.
  const nowMs = useClockMs();
  const [submitting, setSubmitting] = useState<CrowdLevel | null>(null);
  const [thanks, setThanks] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownS, setCooldownS] = useState(0);

  // Count the cooldown down so the control comes back on its own rather
  // than making someone reload to find out.
  useEffect(() => {
    if (cooldownS <= 0) return;
    const timer = setInterval(() => setCooldownS((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldownS]);

  async function submit(level: CrowdLevel) {
    const deviceId = getDeviceId();
    if (!deviceId || submitting) return;

    setSubmitting(level);
    setNotice(null);

    try {
      const response = await fetch(`/api/crowd/${mandalId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          status: level,
          // A fresh key per attempt. If the response is lost and the user
          // taps again, that is a new intent; the retry that must not
          // duplicate is the network's, and fetch does not silently
          // replay a POST.
          requestId: newRequestId(),
        }),
      });

      const result = (await response.json()) as CrowdSubmitResult & {
        crowd?: CrowdStatus | null;
      };

      if (result.success) {
        trackEvent('crowd_reported', { props: { status: level } });
        setThanks(true);
        setCooldownS(3600);
        if (result.crowd) applyCrowdStatus(result.crowd);
        else void refreshCrowd();
        return;
      }

      switch (result.reason) {
        case 'cooldown':
          setCooldownS(result.retryAfter);
          setNotice('You already reported this mandal recently.');
          break;
        case 'rate_limited':
          setNotice('Too many reports just now. Try again in a few minutes.');
          break;
        case 'reporting_disabled':
          setNotice('Reporting is turned off for this mandal.');
          break;
        default:
          setNotice('Could not send that report. Try again shortly.');
      }
    } catch {
      setNotice('You appear to be offline. Your report was not sent.');
    } finally {
      setSubmitting(null);
    }
  }

  const level = status?.status ?? null;
  const ageMs =
    nowMs !== null && status?.lastUpdated
      ? Math.max(0, nowMs - Date.parse(status.lastUpdated))
      : null;
  const ago = agoText(Number.isFinite(ageMs) ? ageMs : null);

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

      {/* ---------------- Current state ---------------- */}
      {unavailable ? (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
          Crowd information is temporarily unavailable. Everything else on this
          page still works.
        </p>
      ) : loading && !status ? (
        <div className="mt-3 h-6 w-40 animate-pulse rounded bg-[var(--line-strong)]" />
      ) : level ? (
        <>
          <p
            className="mt-2.5 flex items-center gap-2 text-[22px] font-bold leading-none"
            style={{ color: CROWD_COLOR[level] }}
          >
            <CrowdDot level={level} size={12} />
            {status?.label}
          </p>

          <p className="mt-2 text-[13px] text-[var(--muted)]">
            {status && CONFIDENCE_WORDING[status.confidence]} ·{' '}
            {status?.reportCount}{' '}
            {status?.reportCount === 1 ? 'recent report' : 'recent reports'}
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
          <p className="mt-2.5 text-[15px] font-semibold text-[var(--chandan)]">
            No recent reports
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
            Nobody has reported {mandalName} in the last 90 minutes. If you are
            there, you would be the first.
          </p>
        </>
      )}

      {/* ---------------- Report ---------------- */}
      {reportingEnabled && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          {thanks ? (
            <div>
              <p className="text-[15px] font-semibold text-[var(--chandan)]">
                Thanks 🙏
              </p>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Your report helps other devotees decide where to go.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-[var(--chandan)]">
                How&rsquo;s the crowd?
              </p>

              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {OPTIONS.map((option) => (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => void submit(option.level)}
                    disabled={submitting !== null || cooldownS > 0}
                    title={option.hint}
                    className={cn(
                      'flex min-h-11 flex-col items-center justify-center gap-1 rounded-[var(--radius-field)]',
                      'border px-2 py-2 text-[13px] font-semibold',
                      'transition-[transform,background-color] active:scale-[0.97]',
                      'disabled:opacity-45'
                    )}
                    style={{
                      color: CROWD_COLOR[option.level],
                      borderColor: `color-mix(in srgb, ${CROWD_COLOR[option.level]} 38%, transparent)`,
                      background: `color-mix(in srgb, ${CROWD_COLOR[option.level]} 10%, transparent)`,
                    }}
                  >
                    {submitting === option.level ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <CrowdDot level={option.level} size={9} />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>

              {cooldownS > 0 && (
                <p className="mt-2 text-[12px] text-[var(--faint)]">
                  You can report this mandal again in{' '}
                  {Math.max(1, Math.ceil(cooldownS / 60))} min.
                </p>
              )}
            </>
          )}

          {notice && (
            <p role="status" className="mt-2 text-[12px] text-[var(--zendu)]">
              {notice}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
