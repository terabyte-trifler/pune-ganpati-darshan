import { describe, it, expect } from 'vitest';
import { parsePinId } from '@/features/map/MapCanvas';

/**
 * Every pin the map can ask for must come back out the way it went in.
 *
 * The map builds an image id by concatenation and MapLibre asks for it by
 * name; if the handler that builds the image parses that name differently,
 * it registers an image nobody requested and the pin silently draws
 * nothing. That happened: the Manache flag was tested with
 * `id.includes('-m')`, which is also true of "-moving", so every amber pin
 * in Pune was invisible for an evening.
 *
 * So this is a round-trip test, not a list of cases somebody thought of.
 */

const CROWD_KEYS = [
  'none', 'short', 'moving', 'long',
  'obs-short', 'obs-moving', 'obs-long',
  'est-short', 'est-moving', 'est-long',
] as const;

/** Mirrors pinId in MapCanvas. */
const build = (crowd: string, manache: boolean, selected: boolean) =>
  `pin-${crowd}${manache ? '-m' : ''}${selected ? '-sel' : ''}`;

describe('pin ids round-trip', () => {
  it('parses back every id the map can build', () => {
    for (const crowd of CROWD_KEYS) {
      for (const manache of [false, true]) {
        for (const selected of [false, true]) {
          const id = build(crowd, manache, selected);
          expect(parsePinId(id), id).toEqual({ crowd, manache, selected });
        }
      }
    }
  });

  it('does not mistake "-moving" for the Manache suffix', () => {
    // The exact bug. Named so it cannot come back by accident.
    expect(parsePinId('pin-moving')).toEqual({
      crowd: 'moving', manache: false, selected: false,
    });
    expect(parsePinId('pin-est-moving')).toEqual({
      crowd: 'est-moving', manache: false, selected: false,
    });
    expect(parsePinId('pin-obs-moving-sel')).toEqual({
      crowd: 'obs-moving', manache: false, selected: true,
    });
  });

  it('refuses anything it does not recognise', () => {
    expect(parsePinId('cluster-pin')).toBeNull();
    expect(parsePinId('pin-nonsense')).toBeNull();
    expect(parsePinId('mini-short')).toBeNull();
  });
});
