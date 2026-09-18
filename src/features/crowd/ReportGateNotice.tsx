'use client';

import { MapPin } from 'lucide-react';
import { retryLocation } from '@/hooks/useGeolocation';
import { formatDistance } from '@/lib/geo';
import { REPORT_MAX_DISTANCE_M, type ReportEligibility } from './report-eligibility';
import { trackEvent } from '@/services/analytics';

/**
 * Why the report controls are not there.
 *
 * Each case says something different and each is worth saying: a refusal
 * without a reason reads as the app being broken, and "turn on location"
 * is only useful advice in one of them.
 *
 * Shared by the colour buttons and the wait buckets. The two ask for
 * different things, so the sentence names what is being refused — being
 * told "reports come from people near the mandal" when you were trying to
 * say how long you queued is an answer to a question nobody asked.
 */

export type GateSubject = 'queue' | 'wait';

const COPY: Record<GateSubject, { denied: string; tooFar: (d: string) => string; enable: string }> = {
  queue: {
    denied:
      'Location is off, so we can’t tell how far away you are. Reports come from people near the mandal.',
    tooFar: (d) =>
      `You’re ${d} away. Reports come from people within ${formatDistance(REPORT_MAX_DISTANCE_M)} — the queue is only worth reporting if you can see it.`,
    enable: 'Turn on location to report the queue',
  },
  wait: {
    denied:
      'Location is off, so we can’t tell whether you were in this queue. Wait times come from people at the mandal.',
    tooFar: (d) =>
      `You’re ${d} away. Wait times come from people within ${formatDistance(REPORT_MAX_DISTANCE_M)} — only the queue you actually stood in.`,
    enable: 'Turn on location to add your wait',
  },
};

export function ReportGateNotice({
  eligibility,
  subject,
  onRequestLocation,
  compact = false,
}: {
  /** Anything but `allowed`; an allowed gate renders its own controls. */
  eligibility: Exclude<ReportEligibility, { kind: 'allowed' }>;
  subject: GateSubject;
  /** From `useReportGate`, so the permission dialog is opened by a tap. */
  onRequestLocation: () => void;
  compact?: boolean;
}) {
  const copy = COPY[subject];

  const message = (() => {
    switch (eligibility.kind) {
      case 'locating':
        return 'Finding you…';
      case 'needs-location':
        return null; // rendered as an action below, not a sentence
      case 'no-location':
        return eligibility.reason === 'denied'
          ? copy.denied
          : 'We couldn’t get your location, so we can’t tell how far away you are.';
      case 'refining':
        return 'Getting a more precise location — the first fix was too rough to tell how far away you are.';
      case 'too-far':
        return copy.tooFar(formatDistance(eligibility.distanceM));
      case 'unknown-mandal':
        return 'We don’t have a position for this mandal, so reports can’t be placed.';
    }
  })();

  return (
    <div className={compact ? '' : 'mt-2.5'}>
      {eligibility.kind === 'needs-location' ? (
        <button
          type="button"
          onClick={() => { trackEvent('location_enabled'); onRequestLocation(); }}
          className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
        >
          <MapPin size={14} aria-hidden="true" />
          {copy.enable}
        </button>
      ) : eligibility.kind === 'no-location' && eligibility.reason === 'unavailable' ? (
        /* A fix that failed rather than a permission that was refused.
           It retries on its own a few times, but a person standing in a
           lane should not have to wait for that — or reload the page,
           which is what they were doing before this existed. */
        <>
          <p className="text-[12px] leading-relaxed text-[var(--muted)]">
            Still finding your location — the lanes here block GPS.
          </p>
          <button
            type="button"
            onClick={() => retryLocation()}
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
          >
            <MapPin size={14} aria-hidden="true" />
            Try again
          </button>
        </>
      ) : (
        <p className="text-[12px] leading-relaxed text-[var(--muted)]">{message}</p>
      )}
    </div>
  );
}
