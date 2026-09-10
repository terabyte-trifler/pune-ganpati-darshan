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

/**
 * Starts loading this far before the map scrolls into view.
 *
 * 400px looked harmless and was not. On a 390x844 phone a mandal page puts
 * "Where it is" at 1241px, and 844 + 400 = 1244 — so the observer fired on
 * first paint, three pixels inside its own margin, and the deferral this
 * whole file exists for did nothing. 466KB of MapLibre and ~730ms of
 * blocked main thread landed while the visitor was still reading the top.
 *
 * 200px is enough warning to have the map drawn by the time it is reached
 * at a normal scroll speed, and far enough from a full viewport that a
 * page of ordinary length cannot trip it by accident.
 */
const ROOT_MARGIN = '200px';
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

    /**
     * Armed once the browser is idle, not during the first render.
     *
     * Even at the right margin, observing immediately means that on a short
     * page the chunk starts downloading while the content above is still
     * painting, and competes with it for the main thread. Waiting for idle
     * costs nothing when the map is far away and a few frames when it is
     * near, and it keeps the map off the critical path either way.
     */
    let observer: IntersectionObserver | undefined;
    let idle: number | undefined;

    const arm = () => {
      observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
        { rootMargin: ROOT_MARGIN }
      );
      observer.observe(node);
    };

    const ric = window.requestIdleCallback;
    if (typeof ric === 'function') idle = ric(arm, { timeout: 1200 });
    else idle = window.setTimeout(arm, 300);

    // Only arm the timer when the observer genuinely cannot fire.
    const timer =
      document.visibilityState === 'hidden'
        ? setTimeout(() => setVisible(true), HIDDEN_TAB_FALLBACK_MS)
        : undefined;

    return () => {
      observer?.disconnect();
      if (idle !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
        else clearTimeout(idle);
      }
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  return (
    <div ref={holderRef} className={props.className}>
      {visible ? <MiniMapImpl {...props} className="h-full w-full" /> : <Placeholder />}
    </div>
  );
}
