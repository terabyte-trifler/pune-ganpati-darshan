'use client';

import { cn } from '@/lib/utils';

/**
 * Filter chip. Selection is conveyed by background, border AND an
 * `aria-pressed` state — never by colour alone (§37).
 */
export function Chip({
  children, selected = false, className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-medium',
        'transition-colors duration-150 active:scale-[0.97]',
        'scroll-ml-4 [scroll-snap-align:start]',
        selected
          ? 'border-[var(--shendur)] bg-[var(--shendur)] text-[#1a0e04]'
          : 'border-[var(--line-strong)] bg-[var(--dhoop)] text-[var(--muted)] hover:text-[var(--chandan)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
