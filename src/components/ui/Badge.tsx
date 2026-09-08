import { cn } from '@/lib/utils';
import type { DataConfidence, GanpatiCategory } from '@/types/ganpati';

const CATEGORY_LABEL: Record<GanpatiCategory, string> = {
  maanache: 'Manache Paach',
  famous: 'Famous',
  historic: 'Historic',
  local: 'Neighbourhood',
};

/** Brass is reserved for the Manache Paach and used nowhere else. */
const CATEGORY_CLASS: Record<GanpatiCategory, string> = {
  maanache: 'bg-[var(--pital)]/15 text-[var(--pital)] border-[var(--pital)]/35',
  famous: 'bg-[var(--shendur)]/15 text-[var(--shendur)] border-[var(--shendur)]/35',
  historic: 'bg-[var(--zendu)]/12 text-[var(--zendu)] border-[var(--zendu)]/30',
  local: 'bg-white/5 text-[var(--muted)] border-[var(--line-strong)]',
};

export function CategoryBadge({
  category, rank, className,
}: { category: GanpatiCategory; rank?: number | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[11px] font-semibold leading-5',
        CATEGORY_CLASS[category],
        className
      )}
    >
      {category === 'maanache' && rank ? `#${rank} · ` : ''}
      {CATEGORY_LABEL[category]}
    </span>
  );
}

/**
 * Data provenance. Shown so a visitor knows which claims are checked before
 * crossing the city on them (§41).
 */
export function ConfidenceBadge({ confidence }: { confidence: DataConfidence }) {
  if (confidence === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--tulsi)]">
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 1.5 9.9 3l2.4-.2.6 2.3 1.8 1.6-1.2 2.1.4 2.4-2.3.8L10.2 14 8 13l-2.2 1-1.4-2-2.3-.8.4-2.4L1.3 6.7l1.8-1.6.6-2.3L6.1 3 8 1.5Z" opacity=".25" />
          <path d="m5.6 8.2 1.6 1.6 3.4-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
      </span>
    );
  }
  if (confidence === 'demo') {
    return (
      <span className="inline-flex items-center rounded border border-[var(--kumkum)]/40 bg-[var(--kumkum)]/10 px-1.5 text-[11px] font-medium text-[#ef8f88]">
        Demo data
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-[var(--faint)]">
      Community info
    </span>
  );
}

export { CATEGORY_LABEL };
