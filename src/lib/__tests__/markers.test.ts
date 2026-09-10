import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildMarkerSvg, buildRouteStopSvg,
  CROWD_PIN_COLOR, UNREPORTED_COLOR, CATEGORY_COLOR, pinColor,
} from '@/lib/maps/markers';
import type { CrowdLevel } from '@/types/crowd';

/**
 * Pin colour is the queue.
 *
 * The rule underneath all of this is the app's own: an unknown crowd is
 * never presented as a calm one. On a map that means no pin without a
 * reading may be drawn in a colour a reading would use.
 */

const LEVELS: CrowdLevel[] = ['short', 'moving', 'long'];

/** The tracker's colours as the stylesheet defines them. */
function cssCrowdColors(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--crowd-(short|moving|long):\s*(#[0-9a-fA-F]{6})/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

describe('pin colour', () => {
  it('matches the tracker exactly', () => {
    // A map that disagrees with the badge beside it is worse than a map
    // with no colour at all.
    const css = cssCrowdColors();
    expect(Object.keys(css).sort()).toEqual(['long', 'moving', 'short']);
    for (const level of LEVELS) {
      expect(CROWD_PIN_COLOR[level].toLowerCase()).toBe(css[level]);
    }
  });

  it('never lets an unreported pin wear a crowd colour', () => {
    // The whole reason category colour came off the map: 'historic'
    // marigold is the same hex as a moving queue, so a mandal nobody had
    // reported looked exactly like one with an amber wait.
    const crowdColors = LEVELS.map((l) => CROWD_PIN_COLOR[l].toLowerCase());
    expect(crowdColors).not.toContain(UNREPORTED_COLOR.toLowerCase());
  });

  it('draws no reading as the neutral, not as the calmest', () => {
    expect(pinColor(null)).toBe(UNREPORTED_COLOR);
    expect(pinColor(undefined)).toBe(UNREPORTED_COLOR);
    expect(pinColor('short')).not.toBe(UNREPORTED_COLOR);
  });

  it('puts the queue colour in the artwork itself, not beside it', () => {
    for (const level of LEVELS) {
      const { url } = buildMarkerSvg('famous', false, level);
      const svg = decodeURIComponent(url.replace('data:image/svg+xml,', ''));
      expect(svg, `${level} pin`).toContain(CROWD_PIN_COLOR[level]);
      // Category must not tint it any more, or the two meanings collide.
      expect(svg).not.toContain(CATEGORY_COLOR.famous);
    }
  });

  it('colours route stops the same way, so both maps agree', () => {
    const { url } = buildRouteStopSvg(false, 'long');
    const svg = decodeURIComponent(url.replace('data:image/svg+xml,', ''));
    expect(svg).toContain(CROWD_PIN_COLOR.long);
  });

  it('keeps selection out of the colour channel', () => {
    // Selection used to switch a route stop from vermilion to marigold,
    // which would now read as a queue getting worse. It is carried by size
    // and halo instead.
    const plain = buildRouteStopSvg(false, 'short');
    const chosen = buildRouteStopSvg(true, 'short');
    expect(chosen.size).toBeGreaterThan(plain.size);
    const svgOf = (u: string) => decodeURIComponent(u.replace('data:image/svg+xml,', ''));
    expect(svgOf(chosen.url)).toContain(CROWD_PIN_COLOR.short);
  });

  it('still marks the Manache Paach without using colour', () => {
    // The one category that survives on the map does it by ring weight, so
    // it reads in greyscale and alongside any queue colour.
    const svg = (c: 'maanache' | 'local') =>
      decodeURIComponent(
        buildMarkerSvg(c, false, 'short').url.replace('data:image/svg+xml,', '')
      );
    expect(svg('maanache')).not.toBe(svg('local'));
  });
});
