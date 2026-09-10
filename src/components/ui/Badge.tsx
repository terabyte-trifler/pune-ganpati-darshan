import { cn } from '@/lib/utils';
import type { DataConfidence, GanpatiCategory } from '@/types/ganpati';

const CATEGORY_LABEL: Record<GanpatiCategory, string> = {
  maanache: 'Manache Paach',
  famous: 'Famous',
  historic: 'Historic',
  local: 'Neighbourhood',
};

/**
 * Brass is reserved for the Manache Paach and used nowhere else.
 *
 * The background is a near-opaque dark ground rather than a tint of the
 * accent colour: these badges sit over photographs as well as over the dark
 * generated placeholders, and a translucent tint became unreadable the moment
 * real photos landed behind it (a bright temple facade behind brass text).
 * A dark ground keeps the accent legible on anything.
 */
const CATEGORY_CLASS: Record<GanpatiCategory, string> = {
  maanache: 'bg-[var(--raat)]/93 text-[var(--pital)] border-[var(--pital)]/50',
  // Vermilion is the darkest of the accents and the only one that failed
  // 4.5:1 over a white photograph at 0.85 opacity (3.54). Raising the ground
  // to 0.93 clears it at 4.58 without lightening the brand colour itself.
  famous: 'bg-[var(--raat)]/93 text-[var(--shendur)] border-[var(--shendur)]/50',
  historic: 'bg-[var(--raat)]/93 text-[var(--zendu)] border-[var(--zendu)]/45',
  local: 'bg-[var(--raat)]/93 text-[var(--chandan)] border-[var(--line-strong)]',
};

export function CategoryBadge({
  category, rank, className,
}: { category: GanpatiCategory; rank?: number | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[12px] font-semibold leading-5 backdrop-blur-sm',
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
 * Marks a year-round temple rather than a festival pandal.
 *
 * Worth a badge because the difference changes what someone is going to
 * see. A pandal is put up by a mandal for the ten days — the mandap, the
 * dekhava, the lights — and Sarasbaug and Trishund have none of that; they
 * are temples that are open every day of the year and happen to be
 * Ganpati temples. Listing them beside the pandals without saying so
 * misdescribes the visit.
 *
 * Deliberately quiet: an outline in the muted ink rather than one of the
 * accents. It is a note about what the place is, not a recommendation
 * against it — Sarasbaug is one of the busiest Ganpati destinations in
 * Pune during the festival.
 */
export function TempleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'text-[12px] font-semibold leading-5 backdrop-blur-sm',
        'border-[var(--line-strong)] bg-[var(--raat)]/93 text-[var(--muted)]',
        className
      )}
      title="A year-round temple, not a festival pandal"
    >
      Temple
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
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--tulsi)]">
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
      <span className="inline-flex items-center rounded border border-[var(--kumkum)]/40 bg-[var(--kumkum)]/10 px-1.5 text-[12px] font-medium text-[#ef8f88]">
        Demo data
      </span>
    );
  }
  return (
    <span className="text-[12px] font-medium text-[var(--faint)]">
      Community info
    </span>
  );
}

export { CATEGORY_LABEL };
