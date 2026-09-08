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
 * A stylised Ganpati silhouette: crown arc, trunk curve and ear. Kept to a
 * few paths so it stays legible at 14px on a phone.
 */
const GLYPH = `
  <path d="M12 5.2c1.9 0 3.4 1.2 3.4 3 0 .9-.4 1.6-.9 2.2.9.5 1.5 1.4 1.5 2.5 0 1.9-1.7 3.3-3.9 3.3-.6 0-1-.4-1-1s.4-1 1-1c1.1 0 1.9-.6 1.9-1.3 0-.6-.5-1.1-1.4-1.2-.5 0-.9-.5-.9-1 0-.4.2-.7.6-.9.5-.3.7-.7.7-1.1 0-.6-.4-1-1-1s-1 .4-1 1c0 .6-.4 1-1 1s-1-.4-1-1c0-1.8 1.5-3 3-3z" fill="#14100c" opacity="0.9"/>
  <path d="M8.6 8.4c-.4-.5-1-.8-1.6-.8" stroke="#14100c" stroke-width="1.1" stroke-linecap="round" fill="none" opacity="0.75"/>
`;

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
    <circle cx="12" cy="12" r="9" fill="${color}" stroke="#14100c" stroke-width="${ring}"/>
    ${GLYPH}
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
