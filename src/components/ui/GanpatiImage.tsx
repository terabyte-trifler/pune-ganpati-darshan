import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Ganpati } from '@/types/ganpati';

/**
 * Image with a designed fallback.
 *
 * The seed carries no photographs — we do not have rights to real mandal
 * images, and inventing them would misrepresent the mandals. Rather than a
 * grey box, the fallback renders a warm gradient keyed to the mandal's name
 * with its initial, so an image-less catalogue still looks composed (§36).
 *
 * Production images drop in through `ganpati_images` with no UI change.
 */

/** Deterministic hue from the slug, kept in the festival's warm band. */
function hueFor(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return 18 + (h % 40); // 18°–58°: vermilion → marigold
}

export function GanpatiImage({
  ganpati, className, sizes, priority = false,
}: {
  ganpati: Pick<Ganpati, 'slug' | 'name' | 'images'>;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const image = ganpati.images.find((i) => i.isPrimary) ?? ganpati.images[0];

  if (image) {
    return (
      <Image
        src={image.url}
        alt={image.alt ?? ganpati.name}
        fill
        sizes={sizes ?? '(max-width: 768px) 50vw, 320px'}
        priority={priority}
        placeholder={image.blurDataUrl ? 'blur' : 'empty'}
        blurDataURL={image.blurDataUrl ?? undefined}
        className={cn('object-cover', className)}
      />
    );
  }

  const hue = hueFor(ganpati.slug);
  return (
    <div
      role="img"
      aria-label={ganpati.name}
      className={cn('relative grid h-full w-full place-items-center overflow-hidden', className)}
      style={{
        background:
          `radial-gradient(120% 100% at 30% 0%, hsl(${hue} 62% 26%) 0%, hsl(${hue - 8} 45% 12%) 60%, var(--dhoop) 100%)`,
      }}
    >
      {/* Concentric arcs echoing a mandal's decorative arch */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="0.6" className="text-[var(--zendu)]">
          <circle cx="50" cy="42" r="16" />
          <circle cx="50" cy="42" r="24" />
          <circle cx="50" cy="42" r="32" />
          <path d="M18 42a32 32 0 0 1 64 0" strokeWidth="1" />
        </g>
      </svg>
      <span
        aria-hidden="true"
        className="relative font-semibold text-[var(--zendu)]/70"
        style={{ fontSize: 'clamp(24px, 14cqw, 44px)' }}
      >
        {ganpati.name.replace(/^(Shri|Shrimant)\s+/i, '').charAt(0)}
      </span>
    </div>
  );
}
