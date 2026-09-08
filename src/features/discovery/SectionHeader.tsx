import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function SectionHeader({
  title, titleMr, href, hrefLabel = 'See all',
}: {
  title: string;
  titleMr?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 px-4">
      <div className="min-w-0">
        <h2 className="font-display text-[20px] font-bold text-[var(--chandan)]">
          {title}
        </h2>
        {titleMr && (
          <p lang="mr" className="text-[12px] text-[var(--muted)]">{titleMr}</p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          // -mr-2 keeps the visual edge aligned while the tap area extends
          // to the full 44px minimum.
          className="-mr-2 flex min-h-11 shrink-0 items-center gap-0.5 px-2 py-2 text-[13px] font-medium text-[var(--shendur)]"
        >
          {hrefLabel}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
