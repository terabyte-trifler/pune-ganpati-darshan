'use client';

import { useEffect, useState } from 'react';

/**
 * The author's photo, if there is one.
 *
 * Initials first, photo only once it has actually loaded.
 *
 * The obvious shape — render <img> and swap to initials in onError — does
 * not work here. The element is server-rendered, so a missing file fires
 * its error event before React hydrates and attaches the handler; the
 * handler never runs and the page shows a broken-image icon with the alt
 * text spilling out of the circle. Preloading detects the same failure
 * without ever putting a broken element on screen, and it means the page
 * is complete before the photo exists.
 *
 * Drop a square JPEG at /public/gurnoor.jpg and it appears. Nothing else
 * needs changing.
 */

const SRC = '/gurnoor.jpg';

export function AuthorAvatar({ name }: { name: string }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    let cancelled = false;
    img.onload = () => { if (!cancelled) setLoaded(true); };
    img.src = SRC;
    return () => { cancelled = true; };
  }, []);

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

  if (!loaded) {
    return (
      <span
        aria-hidden="true"
        className="font-display grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--line-strong)] bg-[var(--dhoop)] text-[18px] font-bold text-[var(--pital)]"
      >
        {initials}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC}
      alt={name}
      width={56}
      height={56}
      decoding="async"
      className="h-14 w-14 shrink-0 rounded-full border border-[var(--line-strong)] object-cover"
    />
  );
}
