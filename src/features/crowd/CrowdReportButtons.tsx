'use client';

import { useState, useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { getDeviceId, newRequestId } from './device';
import { applyCrowdStatus, refreshCrowd } from './crowd-store';
import {
  getCooldownState,
  getServerCooldownState,
  noteCooldown,
  subscribeToCooldowns,
} from './cooldown-store';
import { useClockMs } from './useCrowd';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { CrowdLevel, CrowdStatus, CrowdSubmitResult } from '@/types/crowd';

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
 */

const OPTIONS: { level: CrowdLevel; label: string; hint: string }[] = [
  { level: 'short', label: 'Short', hint: 'Straight in, barely a queue' },
  { level: 'moving', label: 'Moving', hint: 'A queue, but it keeps moving' },
  { level: 'long', label: '30+ min', hint: 'Heavy — a long wait' },
];

export function useCooldownExpiry(mandalId: string): number | null {
  const cooldowns = useSyncExternalStore(
    subscribeToCooldowns,
    getCooldownState,
    getServerCooldownState
  );
  return cooldowns[mandalId] ?? null;
}

export function CrowdReportButtons({
  mandalId,
  compact = false,
  onReported,
}: {
  mandalId: string;
  compact?: boolean;
  onReported?: () => void;
}) {
  const [submitting, setSubmitting] = useState<CrowdLevel | null>(null);
  const [thanks, setThanks] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
          // A fresh key per attempt. The retry that must not duplicate is
          // the network's, and fetch does not silently replay a POST.
          requestId: newRequestId(),
        }),
      });

      const result = (await response.json()) as CrowdSubmitResult & {
        crowd?: CrowdStatus | null;
      };

      if (result.success) {
        trackEvent('crowd_reported', { props: { status: level } });
        setThanks(true);
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
        default:
          setNotice('Could not send that report. Try again shortly.');
      }
    } catch {
      setNotice('You appear to be offline. Your report was not sent.');
    } finally {
      setSubmitting(null);
    }
  }

  if (thanks) {
    return (
      <div className={compact ? '' : 'mt-1'}>
        <p className="text-[14px] font-semibold text-[var(--chandan)]">Thanks 🙏</p>
        {!compact && (
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Your report helps other devotees decide where to go.
          </p>
        )}
      </div>
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
        {OPTIONS.map((option) => (
          <button
            key={option.level}
            type="button"
            onClick={() => void submit(option.level)}
            disabled={submitting !== null || blocked}
            title={option.hint}
            aria-label={`Report ${option.label} crowd`}
            className={cn(
              'flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-field)]',
              'border px-2 text-[13px] font-semibold',
              'transition-[transform,background-color] active:scale-[0.97]',
              'disabled:opacity-45',
              compact ? 'flex-row py-1.5' : 'flex-col py-2'
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

      {blocked && (
        <p className="mt-2 text-[12px] text-[var(--faint)]">
          You reported this mandal recently — you can report it again in{' '}
          {Math.max(1, Math.ceil(remainingS / 60))} min.
        </p>
      )}

      {notice && (
        <p role="status" className="mt-2 text-[12px] text-[var(--zendu)]">
          {notice}
        </p>
      )}
    </div>
  );
}
