'use client';

import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';

/**
 * Save toggle.
 *
 * Anonymous users are first-class: favourites live in localStorage and work
 * with no account and no network (§20). Sign-in later syncs them to the
 * `favorites` table; nothing here blocks on auth.
 *
 * The pop on toggle is a CSS keyframe rather than AnimatePresence — this
 * button appears on every card and detail page, and it is not worth pulling
 * an animation runtime into those bundles for a 180ms scale.
 */
export function SaveButton({
  slug, name, variant = 'icon', className,
}: {
  slug: string;
  name: string;
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const { has, toggle, hydrated } = useFavorites();
  const saved = hydrated && has(slug);

  const handleClick = () => {
    const nowSaved = toggle(slug);
    trackEvent(nowSaved ? 'favorite_added' : 'favorite_removed', { props: { slug } });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full',
        'border border-[var(--line-strong)] bg-[var(--dhoop)]',
        'transition-colors duration-150 active:scale-[0.95]',
        variant === 'icon' ? 'h-11 w-11' : 'h-12 px-5 text-[15px] font-semibold',
        saved && 'border-[var(--kumkum)]/50 bg-[var(--kumkum)]/12',
        className
      )}
    >
      <Heart
        size={variant === 'icon' ? 19 : 17}
        aria-hidden="true"
        // `key` remounts the icon on toggle so the pop keyframe replays.
        key={saved ? 'on' : 'off'}
        className={cn(
          saved ? 'text-[#ef8f88] animate-heart-pop' : 'text-[var(--muted)]'
        )}
        fill={saved ? 'currentColor' : 'none'}
      />
      {variant === 'full' && (
        <span className={saved ? 'text-[#ef8f88]' : 'text-[var(--chandan)]'}>
          {saved ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}
