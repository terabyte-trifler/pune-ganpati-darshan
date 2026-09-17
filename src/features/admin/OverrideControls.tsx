'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X, Clock } from 'lucide-react';
import { CROWD_COLOR, CrowdDot } from '@/features/crowd/CrowdBadge';
import { useClockMs } from '@/features/crowd/useCrowd';
import { cn } from '@/lib/utils';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Three buttons and a clear, for one mandal.
 *
 * Deliberately the same three words and colours a visitor sees, because
 * the admin is asserting the same thing they are — not operating a
 * separate machine with its own vocabulary.
 *
 * The cooldown is shown rather than enforced here: the database decides,
 * and a client that thinks it knows better gets a 429 and says so.
 */

const LEVELS: { level: CrowdLevel; label: string }[] = [
  { level: 'short', label: 'Short' },
  { level: 'moving', label: 'Moving' },
  { level: 'long', label: '30+ min' },
];

/**
 * Minutes an admin can assert, same buckets a visitor is offered plus the
 * two that only Dagdusheth-scale queues need.
 *
 * Coarse on purpose: nobody standing in a peth times a queue to the
 * minute, and a free-text box would invite a precision the observation
 * does not have.
 */
const WAIT_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 150] as const;

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function OverrideControls({
  mandalId,
  active,
  cooldownSeconds,
}: {
  mandalId: string;
  active: { status: CrowdLevel; expiresAt: string; waitMinutes?: number | null } | null;
  cooldownSeconds: number;
}) {
  const router = useRouter();
  // Shared 30-second clock rather than a timer per row. The hold is half
  // an hour, so minute resolution is all this needs, and reading the time
  // during render is what useSyncExternalStore exists to avoid.
  const nowMs = useClockMs();
  const [busy, setBusy] = useState<CrowdLevel | 'clear' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Minutes to assert alongside the colour, or '' to leave the model to it.
   *
   * Empty is the default and means exactly what an override meant before
   * this existed: the colour is asserted and the minutes are worked out
   * from the mandal's own bounds. It is not zero — zero is a real claim,
   * that there is no queue at all.
   */
  const [waitMinutes, setWaitMinutes] = useState<string>(
    active?.waitMinutes != null ? String(active.waitMinutes) : ''
  );

  async function send(status: CrowdLevel | null) {
    setBusy(status ?? 'clear');
    setNotice(null);
    try {
      const response = await fetch('/api/admin/crowd-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandalId,
          status,
          // Only sent when setting, and only when a figure was chosen.
          ...(status !== null && waitMinutes !== ''
            ? { waitMinutes: Number(waitMinutes) }
            : {}),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        reason?: string;
        retryAfter?: number;
      };
      if (result.success) {
        // The page reads the overrides server-side, so a refresh is the
        // honest way to show what actually landed rather than guessing.
        router.refresh();
        return;
      }
      // Say which failure it was. "Could not set that" is the same
      // message whether the database is unreachable, the migration has
      // not been run, or the id is wrong — and on an admin screen the
      // difference is the whole point.
      setNotice(
        result.reason === 'cooldown'
          ? `Cooldown — ${mmss(result.retryAfter ?? 0)} left`
          : result.reason === 'unavailable'
            ? 'Database unreachable, or the override migration has not been run'
            : result.reason === 'invalid_request'
              ? 'Unknown mandal, or an invalid level'
              : response.status === 404
                ? 'Not signed in as an admin — the session may have expired'
                : `Failed (${response.status})`
      );
    } catch {
      setNotice('Network error');
    } finally {
      setBusy(null);
    }
  }

  const locked = cooldownSeconds > 0;
  const heldMinutes =
    active && nowMs !== null
      ? Math.max(0, Math.round((Date.parse(active.expiresAt) - nowMs) / 60_000))
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Chosen BEFORE the level, because tapping a level is what sends.
          Disabled during the cooldown for the same reason the buttons
          are: nothing can be asserted until the hold expires. */}
      <label className="inline-flex items-center gap-1 text-[11.5px] text-[var(--faint)]">
        <Clock size={11} aria-hidden="true" />
        <select
          value={waitMinutes}
          onChange={(e) => setWaitMinutes(e.target.value)}
          disabled={busy !== null || locked}
          aria-label="Wait to show, in minutes"
          className={cn(
            'min-h-9 rounded-[var(--radius-chip)] border border-[var(--line-strong)]',
            'bg-transparent px-2 text-[12px] font-semibold text-[var(--chandan)]',
            'disabled:opacity-40'
          )}
        >
          <option value="">from the model</option>
          {WAIT_CHOICES.map((m) => (
            <option key={m} value={m}>{m} min</option>
          ))}
        </select>
      </label>

      {LEVELS.map(({ level, label }) => {
        const isActive = active?.status === level;
        return (
          <button
            key={level}
            type="button"
            disabled={busy !== null || (locked && !isActive)}
            onClick={() => void send(level)}
            className={cn(
              'inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-chip)] border px-2.5',
              'text-[12px] font-semibold transition-colors disabled:opacity-40'
            )}
            style={{
              color: CROWD_COLOR[level],
              borderColor: isActive
                ? CROWD_COLOR[level]
                : `color-mix(in srgb, ${CROWD_COLOR[level]} 35%, transparent)`,
              background: isActive
                ? `color-mix(in srgb, ${CROWD_COLOR[level]} 18%, transparent)`
                : 'transparent',
            }}
          >
            {busy === level ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : isActive ? (
              <Check size={12} aria-hidden="true" />
            ) : (
              <CrowdDot level={level} size={8} />
            )}
            {label}
          </button>
        );
      })}

      {active && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void send(null)}
          className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-2.5 text-[12px] font-semibold text-[var(--muted)] disabled:opacity-40"
        >
          {busy === 'clear' ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <X size={12} aria-hidden="true" />
          )}
          Clear
        </button>
      )}

      {heldMinutes !== null && (
        <span className="text-[11px] text-[var(--faint)]">
          {heldMinutes === 0 ? 'expiring' : `expires in ${heldMinutes} min`}
        </span>
      )}

      {locked && !active && (
        <span className="text-[11px] text-[var(--faint)]">
          cooldown {mmss(cooldownSeconds)}
        </span>
      )}
      {notice && <span className="text-[11px] text-[var(--zendu)]">{notice}</span>}
    </div>
  );
}
