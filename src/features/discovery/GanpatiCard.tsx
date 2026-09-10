import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { CategoryBadge, TempleBadge } from '@/components/ui/Badge';
import { CrowdBadge } from '@/features/crowd/CrowdBadge';
import { GanpatiImage } from '@/components/ui/GanpatiImage';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { Ganpati } from '@/types/ganpati';

/**
 * Mandal card.
 *
 * `compact` is the horizontal-rail variant; the default is the grid variant.
 * Both keep the tap target at the whole card and stay legible at 320px (§63).
 */
export function GanpatiCard({
  ganpati, distanceM, compact = false, priority = false, className,
}: {
  ganpati: Ganpati;
  distanceM?: number | null;
  compact?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/ganpati/${ganpati.slug}`}
      prefetch={false}
      className={cn(
        'surface group relative flex flex-col overflow-hidden rounded-[var(--radius-card)]',
        'border border-[var(--line)]',
        'transition-[transform,box-shadow] duration-200',
        'hover:-translate-y-0.5 hover:shadow-[var(--lift-3)] active:scale-[0.985]',
        compact && 'w-[172px] shrink-0 [scroll-snap-align:start]',
        className
      )}
    >
      <div
        className={cn('relative w-full overflow-hidden', compact ? 'aspect-[4/3]' : 'aspect-[16/10]')}
        style={{ containerType: 'inline-size' }}
      >
        <GanpatiImage
          ganpati={ganpati}
          priority={priority}
          sizes={compact ? '172px' : '(max-width: 768px) 50vw, 320px'}
        />
        {/* Scrim so the badge stays readable over a bright photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[var(--raat)]/55 to-transparent"
        />
        <div className="absolute left-2 top-2">
          <CategoryBadge category={ganpati.category} rank={ganpati.manacheRank} />
          {ganpati.isTemple && <TempleBadge />}
        </div>
        {/* Renders nothing until someone has actually reported, so a quiet
            mandal shows no badge rather than a reassuring one. */}
        <div className="absolute right-2 top-2">
          <CrowdBadge mandalId={ganpati.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="clamp-2 text-[14px] font-semibold leading-tight text-[var(--chandan)]">
          {ganpati.name}
        </h3>
        {ganpati.nameMr && (
          <p lang="mr" className="clamp-2 text-[12px] leading-tight text-[var(--muted)]">
            {ganpati.nameMr}
          </p>
        )}
        <div className="mt-auto flex items-center gap-1 pt-1.5 text-[12px] text-[var(--faint)]">
          <MapPin size={12} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{ganpati.area.name}</span>
          {typeof distanceM === 'number' && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 font-medium text-[var(--zendu)]">
                {formatDistance(distanceM)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
