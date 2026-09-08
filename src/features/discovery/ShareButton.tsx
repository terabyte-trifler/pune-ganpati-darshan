'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';

/**
 * Share via the Web Share API, falling back to clipboard.
 *
 * Both paths are real: no button here does nothing (§61). If neither is
 * available (rare, non-secure context) the control is not rendered at all.
 */
export function ShareButton({
  title, text, path, className,
}: {
  title: string;
  text?: string;
  path: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}${path}`;
    trackEvent('share_clicked', { props: { path } });

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // AbortError = user dismissed the sheet; fall through to copy only
        // for genuine failures.
        if ((error as Error)?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — surface the URL so the user can copy manually.
      window.prompt('Copy this link', url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${title}`}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full',
        'border border-[var(--line-strong)] bg-[var(--dhoop)]',
        'transition-colors duration-150 active:scale-[0.95]',
        className
      )}
    >
      {copied ? (
        <Check size={18} aria-hidden="true" className="text-[var(--tulsi)]" />
      ) : (
        <Share2 size={18} aria-hidden="true" className="text-[var(--muted)]" />
      )}
      <span className="sr-only">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
