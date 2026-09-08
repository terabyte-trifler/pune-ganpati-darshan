import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Shown when the map cannot render.
 *
 * With OpenFreeMap there is no API key to misconfigure, so the only real
 * cause is the tile service or style being unreachable. This is deliberately
 * NOT a decorative fake map (§12): it says what is wrong and routes the user
 * to the parts of the product that still work, because the whole catalogue
 * is usable without the map (§35).
 */
export function MapUnavailable() {
  return (
    /* Centred in the space above the sheet, not the whole viewport, so the
       message is never clipped by it. */
    <div className="absolute inset-x-0 top-0 bottom-[48dvh] grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)]">
          <MapPinOff size={24} aria-hidden="true" className="text-[var(--muted)]" />
        </div>

        <h2 className="mt-4 text-[17px] font-bold text-[var(--chandan)]">
          Map couldn&rsquo;t load
        </h2>

        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
          The map tiles are unreachable right now. Check your connection and
          try again.
        </p>

        <p className="mt-3 text-[13px] text-[var(--faint)]">
          Mandal details, search and your saved darshan all work without it.
        </p>

        <div className="mt-5 flex justify-center gap-2">
          <Button asChild size="sm">
            <Link href="/explore">Browse mandals</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/plan">Your darshan</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
