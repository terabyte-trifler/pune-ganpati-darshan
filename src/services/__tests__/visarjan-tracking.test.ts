import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { getTrackingSnapshot } from '../visarjan-tracking';
import realFeed from './fixtures/police-feed.json';

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
  // The feed leaves `name` as "." and puts the mandal in popup_text.
  name: '.',
  popup_text: 'तुळशीबाग गणपती मंडळ',
  description: `POWER:- ON STATUS:- RUNNING DATETIME:- ${deviceStamp(new Date())}`,
  icon_type: 'ON_THE_MOVE',
  latitude: '18.51356670',
  longitude: '73.85578330',
  address: 'Laxmi Road, Budhwar Peth',
  updated_at: istStamp(new Date()),
  ...over,
});

/** Their device clock: "25-09-2026 10:21:56", IST, no zone marker. */
function deviceStamp(at: Date): string {
  const ist = new Date(at.getTime() + 5.5 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${p(ist.getUTCDate())}-${p(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()} ` +
    `${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}:${p(ist.getUTCSeconds())}`
  );
}

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
  it('drops a row that names no mandal', async () => {
    // Twenty-seven of the forty-two rows are tracking devices with no
    // mandal against them. Listing those answers nothing.
    mockFeed([
      row({ popup_text: '', icon_type: 'ON_THE_MOVE' }),
      row({ popup_text: '   ', icon_type: 'YET_TO_START' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(false);
    expect(snap.mandals).toHaveLength(0);
  });

  it('stays shut when the newest position is hours old', async () => {
    // 10:15 on visarjan morning: the procession an hour under way and
    // the freshest row stamped 04:44. Drawn, it would have put the
    // miravnuk a couple of kilometres behind itself.
    const beforeDawn = new Date(Date.now() - 5.5 * 60 * 60 * 1000);
    mockFeed([
      row({
        icon_type: 'ON_THE_MOVE',
        description: `POWER:- ON STATUS:- STOP DATETIME:- ${deviceStamp(beforeDawn)}`,
      }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(false);
    expect(snap.stale).toBe(true);
    // And the old positions are not handed out at all: a caller that
    // forgot to check the flag would otherwise draw them.
    expect(snap.mandals).toHaveLength(0);
  });

  it('comes alive once real names arrive', async () => {
    mockFeed([
      row({ popup_text: 'कसबा गणपती मंडळ', icon_type: 'ON_THE_MOVE' }),
      row({ popup_text: 'गुरुजी तालीम मंडळ', icon_type: 'YET_TO_START' }),
      row({ popup_text: 'तांबडी जोगेश्वरी मंडळ', icon_type: 'COMPLETED' }),
      row({ popup_text: '', icon_type: 'YET_TO_START' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.ready).toBe(true);
    // The row naming no mandal is dropped, not counted.
    expect(snap.mandals).toHaveLength(3);
    expect(snap.counts).toEqual({ moving: 1, waiting: 1, finished: 1 });
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
      row({ popup_text: 'No Status Mandal', icon_type: 'SOMETHING_NEW' }),
      row({ popup_text: 'No Position Mandal', latitude: 'abc' }),
      row({ popup_text: 'Good Mandal' }),
    ]);
    const snap = await getTrackingSnapshot();
    expect(snap.mandals.map((m) => m.name)).toEqual(['Good Mandal']);
  });

  it('flags a feed that has stopped moving', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    mockFeed([
      row({ description: `POWER:- ON STATUS:- IDLE DATETIME:- ${deviceStamp(twoHoursAgo)}` }),
    ]);
    expect((await getTrackingSnapshot()).stale).toBe(true);

    mockFeed([row()]);
    expect((await getTrackingSnapshot()).stale).toBe(false);
  });

  it('reads their timestamps as IST, not as UTC', async () => {
    // Misread as UTC this is five and a half hours in the future, which
    // would make a live feed look fresh forever.
    const ninetyMinutesAgo = new Date(Date.now() - 90 * 60 * 1000);
    mockFeed([
      row({ description: `POWER:- ON STATUS:- IDLE DATETIME:- ${deviceStamp(ninetyMinutesAgo)}` }),
    ]);
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

  /**
   * The fixture ages, so its device clock is rewritten to now.
   *
   * Without this the tests passed when the capture was fresh and began
   * failing an hour later as it crossed the staleness window — a test
   * that depends on the wall clock is a test that will fail on a day
   * nobody changed anything.
   */
  const freshen = (feed: typeof realFeed) =>
    feed.map((r) => ({
      ...r,
      description: String(r.description ?? '').replace(
        /DATETIME:-.*/,
        `DATETIME:- ${deviceStamp(new Date())}`
      ),
    }));

  describe('against the real police feed', () => {
    // Captured from diversion.punepolice.gov.in at 10:22 on visarjan
    // morning, with Kasba an hour down Laxmi Road. Kept because two
    // fields in it were read wrongly for most of a day.
    it('takes the mandal name from popup_text, not name', async () => {
      mockFeed(freshen(realFeed));
      const snap = await getTrackingSnapshot();
      expect(snap.mandals.map((m) => m.name)).toContain('कसबा गणपती मंडळ');
      // Every row's `name` is "." — reading it found nothing all morning.
      expect(snap.mandals.some((m) => m.name === '.')).toBe(false);
    });

    it('keeps only the rows that name a mandal', async () => {
      mockFeed(freshen(realFeed));
      const snap = await getTrackingSnapshot();
      const named = realFeed.filter((r) => String(r.popup_text ?? '').trim()).length;
      expect(snap.mandals).toHaveLength(named);
    });

    it('reads freshness from the device clock, not updated_at', async () => {
      // The trap: every updated_at says 04:52 while the devices report
      // 10:21. Judged on updated_at the whole feed looks five hours
      // dead and the panel stays shut through the procession.
      mockFeed(freshen(realFeed));
      const snap = await getTrackingSnapshot();
      expect(snap.stale).toBe(false);
      expect(snap.ready).toBe(true);
    });

    it('carries Kasba as on the move', async () => {
      mockFeed(freshen(realFeed));
      const snap = await getTrackingSnapshot();
      const kasba = snap.mandals.find((m) => m.name.includes('कसबा'));
      expect(kasba?.status).toBe('moving');
    });
  });
});
