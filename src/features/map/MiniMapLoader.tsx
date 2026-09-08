'use client';

import dynamic from 'next/dynamic';
import type { MiniMapProps } from './MiniMap';

/**
 * Code-splits MapLibre so pages that merely *contain* a map do not pay for it
 * up front. The placeholder holds the same box, so nothing shifts when the
 * map arrives (CLS stays 0).
 */
const MiniMapImpl = dynamic(() => import('./MiniMap').then((m) => m.MiniMap), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)]"
      style={{ height: '100%' }}
    />
  ),
});

export function MiniMap(props: MiniMapProps) {
  return <MiniMapImpl {...props} />;
}
