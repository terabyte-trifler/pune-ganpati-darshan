'use client';

import { Component, type ReactNode } from 'react';

/**
 * Last line of defence around the map.
 *
 * The map is the only part of this app that depends on GPU drivers, and a
 * failure there must never cost the user the mandal list, the search or their
 * saved darshan. Without this, an uncaught WebGL error unmounted the entire
 * route and left a blank screen.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[map] render failed', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
