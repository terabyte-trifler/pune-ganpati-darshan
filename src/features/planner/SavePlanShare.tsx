'use client';

import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { TravelMode } from '@/types/ganpati';

/**
 * Shares a plan, preferring a durable link.
 *
 * Tries to persist the plan and share a short /plan/<id> URL. If storage is
 * unavailable — Supabase unconfigured, offline, rate-limited — it falls back
 * to the stateless /plan?stops=... form, which carries the route in the URL
 * itself and therefore always works.
 *
 * Both produce a link that genuinely opens the route; the difference is
 * durability and length, not whether it functions.
 */
export function SavePlanShare({
  slugs, mode, className,
}: {
  slugs: string[];
  mode: TravelMode;
  className?: string;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'copied'>('idle');

  const statelessPath = `/plan?stops=${slugs.join(',')}`;

  const share = async () => {
    if (slugs.length === 0) return;
    setState('saving');

    let path = statelessPath;
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs, mode, title: 'My Darshan' }),
      });
      if (response.ok) {
        const { shareId } = (await response.json()) as { shareId: string };
        path = `/plan/${shareId}`;
      }
    } catch {
      // Keep the stateless link; the share must still work.
    }

    const url = `${window.location.origin}${path}`;
    trackEvent('share_clicked', {
      props: { kind: path.startsWith('/plan/') ? 'saved' : 'stateless', stops: slugs.length },
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Ganpati darshan route', url });
        setState('idle');
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') { setState('idle'); return; }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 2200);
    } catch {
      window.prompt('Copy this link', url);
      setState('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      disabled={state === 'saving' || slugs.length === 0}
      aria-label="Share this darshan"
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full',
        'border border-[var(--line-strong)] bg-[var(--dhoop)]',
        'transition-colors duration-150 active:scale-[0.95] disabled:opacity-50',
        className
      )}
    >
      {state === 'saving' ? (
        <Loader2 size={18} aria-hidden="true" className="animate-spin text-[var(--muted)]" />
      ) : state === 'copied' ? (
        <Check size={18} aria-hidden="true" className="text-[var(--tulsi)]" />
      ) : (
        <Share2 size={18} aria-hidden="true" className="text-[var(--muted)]" />
      )}
      <span className="sr-only">
        {state === 'copied' ? 'Link copied' : 'Share this darshan'}
      </span>
    </button>
  );
}
