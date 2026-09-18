'use client';

import { useState } from 'react';
import { Check, Hourglass, Loader2 } from 'lucide-react';
import { getDeviceId } from './device';
import { applyCrowdStatus, refreshCrowd } from './crowd-store';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import { type LatLng } from '@/lib/geo';
import { useReportGate } from './useReportGate';
import { ReportGateNotice } from './ReportGateNotice';
import type { CrowdStatus } from '@/types/crowd';

/**
 * "How long did you wait?"
 *
 * The one question in the app whose answer the person actually knows.
 * Every other report asks for a judgement about a queue they are looking
 * at — short, moving, heavy — and people disagree about those. Minutes
 * are a number, given afterwards by the person who stood there.
 *
 * The options are deliberately coarse and uneven. Nobody times their
 * darshan, so offering a free-text box invites made-up precision; these
 * are the buckets people already think in, and the gaps widen as the
 * numbers grow because the difference between 5 and 10 minutes matters
 * and the difference between 75 and 80 does not.
 *
 * It never asks twice for the same mandal: the server holds a two-hour
 * cooldown per device, and a second tap comes back as `cooldown` rather
 * than a second row.
 *
 * ---------------------------------------------------------------------
 * These buckets are gated to 1 km of the mandal, like the colour buttons,
 * whenever the caller passes `location`.
 *
 * A wait report is the heaviest signal in the app — worth 1.5x a colour,
 * and the only one the tracker turns into a number of minutes on screen.
 * That is exactly why it cannot be open to anyone from anywhere: a
 * handful of guesses from across town move a median that people are
 * planning their evening around.
 *
 * The one caller that does NOT pass a location is the dwell prompt, and
 * it is not an exception to the rule so much as a different way of
 * satisfying it — see WaitPrompt.
 * ---------------------------------------------------------------------
 */

const OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90] as const;

function label(minutes: number): string {
  if (minutes >= 60) return `${minutes / 60} hr${minutes >= 120 ? 's' : ''}`;
  return `${minutes} min`;
}

export function WaitReportButtons({
  mandalId,
  location,
  onDone,
  compact = false,
  minMinutes = 0,
  prompt,
}: {
  mandalId: string;
  /**
   * The mandal's position.
   *
   * When given, the buckets are gated to REPORT_MAX_DISTANCE_M and are
   * not rendered outside it. When omitted there is no gate, so a caller
   * may only leave it out if it has established presence some other way;
   * the dwell prompt is the only one that does.
   */
  location?: LatLng;
  /** Called after a report lands, so a prompt can dismiss itself. */
  onDone?: (minutes: number) => void;
  compact?: boolean;
  /**
   * Hide buckets below this.
   *
   * Set to 30 straight after somebody reports "30+ min": offering them
   * 5 and 10 there would contradict what they just said, and a control
   * that lets you disagree with yourself in the same breath reads as a
   * bug rather than a choice.
   */
  minMinutes?: number;
  /** Replaces the default question. */
  prompt?: string;
}) {
  const { eligibility, requestLocation } = useReportGate(location);
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(minutes: number) {
    const deviceId = getDeviceId();
    if (!deviceId || sending !== null) return;

    setSending(minutes);
    setNotice(null);

    // The same 12-second ceiling the colour report uses: on a saturated
    // festival cell fetch will otherwise wait for minutes, and a control
    // stuck on "sending" reads as a lost report.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(`/api/crowd/${mandalId}/wait`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          minutes,
          requestId: crypto.randomUUID(),
        }),
      }).finally(() => clearTimeout(timeout));

      const result = (await response.json()) as {
        success: boolean;
        reason?: string;
        crowd?: CrowdStatus | null;
      };

      if (result.success) {
        trackEvent('crowd_reported', { props: { status: 'wait', minutes } });
        setSent(minutes);
        if (result.crowd) applyCrowdStatus(result.crowd);
        else void refreshCrowd();
        onDone?.(minutes);
        return;
      }

      setNotice(
        result.reason === 'cooldown'
          ? 'You already told us about this mandal.'
          : result.reason === 'rate_limited'
            ? 'Too many reports just now. Try again in a few minutes.'
            : 'Could not send that just now.'
      );
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'AbortError';
      setNotice(
        timedOut
          ? 'The network here is slow — that did not go through.'
          : 'You appear to be offline.'
      );
    } finally {
      setSending(null);
    }
  }

  if (sent !== null) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-[13px] font-semibold text-[var(--chandan)]"
      >
        <Check size={14} aria-hidden="true" className="text-[var(--crowd-short)]" />
        Thanks — {label(sent)} noted 🙏
      </p>
    );
  }

  // Only when the caller asked for a gate. Placed after the thank-you
  // above on purpose: somebody whose report already landed should still
  // see it confirmed if their fix drops out a second later.
  if (location && eligibility.kind !== 'allowed') {
    return (
      <ReportGateNotice
        eligibility={eligibility}
        subject="wait"
        onRequestLocation={requestLocation}
        compact={compact}
      />
    );
  }

  return (
    <div>
      {!compact && (
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--chandan)]">
          <Hourglass size={14} aria-hidden="true" className="text-[var(--shendur)]" />
          {prompt ?? 'How long did you wait?'}
        </p>
      )}
      <div className={cn('flex flex-wrap gap-1.5', compact ? '' : 'mt-2.5')}>
        {OPTIONS.filter((m) => m >= minMinutes).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => void submit(m)}
            disabled={sending !== null}
            className={cn(
              'inline-flex min-h-11 items-center rounded-[var(--radius-chip)] border px-3.5 text-[13px] font-semibold transition-colors',
              sending === m
                ? 'border-[var(--shendur)] text-[var(--shendur)]'
                : 'border-[var(--line-strong)] text-[var(--chandan)] hover:border-[var(--shendur)]/50'
            )}
          >
            {sending === m ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              label(m)
            )}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
          {notice}
        </p>
      )}
    </div>
  );
}
