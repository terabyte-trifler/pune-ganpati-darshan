'use client';

import { useState, useTransition } from 'react';
import { Ban, Loader2, Undo2 } from 'lucide-react';
import {
  blockDeviceAction,
  toggleMandalReportingAction,
  unblockDeviceAction,
} from './actions';
import { cn } from '@/lib/utils';

/**
 * Crowd moderation controls.
 *
 * Thin wrappers over Server Actions. They show the outcome inline rather
 * than optimistically, because these are consequential: an admin needs to
 * know a block actually landed, not that a button changed colour.
 */

export function MandalReportingToggle({
  mandalId,
  enabled,
}: {
  mandalId: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-[12px] text-[var(--kumkum)]">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const next = !on;
            const result = await toggleMandalReportingAction(mandalId, next);
            if (result.ok) setOn(next);
            else setError(result.error);
          })
        }
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold',
          on
            ? 'border-[var(--tulsi)]/40 bg-[var(--tulsi)]/12 text-[var(--tulsi)]'
            : 'border-[var(--line-strong)] text-[var(--faint)]'
        )}
        aria-pressed={on}
      >
        {pending && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
        {on ? 'Reporting on' : 'Reporting off'}
      </button>
    </div>
  );
}

export function DeviceBlockControls({
  deviceId,
  digest,
  blocked = false,
}: {
  deviceId: string;
  digest?: string;
  blocked?: boolean;
}) {
  const [isBlocked, setIsBlocked] = useState(blocked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-[12px] text-[var(--kumkum)]">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = isBlocked
              ? await unblockDeviceAction(deviceId)
              : await blockDeviceAction(
                  deviceId,
                  `Flagged pattern${digest ? ` (${digest})` : ''}`
                );
            if (result.ok) setIsBlocked(!isBlocked);
            else setError(result.error);
          })
        }
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold',
          isBlocked
            ? 'border-[var(--line-strong)] text-[var(--faint)]'
            : 'border-[var(--kumkum)]/50 text-[var(--kumkum)]'
        )}
      >
        {pending ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : isBlocked ? (
          <Undo2 size={13} aria-hidden="true" />
        ) : (
          <Ban size={13} aria-hidden="true" />
        )}
        {isBlocked ? 'Unblock' : 'Block 7 days'}
      </button>
    </div>
  );
}
