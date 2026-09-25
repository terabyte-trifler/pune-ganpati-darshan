import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { getTrackingSnapshot } from '../visarjan-tracking';

/**
 * This feature was written before the data it reads existed.
 *
 * At the time of writing the police feed carried forty-two devices with
 * placeholder names and tracking had not opened. These tests are the only
 * place the "names have arrived" path is exercised, so they carry the
 * weight a browser normally would — and the placeholder path is asserted
 * just as hard, because that is what every reader sees until 9am.
 */

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Tulshibaug Ganpati',
  icon_type: 'ON_THE_MOVE',
  latitude: '18.51356670',
  longitude: '73.85578330',
  address: 'Laxmi Road, Budhwar Peth',
  updated_at: istStamp(new Date()),
  ...over,
});

/** The feed publishes IST wall-clock with no zone marker. */
function istStamp(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 19).replace('T', ' ');
}

function mockFeed(payload: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => payload })
  );
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.unstubAllGlobals());

describe('live procession tracking', () => {
  it('shows an unnamed vehicle that is genuinely moving', async () => {
    // The shape served all through visarjan morning: forty-two rows and
    // not one name filled in. Refusing to say anything because the
    // police left a text field blank let their data entry decide what
    // our readers were told.
    mockFeed([
      row({ name: '.', icon_type: 'ON_THE_MOVE' }),
      row({ name: '--', icon_type: 'YET_TO_START' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(true);
    expect(snap.mandals).toHaveLength(2);
    expect(snap.mandals[0].name).toBe('A tracked vehicle');
  });

  it('stays shut when the newest position is hours old', async () => {
    // 10:15 on visarjan morning: the procession an hour under way and
    // the freshest row stamped 04:44. Drawn, it would have put the
    // miravnuk a couple of kilometres behind itself.
    const beforeDawn = new Date(Date.now() - 5.5 * 60 * 60 * 1000);
    mockFeed([
      row({ name: 'Kasba Ganpati', icon_type: 'ON_THE_MOVE', updated_at: istStamp(beforeDawn) }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(false);
    expect(snap.stale).toBe(true);
  });

  it('comes alive once real names arrive', async () => {
    mockFeed([
      row({ name: 'Kasba Ganpati', icon_type: 'ON_THE_MOVE' }),
      row({ name: 'Guruji Talim', icon_type: 'YET_TO_START' }),
      row({ name: 'Tambdi Jogeshwari', icon_type: 'COMPLETED' }),
      row({ name: '.', icon_type: 'YET_TO_START' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(true);
    // The unnamed row is carried too, under a generic label.
    expect(snap.mandals).toHaveLength(4);
    expect(snap.counts).toEqual({ moving: 1, waiting: 2, finished: 1 });
    expect(snap.mandals.map((m) => m.name)).toContain('A tracked vehicle');
  });

  it('puts the ones on the move first', async () => {
    mockFeed([
      row({ name: 'Zeta Mandal', icon_type: 'COMPLETED' }),
      row({ name: 'Alpha Mandal', icon_type: 'YET_TO_START' }),
      row({ name: 'Beta Mandal', icon_type: 'ON_THE_MOVE' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.mandals.map((m) => m.status)).toEqual(['moving', 'waiting', 'finished']);
  });

  it('drops a row it cannot place or classify', async () => {
    mockFeed([
      row({ name: 'No Status Mandal', icon_type: 'SOMETHING_NEW' }),
      row({ name: 'No Position Mandal', latitude: 'abc' }),
      row({ name: 'Good Mandal' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.mandals.map((m) => m.name)).toEqual(['Good Mandal']);
  });

  it('flags a feed that has stopped moving', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockFeed([row({ updated_at: istStamp(twoHoursAgo) })]);
    expect((await getTrackingSnapshot()).stale).toBe(true);

    mockFeed([row({ updated_at: istStamp(new Date()) })]);
    expect((await getTrackingSnapshot()).stale).toBe(false);
  });

  it('reads their timestamps as IST, not as UTC', async () => {
    // Misread as UTC this is five and a half hours in the future, which
    // would make a live feed look fresh forever.
    mockFeed([row({ updated_at: istStamp(new Date(Date.now() - 90 * 60 * 1000)) })]);
    const snap = await getTrackingSnapshot();
    expect(snap.lastUpdated).not.toBeNull();
    const age = Date.now() - Date.parse(snap.lastUpdated!);
    expect(age).toBeGreaterThan(80 * 60 * 1000);
    expect(age).toBeLessThan(100 * 60 * 1000);
  });

  it('degrades to nothing when the police feed fails', async () => {
    mockFeed({}, false);
    expect((await getTrackingSnapshot()).ready).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect((await getTrackingSnapshot()).ready).toBe(false);

    mockFeed({ not: 'an array' });
    expect((await getTrackingSnapshot()).ready).toBe(false);
  });

  it('gives up on a slow police server rather than holding the request', async () => {
    // Measured at 41s on visarjan morning while their own site timed
    // out. Unbounded, every cache miss would hold an invocation open
    // that long on the busiest morning of the year.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
      )
    );

    const started = Date.now();
    const snap = await getTrackingSnapshot();
    const waited = Date.now() - started;

    expect(snap.ready).toBe(false);
    expect(waited, `waited ${waited}ms`).toBeLessThan(9_000);
  }, 15_000);
});
