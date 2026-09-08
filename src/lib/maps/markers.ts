'use client';

import type { GanpatiCategory } from '@/types/ganpati';

/**
 * Marker rendering.
 *
 * Markers are built as inline SVG rather than image files: they need to be
 * tinted per category and resized on selection, and a data URI avoids a
 * network round-trip per marker on a cold, congested connection.
 *
 * Category is encoded by BOTH colour and ring weight so the map is not
 * relying on colour alone (§37).
 */

const CATEGORY_COLOR: Record<GanpatiCategory, string> = {
  maanache: '#c9a227', // brass — reserved for the Manache Paach
  famous: '#e2621b',   // vermilion
  historic: '#f2a93b', // marigold
  local: '#8a7f6d',    // muted stone
};

/**
 * Compact Ganpati silhouette for map pins, matching GanpatiGlyph.
 *
 * Redrawn rather than reused: at 34px the full illustration's tusks, tilak
 * and crown band collapse into noise. This keeps only the features that
 * survive at pin size — crown, ears, head, eyes, trunk.
 *
 * Coordinates are in the marker's 24x24 viewBox, centred on the pin.
 */
function glyph(ink: string): string {
  return `
    <g fill="${ink}">
      <circle cx="12" cy="5.4" r="0.9"/>
      <path d="M12 6.9c1.6 0 2.9 1.1 3.4 2.7H8.6C9.1 8 10.4 6.9 12 6.9Z"/>
      <path d="M8.9 10.4c-2 -1 -4.3 -.5 -5.2 1.3-.9 1.8-.2 4.2 1.5 5.2 1.2.7 2.6.6 3.7-.2Z" opacity="0.62"/>
      <path d="M15.1 10.4c2-1 4.3-.5 5.2 1.3.9 1.8.2 4.2-1.5 5.2-1.2.7-2.6.6-3.7-.2Z" opacity="0.62"/>
      <path d="M12 8.6c2.6 0 4.5 1.9 4.5 4.4v2c0 2.4-1.9 4.3-4.5 4.3s-4.5-1.9-4.5-4.3v-2c0-2.5 1.9-4.4 4.5-4.4Z"/>
      <path d="M12 15.2c0 2-.2 3.4-1 4.5-.6.8-.5 1.8.4 2.1.7.2 1.4-.2 1.4-.9"
            fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
    </g>`;
}

/** Eye knockouts, drawn in the pin's own colour so they read as shadow. */
function eyes(ground: string): string {
  return `
    <ellipse cx="10.3" cy="12.1" rx="0.75" ry="0.9" fill="${ground}"/>
    <ellipse cx="13.7" cy="12.1" rx="0.75" ry="0.9" fill="${ground}"/>`;
}

export interface MarkerVisual {
  url: string;
  size: number;
}

export function buildMarkerSvg(
  category: GanpatiCategory,
  selected: boolean
): MarkerVisual {
  const color = CATEGORY_COLOR[category];
  const size = selected ? 46 : 34;
  // Manache Paach get a heavier ring so they are distinguishable in
  // greyscale and to colour-blind users.
  const ring = category === 'maanache' ? 2.4 : 1.4;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    ${selected ? `<circle cx="12" cy="12" r="11.4" fill="${color}" opacity="0.28"/>` : ''}
    <circle cx="12" cy="12" r="10.2" fill="${color}" stroke="#14100c" stroke-width="${ring}"/>
    ${glyph('#14100c')}
    ${eyes(color)}
  </svg>`;

  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size };
}

/** Cluster bubble — size and warmth scale with the number of mandals inside. */
export function buildClusterSvg(count: number): MarkerVisual {
  const size = count < 10 ? 40 : count < 25 ? 48 : 56;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="#e2621b" opacity="0.22"/>
    <circle cx="24" cy="24" r="16" fill="#e2621b" stroke="#14100c" stroke-width="2"/>
    <text x="24" y="29" text-anchor="middle"
          font-family="ui-sans-serif,system-ui,sans-serif" font-size="15"
          font-weight="700" fill="#14100c">${count}</text>
  </svg>`;
  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size };
}

export { CATEGORY_COLOR };
