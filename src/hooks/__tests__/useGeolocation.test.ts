import { describe, it, expect } from 'vitest';
import { isFixWorthPublishing } from '@/hooks/useGeolocation';

/**
 * The jitter filter, which is why the app slowed to a crawl in the peths.
 *
 * A stationary phone between four-storey buildings reports wildly varying
 * accuracy second after second, and every published fix re-renders the
 * nearby rail, the map, the report controls and the dwell tracker.
 */
const AT = { lat: 18.5143, lng: 73.8553 };
const north = (m: number) => ({ lat: AT.lat + m / 111_320, lng: AT.lng });

describe('when a new fix is worth publishing', () => {
  it('ignores accuracy jitter from a phone standing still', () => {
    expect(isFixWorthPublishing(AT, 30, AT, 90)).toBe(false);
    expect(isFixWorthPublishing(AT, 90, AT, 45)).toBe(false);
    expect(isFixWorthPublishing(AT, 45, AT, 60)).toBe(false);
  });

  it('publishes real movement', () => {
    expect(isFixWorthPublishing(AT, 30, north(40), 30)).toBe(true);
    expect(isFixWorthPublishing(AT, 30, north(5), 30)).toBe(false);
  });

  it('ignores a sharper fix that changes nothing the app can do', () => {
    // 90 m to 45 m is genuinely sharper and still pure jitter: both sides
    // of it are inside the 100 m gate, so no control changes state.
    expect(isFixWorthPublishing(AT, 90, AT, 45)).toBe(false);
    expect(isFixWorthPublishing(AT, 40, AT, 35)).toBe(false);
  });

  it('publishes a sharper fix that unlocks reporting', () => {
    expect(isFixWorthPublishing(AT, 140, AT, 40)).toBe(true);
  });

  it('publishes either crossing of the at-the-mandal accuracy line', () => {
    expect(isFixWorthPublishing(AT, 110, AT, 95)).toBe(true);
    expect(isFixWorthPublishing(AT, 95, AT, 110)).toBe(true);
  });
});
