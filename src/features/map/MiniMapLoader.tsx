'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MiniMapProps } from './MiniMap';

/**
 * Loads MapLibre only once the map is close to being seen.
 *
 * Code-splitting alone was not enough. On a mandal page the map sits below the
 * fold, but the chunk still began downloading immediately and competed with
 * the hero photograph for bandwidth and main-thread time — pushing LCP past
 * six seconds on a throttled mobile connection even though the images
 * themselves arrive as ~15 KB AVIF in about ten milliseconds.
 *
 * Deferring until the map approaches the viewport lets the content above it
 * paint first, which is the part the visitor is actually waiting for.
 */
const MiniMapImpl = dynamic(() => import('./MiniMap').then((m) => m.MiniMap), {
  ssr: false,
  loading: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div
      aria-hidden="true"
      className="h-full w-full animate-pulse rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]"
    />
  );
}

/** Starts loading this far before the map scrolls into view. */
const ROOT_MARGIN = '400px';
/**
 * Fallback for the one case IntersectionObserver cannot cover: a hidden or
 * background tab, where it never fires. In a visible tab the observer is
 * authoritative — adding a timer there defeats the whole point, loading the
 * map while the visitor is still reading the top of the page and costing
 * main-thread time they did not ask to spend.
 */
const HIDDEN_TAB_FALLBACK_MS = 2500;

export function MiniMap(props: MiniMapProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;

    const node = holderRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(node);

    // Only arm the timer when the observer genuinely cannot fire.
    const timer =
      document.visibilityState === 'hidden'
        ? setTimeout(() => setVisible(true), HIDDEN_TAB_FALLBACK_MS)
        : undefined;

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  return (
    <div ref={holderRef} className={props.className}>
      {visible ? <MiniMapImpl {...props} className="h-full w-full" /> : <Placeholder />}
    </div>
  );
}
