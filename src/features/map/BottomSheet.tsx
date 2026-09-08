'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate, type PanInfo } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Draggable bottom sheet.
 *
 * Three detents (collapsed / half / full) expressed as fractions of the
 * viewport. Dragging picks the nearest detent, but a fast flick wins over
 * proximity — otherwise a quick upward flick from the bottom feels like it
 * was ignored.
 *
 * Accessibility: the grab handle is a real button, so the sheet can be
 * cycled from the keyboard and is announced to screen readers (§37). The
 * sheet is NOT a modal dialog — the map behind it stays interactive by
 * design, so a focus trap would be wrong here.
 */

export type Detent = 'collapsed' | 'half' | 'full';

const DETENT_FRACTION: Record<Detent, number> = {
  collapsed: 0.14,
  half: 0.48,
  full: 0.9,
};

const ORDER: Detent[] = ['collapsed', 'half', 'full'];

/** Past this speed the flick direction decides, not the distance. */
const FLICK_VELOCITY = 420;

export function BottomSheet({
  children, detent, onDetentChange, header, className,
}: {
  children: React.ReactNode;
  detent: Detent;
  onDetentChange: (d: Detent) => void;
  header?: React.ReactNode;
  className?: string;
}) {
  const [viewportH, setViewportH] = useState(0);
  const y = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // `dvh` via JS: iOS Safari's toolbar changes the visual viewport, and a
  // sheet sized in `vh` ends up under the browser chrome.
  useEffect(() => {
    const measure = () => setViewportH(window.visualViewport?.height ?? window.innerHeight);
    measure();
    window.visualViewport?.addEventListener('resize', measure);
    window.addEventListener('resize', measure);
    return () => {
      window.visualViewport?.removeEventListener('resize', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const yFor = useCallback(
    (d: Detent) => (viewportH ? viewportH * (1 - DETENT_FRACTION[d]) : 0),
    [viewportH]
  );

  // Animate to the active detent whenever it or the viewport changes.
  useEffect(() => {
    if (!viewportH) return;
    const controls = animate(y, yFor(detent), {
      type: 'spring',
      stiffness: 380,
      damping: 38,
      restDelta: 0.5,
    });
    return () => controls.stop();
  }, [detent, viewportH, y, yFor]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const current = y.get();
    const velocity = info.velocity.y;

    let target: Detent;
    if (Math.abs(velocity) > FLICK_VELOCITY) {
      const index = ORDER.indexOf(detent);
      // Dragging down (positive y) collapses; up expands.
      target = ORDER[Math.min(ORDER.length - 1, Math.max(0, index + (velocity > 0 ? -1 : 1)))];
      // A flick from a mid position should land on the extreme it points at.
      if (velocity > 0 && detent === 'full') target = 'half';
    } else {
      target = ORDER.reduce((best, d) =>
        Math.abs(yFor(d) - current) < Math.abs(yFor(best) - current) ? d : best
      , ORDER[0]);
    }

    onDetentChange(target);
  };

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length];
    onDetentChange(next);
  };

  // The list scrolls only when the sheet is expanded; otherwise a swipe on
  // the list should drag the sheet rather than scroll hidden content.
  const canScroll = detent !== 'collapsed';

  return (
    <motion.div
      style={{ y, height: viewportH || '100dvh' }}
      drag="y"
      dragConstraints={{ top: yFor('full'), bottom: yFor('collapsed') }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className={cn(
        'absolute inset-x-0 top-0 z-30 flex flex-col',
        'rounded-t-[var(--radius-sheet)] border-t border-[var(--line-strong)]',
        'bg-[var(--raat)]/95 backdrop-blur-xl',
        className
      )}
    >
      <div className="shrink-0 touch-none px-4 pb-1 pt-2">
        <button
          type="button"
          onClick={cycle}
          aria-label={`Sheet ${detent}. Activate to change size.`}
          aria-expanded={detent !== 'collapsed'}
          /* h-11, not h-6: the visible grabber stays a 4px bar, but the
             button around it has to be tappable. The hit area is what the
             finger needs; the bar is only what the eye needs. */
          className="mx-auto flex h-11 w-full max-w-[120px] items-center justify-center"
        >
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-[var(--line-strong)]"
          />
        </button>
        {header}
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 flex-1 pb-[calc(var(--nav-height)+var(--safe-bottom)+8px)]',
          canScroll ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}
