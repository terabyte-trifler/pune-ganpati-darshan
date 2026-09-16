'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, Hourglass, Loader2, MapPin } from 'lucide-react';
import { getDeviceId } from './device';
import { applyCrowdStatus, refreshCrowd } from './crowd-store';
import { reportEligibility, WAIT_REPORT_MAX_DISTANCE_M } from './report-eligibility';
import {
  useGeolocation, useResolveLocation, requestPreciseLocation,
} from '@/hooks/useGeolocation';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import { formatDistance, type LatLng } from '@/lib/geo';
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
 * You have to have been there.
 *
 * This question had no radius at all, which made it the one report in the
 * app that could be filed from anywhere — a wait time typed in at home,
 * carrying the same weight as one from somebody who stood in the queue.
 * That matters more here than for the colour vote, because minutes are
 * the strongest figure the app has: `queueTimeFor` shows a reported wait
 * ahead of both the devices and the model, so a made-up number outranks
 * everything else on the mandal.
 *
 * The radius is 1.5 km rather than the vote's 1 km, because the question
 * is asked on the way out rather than at the gate. See
 * WAIT_REPORT_MAX_DISTANCE_M.
 *
 * As with the colour vote, this is a UI rule and not enforcement: the
 * endpoint is still never sent a position, because a coordinate in a
 * request log is a record of where somebody stood. It removes the honest
 * mistake, which is the common one.
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
   * The mandal's own position.
   *
   * Optional, and its absence is NOT treated as permission: without a
   * coordinate there is no distance to check, so the controls are not
   * offered. The colour vote can fall back to submitting as off-site
   * because it has a weight to reduce; a wait time has no such dial, so
   * "we cannot tell" has to mean "do not ask".
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
  const { state: geo, request: requestLocation } = useGeolocation();
  // Picks up a permission already granted; never opens a dialog by itself.
  useResolveLocation();

  const eligibility = reportEligibility(geo, location, WAIT_REPORT_MAX_DISTANCE_M);

  /**
   * A coarse fix that lands outside the radius asks the GPS radio once.
   *
   * Same escalation the colour vote makes, and for the same reason: a
   * wifi fix good to 2 km cannot settle a 1.5 km question, and refusing
   * somebody standing in the lane because the radio was not asked is the
   * one failure worth spending a second on. Guarded by a ref so a
   * watchPosition that keeps landing coarse cannot loop.
   */
  const refined = useRef(false);
  useEffect(() => {
    if (eligibility.kind !== 'refining' || refined.current) return;
    refined.current = true;
    requestPreciseLocation();
  }, [eligibility.kind]);

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

  /**
   * Not close enough to be asked.
   *
   * The question itself is withheld, not just the buttons. "How long did
   * you wait?" above a refusal reads as a broken control; somebody who is
   * across town was never being asked, and the card should say so in one
   * line or say nothing.
   */
  if (eligibility.kind !== 'allowed') {
    const message = (() => {
      switch (eligibility.kind) {
        case 'locating':
          return 'Finding you…';
        case 'needs-location':
          return null; // rendered as an action below, not a sentence
        case 'no-location':
          return eligibility.reason === 'denied'
            ? 'Location is off, so we can’t tell whether you were there. Wait times come from people at the mandal.'
            : 'We couldn’t get your location, so we can’t tell whether you were there.';
        case 'refining':
          return 'Getting a more precise location — the first fix was too rough to tell how far away you are.';
        case 'too-far':
          return `You’re ${formatDistance(eligibility.distanceM)} away. Wait times come from people within ${formatDistance(WAIT_REPORT_MAX_DISTANCE_M)} of the mandal.`;
        case 'unknown-mandal':
          return 'We don’t have a position for this mandal, so wait times can’t be placed.';
      }
    })();

    if (eligibility.kind === 'needs-location') {
      return (
        <button
          type="button"
          onClick={() => { trackEvent('location_enabled'); requestLocation(); }}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
        >
          <MapPin size={14} aria-hidden="true" />
          Turn on location to add your wait
        </button>
      );
    }
    return (
      <p className="text-[12px] leading-relaxed text-[var(--muted)]">{message}</p>
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
