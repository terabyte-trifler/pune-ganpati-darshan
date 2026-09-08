import Link from 'next/link';
import { MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { MapFailure } from './MapCanvas';

/**
 * Shown when the map cannot render.
 *
 * There is no API key to misconfigure, so the causes are environmental. Each
 * gets its own wording because the user's next action differs: a WebGL
 * problem is fixable in their browser settings, a tile problem is not.
 *
 * Deliberately not a decorative fake map (§12) — and the mandal list behind
 * this keeps working, because the catalogue never depended on the map (§35).
 */
export function MapUnavailable({ reason = 'tiles' }: { reason?: MapFailure }) {
  const copy = {
    webgl: {
      title: 'Your browser can’t draw the map',
      body: (
        <>
          The map needs WebGL, which looks switched off. In Chrome it is
          usually <span className="text-[var(--chandan)]">Settings → System →
          &ldquo;Use graphics acceleration when available&rdquo;</span>.
        </>
      ),
    },
    init: {
      title: 'The map couldn’t start',
      body: <>Your device refused to create the graphics context the map needs. This can happen on older phones.</>,
    },
    tiles: {
      title: 'Map couldn’t load',
      body: <>The map tiles are unreachable right now. Check your connection and try again.</>,
    },
  }[reason];

  return (
    /* Centred in the space above the sheet, not the whole viewport, so the
       message is never clipped by it. */
    <div className="absolute inset-x-0 top-0 bottom-[48dvh] grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)]">
          <MapPinOff size={24} aria-hidden="true" className="text-[var(--muted)]" />
        </div>

        <h2 className="mt-4 text-[17px] font-bold text-[var(--chandan)]">{copy.title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">{copy.body}</p>

        <p className="mt-3 text-[13px] text-[var(--faint)]">
          Everything below still works — the mandal list, search, distances and
          your saved darshan don&rsquo;t need the map.
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
