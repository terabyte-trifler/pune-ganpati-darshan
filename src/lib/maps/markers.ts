'use client';

import type { GanpatiCategory } from '@/types/ganpati';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Marker rendering.
 *
 * Markers are built as inline SVG rather than image files: they need to be
 * tinted per category and resized on selection, and a data URI avoids a
 * network round-trip per marker on a cold, congested connection.
 *
 * ---------------------------------------------------------------------
 * Colour on a pin means the queue, not the category.
 *
 * The whole pin takes the tracker's colour — green, amber or red — and it
 * follows the live store, so a map recolours as reports come in.
 *
 * That forced category colour off the map, and the reason is the app's own
 * rule that an unknown crowd is never presented as a calm one. Three of the
 * four category colours were crowd-like: 'historic' marigold is the exact
 * same hex as a moving queue, and 'famous' vermilion sits next to a heavy
 * one. Leaving them would mean a historic mandal nobody has reported
 * looking identical to one with an amber queue — a reading the app would be
 * inventing.
 *
 * So an unreported mandal draws in a neutral stone that no crowd level
 * uses. Grey says "nobody has reported this yet", which is true, and is
 * itself an invitation to report.
 *
 * The Manache Paach keep their heavier ring, so the one category that most
 * needs to be findable still is, and the list beside every map carries the
 * category badge as before.
 * ---------------------------------------------------------------------
 */

const CATEGORY_COLOR: Record<GanpatiCategory, string> = {
  maanache: '#c9a227', // brass — reserved for the Manache Paach
  famous: '#e2621b',   // vermilion
  historic: '#f2a93b', // marigold
  local: '#8a7f6d',    // muted stone
};

/**
 * The tracker's colours, and they must stay identical to --crowd-* in
 * globals.css. A map that disagrees with the badge beside it is worse than
 * a map with no colour at all.
 */
export const CROWD_PIN_COLOR: Record<CrowdLevel, string> = {
  short: '#5fb872',
  moving: '#f2a93b',
  long: '#e5544b',
};

/** No reading. Deliberately a colour no crowd level uses. */
export const UNREPORTED_COLOR = '#8a7f6d';

/** The pin body colour: the queue if we know it, neutral if we do not. */
export function pinColor(crowd: CrowdLevel | null | undefined): string {
  return crowd ? CROWD_PIN_COLOR[crowd] : UNREPORTED_COLOR;
}

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
  selected: boolean,
  crowd?: CrowdLevel | null
): MarkerVisual {
  const color = pinColor(crowd);
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

/**
 * Route stop pin.
 *
 * The same Ganpati mark every other pin on the maps uses, with the stop
 * number in a badge over it. Stops were previously plain numbered discs,
 * which left the one map where every single point is a Ganpati as the only
 * map that never said so.
 *
 * The number is deliberately not drawn here. It is a DOM element layered over
 * this artwork, so it renders in the page's own font at the device's real
 * pixel density rather than being rasterised into a data URI.
 */
export function buildRouteStopSvg(
  selected: boolean,
  crowd?: CrowdLevel | null
): MarkerVisual {
  // A route stop reads the queue like every other pin. Selection is carried
  // by size and the halo rather than by colour, so choosing a stop can no
  // longer be mistaken for its queue changing.
  const color = pinColor(crowd);
  // 40px, up from the old 32px disc: a Ganpati silhouette needs the room to
  // read, and the larger target is worth having where stops overlap.
  const size = selected ? 48 : 40;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    ${selected ? `<circle cx="12" cy="12" r="11.4" fill="${color}" opacity="0.3"/>` : ''}
    <circle cx="12" cy="12" r="10.2" fill="${color}" stroke="#14100c" stroke-width="1.6"/>
    ${glyph('#14100c')}
    ${eyes(color)}
  </svg>`;

  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size };
}

/**
 * Cluster pin — one Ganpati standing for the several inside it.
 *
 * Brass rather than vermilion so a cluster is not read as a single mandal at
 * a glance, and drawn at one size only: the map scales it by count through
 * `icon-size`, which keeps this to a single registered image instead of one
 * per bucket. The count itself is a text layer on top.
 */
export function buildClusterPinSvg(): MarkerVisual {
  const size = 56;
  const color = '#c9a227';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11.4" fill="${color}" opacity="0.24"/>
    <circle cx="12" cy="12" r="10.2" fill="${color}" stroke="#14100c" stroke-width="1.8"/>
    ${glyph('#14100c')}
    ${eyes(color)}
  </svg>`;
  return { url: `data:image/svg+xml,${encodeURIComponent(svg)}`, size };
}

export { CATEGORY_COLOR };
