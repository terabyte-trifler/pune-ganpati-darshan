'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, RotateCcw, Check } from 'lucide-react';
import { getDeviceId, newRequestId, resetDeviceId } from './device';
import { WaitReportButtons } from './WaitReportButtons';
import { applyCrowdStatus, refreshCrowd } from './crowd-store';
import {
  getCooldownState,
  getServerCooldownState,
  noteCooldown,
  subscribeToCooldowns,
} from './cooldown-store';
import { useClockMs } from './useCrowd';
import { type LatLng } from '@/lib/geo';
import { useReportGate } from './useReportGate';
import { ReportGateNotice } from './ReportGateNotice';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { CrowdLevel, CrowdStatus, CrowdSubmitResult } from '@/types/crowd';
import { features } from '@/lib/env';

/**
 * "How's the crowd?" — the three report buttons.
 *
 * Extracted so the mandal page and the map both submit through exactly the
 * same code. When this lived inside the detail panel, adding reporting to
 * the map meant copying the submit logic, and two copies of anything that
 * handles cooldowns, idempotency keys and error mapping will disagree
 * within a month.
 *
 * `compact` is the map variant: same targets, less chrome.
 *
 * ---------------------------------------------------------------------
 * On why this does NOT optimistically move the crowd reading.
 *
 * The obvious way to make a vote feel instant is to write the reported
 * level straight into the store and reconcile later. This deliberately
 * does not, because one tap is not a crowd reading: the panel would jump
 * to "Short" on the strength of a single unconfirmed report, which is
 * exactly the invented certainty the rest of the feature refuses to
 * produce (§32, §33). What IS optimistic here is the interaction — the
 * tapped option latches immediately, the row locks, the phone buzzes — so
 * the control still answers within a frame on a congested festival
 * network. Honesty about the data, instant feedback about the tap.
 * ---------------------------------------------------------------------
 */

const OPTIONS: { level: CrowdLevel; label: string; hint: string }[] = [
  { level: 'short', label: 'Short', hint: 'Straight in' },
  { level: 'moving', label: 'Moving', hint: 'Queue, but moving' },
  { level: 'long', label: '30+ min', hint: 'Heavy, long wait' },
];

/** How long the thank-you holds the row before the cooldown state takes over. */
const CONFIRM_MS = 5_000;


/**
 * A short, single buzz on tap.
 *
 * Wrapped because `navigator.vibrate` is absent on iOS and throws in some
 * embedded webviews, and a haptic failing must never cost the user their
 * report. Silent by design when unsupported — this is a garnish, not a
 * channel that carries meaning on its own.
 */
function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported; the visual state is the real feedback */
  }
}

export function useCooldownExpiry(mandalId: string): number | null {
  const cooldowns = useSyncExternalStore(
    subscribeToCooldowns,
    getCooldownState,
    getServerCooldownState
  );
  return cooldowns[mandalId] ?? null;
}

/** "in 42 min" / "in a moment" — minute resolution, matching the panel. */
function remainingText(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return 'in a moment';
  return `in ${minutes} min`;
}

/**
 * How long to wait for a report before giving up and offering a retry.
 *
 * Generous for a working connection, and far short of the minutes fetch
 * will otherwise spend on a saturated cell.
 */
const SUBMIT_TIMEOUT_MS = 12_000;


function CrowdReportButtonsInner({
  mandalId,
  location,
  compact = false,
  onReported,
}: {
  mandalId: string;
  /**
   * The mandal's own position. Optional: without it a report is submitted
   * as off-site, which is the honest default when we cannot tell.
   */
  location?: LatLng;
  compact?: boolean;
  onReported?: () => void;
}) {
  /**
   * Whether this person may report at all, and with how much weight.
   *
   * One rule, shared by every surface that offers either control — the
   * mandal page, the map sheet and the home prompt — so they cannot drift
   * into disagreeing about who is close enough. See `useReportGate`.
   *
   * `atMandal` is still client-asserted, and the server treats it as a
   * hint rather than a fact: anyone can POST it. The cost of lying is
   * capped by the rules behind it — one report per device per mandal per
   * hour means a liar buys one extra unit of weight on one mandal, and
   * someone willing to forge this could mint device ids just as easily.
   */
  const { eligibility, atMandal, requestLocation } = useReportGate(location);

  const [submitting, setSubmitting] = useState<CrowdLevel | null>(null);
  /** The level this device just reported, kept so the row can show it back. */
  const [reported, setReported] = useState<CrowdLevel | null>(null);
  /** True only during the thank-you window, not for the whole cooldown. */
  const [confirming, setConfirming] = useState(false);
  /**
   * Asked once. The follow-up must not reappear after it is answered —
   * and the confirm panel is transient, so without this it would return
   * for a second round on the next report.
   */
  const [waitAnswered, setWaitAnswered] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when the failure is worth offering a retry for; drives the button. */
  const [retryable, setRetryable] = useState<CrowdLevel | null>(null);

  const expiresAt = useCooldownExpiry(mandalId);
  const nowMs = useClockMs();

  // Null before hydration, so the server never renders a countdown from its
  // own clock. Treated as "no cooldown" until we know otherwise — the
  // server refuses anyway, so the worst case is one wasted tap.
  const remainingS =
    expiresAt !== null && nowMs !== null
      ? Math.max(0, Math.ceil((expiresAt - nowMs) / 1000))
      : 0;

  const blocked = remainingS > 0;

  /**
   * Retire the thank-you after a few seconds.
   *
   * The row used to stop here permanently: a mis-tap cost you the panel
   * until a reload, and you never saw the reading your own report had just
   * moved. Handing the row back — disabled, carrying the countdown — keeps
   * the original guarantee that there is nothing tappable the server would
   * refuse, without the dead end.
   */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!confirming) return;
    // A "30+ min" report leaves a question on screen, and five seconds is
    // not long enough to read it, decide and tap. The panel holds until
    // that is answered or dismissed; every other report still clears
    // itself, because there is nothing there to act on.
    if (reported === 'long' && !waitAnswered) return;
    timerRef.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [confirming, reported, waitAnswered]);

  async function submit(level: CrowdLevel) {
    const deviceId = getDeviceId();
    if (!deviceId || submitting) return;

    // Latch the choice before the request leaves: on a slow network this
    // is the difference between a control that answers and one that looks
    // broken until the response lands.
    setSubmitting(level);
    setNotice(null);
    setRetryable(null);
    buzz(12);

    try {
      // A hard timeout, because the peths have no working network at peak
      // and fetch on its own will wait for minutes. Without this the
      // button sits on "sending" and the report looks lost with nothing to
      // tap — which is exactly how it behaved on the ground.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

      const response = await fetch(`/api/crowd/${mandalId}/report`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          status: level,
          // A fresh key per attempt. The retry that must not duplicate is
          // the network's, and fetch does not silently replay a POST.
          requestId: newRequestId(),
          atMandal,
        }),
      }).finally(() => clearTimeout(timeout));

      const result = (await response.json()) as CrowdSubmitResult & {
        crowd?: CrowdStatus | null;
      };

      if (result.success) {
        trackEvent('crowd_reported', { props: { status: level } });
        setReported(level);
        setConfirming(true);
        noteCooldown(mandalId, 3600);
        if (result.crowd) applyCrowdStatus(result.crowd);
        else void refreshCrowd();
        onReported?.();
        return;
      }

      trackEvent('crowd_report_rejected', { props: { reason: result.reason } });

      switch (result.reason) {
        case 'cooldown':
          // The server knows better than we did; adopt its number.
          noteCooldown(mandalId, result.retryAfter);
          setNotice('You already reported this mandal recently.');
          break;
        case 'rate_limited':
          setNotice('Too many reports just now. Try again in a few minutes.');
          break;
        case 'reporting_disabled':
          setNotice('Reporting is turned off for this mandal.');
          break;
        case 'unavailable':
          // Transient by definition, so this one earns a retry button
          // rather than a sentence the user can only re-read.
          setNotice('Crowd reporting is temporarily unavailable.');
          setRetryable(level);
          break;
        case 'invalid_request':
          // The server refused this device's id. Retrying with the same
          // one fails identically every time, so replace it — otherwise
          // reporting is permanently dead on this device with no way for
          // the user to discover why.
          resetDeviceId();
          setNotice('Something was wrong with this device.');
          setRetryable(level);
          break;
        default:
          setNotice('Could not send that report.');
          setRetryable(level);
      }
    } catch (err) {
      // A timeout and a dead connection need different words: one is "wait
      // and press again", the other is "you have no network at all", and
      // telling someone in a crowded lane they are offline when they are
      // not is how a working feature gets abandoned.
      const timedOut = err instanceof DOMException && err.name === 'AbortError';
      setNotice(
        timedOut
          ? 'The network here is slow and the report did not go through. Tap to try again.'
          : 'You appear to be offline. Your report was not sent.'
      );
      setRetryable(level);
    } finally {
      setSubmitting(null);
    }
  }

  /* ---------------- Thank-you (transient) ---------------- */

  if (confirming) {
    const level = reported;
    return (
      <div className={compact ? '' : 'mt-1'} role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--chandan)]">
          <Check size={15} aria-hidden="true" style={{ color: level ? CROWD_COLOR[level] : undefined }} />
          Thanks 🙏
        </p>
        {!compact && (
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Your report helps other devotees decide where to go.
          </p>
        )}
        {blocked && (
          <p className="mt-1 text-[12px] text-[var(--faint)]">
            You can report it again {remainingText(remainingS)}.
          </p>
        )}

        {/* "30+ min" is the one answer that leaves a question open.
            Short and Moving are complete: there is nothing more to say
            about a queue you walked into. "30+" is an open interval, and
            the difference between half an hour and two hours decides
            whether somebody comes at all — while the app's own catalogue
            figures for these mandals were estimated, never timed.

            The person who just tapped it is the only person who knows,
            and they are holding the phone. So the finer buckets are
            offered here rather than waiting for the prompt that fires
            after they leave, which they may never see.

            Only the buckets at or above 30: offering 5 min to somebody
            who just said 30+ lets them contradict themselves in one
            breath. A wait report is worth 1.5x a colour, so this is also
            the strongest signal in the app, asked at the one moment it is
            easy to answer. */}
        {reported === 'long' && !waitAnswered && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <WaitReportButtons
              mandalId={mandalId}
              minMinutes={30}
              prompt="Roughly how long? It is the most useful thing you can add."
              onDone={() => setWaitAnswered(true)}
            />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- The row ---------------- */

  const rowDisabled = submitting !== null || blocked;

  /**
   * Not close enough, or we cannot tell. The controls are not rendered.
   *
   * Each case says something different and is worth saying: a refusal
   * without a reason reads as the app being broken, and "turn on location"
   * is only useful advice in one of them.
   */
  if (eligibility.kind !== 'allowed') {
    return (
      <ReportGateNotice
        eligibility={eligibility}
        subject="queue"
        onRequestLocation={requestLocation}
        compact={compact}
      />
    );
  }

  return (
    <div>
      {!compact && (
        <p className="text-[14px] font-semibold text-[var(--chandan)]">
          How&rsquo;s the crowd?
        </p>
      )}

      <div className={cn('grid grid-cols-3 gap-2', compact ? 'mt-0' : 'mt-2.5')}>
        {OPTIONS.map((option) => {
          const isMine = reported === option.level;
          const isSending = submitting === option.level;

          return (
            <button
              key={option.level}
              type="button"
              onClick={() => void submit(option.level)}
              disabled={rowDisabled}
              // `aria-pressed` rather than a visual-only outline: a screen
              // reader user must also be able to tell which one they chose.
              aria-pressed={isMine}
              aria-label={`Report ${option.label} crowd`}
              className={cn(
                'flex min-h-11 flex-col items-center justify-center rounded-[var(--radius-field)]',
                'border px-2 text-[13px] font-semibold',
                'transition-[transform,background-color,opacity] active:scale-[0.97]',
                // A disabled row still has to read as "not now", not as
                // "broken" — the countdown line below says why.
                'disabled:opacity-45',
                compact ? 'py-1.5' : 'py-2'
              )}
              style={{
                color: CROWD_COLOR[option.level],
                borderColor: isMine
                  ? CROWD_COLOR[option.level]
                  : `color-mix(in srgb, ${CROWD_COLOR[option.level]} 38%, transparent)`,
                background: `color-mix(in srgb, ${CROWD_COLOR[option.level]} ${isMine ? 20 : 10}%, transparent)`,
              }}
            >
              {/* `whitespace-nowrap`: at 320px "30+ min" otherwise breaks
                  across two lines, which makes the three targets different
                  heights and shoves the hint out of the button. */}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {isSending ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <CrowdDot level={option.level} size={9} />
                )}
                {option.label}
              </span>

              {/* The hint used to live in `title`, which never appears on a
                  touch device — i.e. it was invisible to almost everyone
                  the app is built for. */}
              {!compact && (
                <span className="mt-0.5 text-[11px] font-normal leading-tight text-[var(--muted)]">
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {blocked && (
        <p className="mt-2 text-[12px] text-[var(--faint)]">
          {reported
            ? `You reported this mandal — you can report it again ${remainingText(remainingS)}.`
            : `You reported this mandal recently — you can report it again ${remainingText(remainingS)}.`}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--zendu)]">
          {notice}
          {retryable && (
            <button
              type="button"
              onClick={() => void submit(retryable)}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Try again
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Off while `features.crowd` is false.
 *
 * A wrapper rather than an early return inside CrowdReportButtonsInner: that
 * component calls hooks, and returning before them changes hook order,
 * which React forbids. Not mounting it at all is both legal and the
 * thing actually wanted — no request is made and no state is kept.
 */
export function CrowdReportButtons(props: Parameters<typeof CrowdReportButtonsInner>[0]) {
  if (!features.crowd) return null;
  return <CrowdReportButtonsInner {...props} />;
}
