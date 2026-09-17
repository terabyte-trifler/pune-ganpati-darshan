import { describe, it, expect } from 'vitest';
import { cachedJson } from '@/services/crowd/crowd-http';

const get = (etag?: string) =>
  new Request('https://example.test/api/crowd', {
    headers: etag ? { 'if-none-match': etag } : {},
  });

/**
 * The 304 that was never sent.
 *
 * This endpoint is polled by every open tab, and its whole bandwidth story
 * is that an unchanged snapshot comes back as headers rather than a body.
 * It never did: the snapshot carries `computedAt`, the moment it was
 * BUILT, which moves on every recompute while every reading stays
 * identical — so the hash changed, no conditional request ever matched,
 * and each poll paid for the full payload.
 *
 * Nothing failed. It just cost money, which is why it needs a test.
 */
describe('cachedJson ETag', () => {
  it('sends 304 with no body when the client already has it', async () => {
    const data = { statuses: [{ mandalId: 'm', status: 'long' }] };
    const first = cachedJson(data, get());
    expect(first.status).toBe(200);
    const etag = first.headers.get('etag')!;
    expect(etag).toBeTruthy();

    const second = cachedJson(data, get(etag));
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
  });

  it('ignores a field the caller excludes, so an unchanged reading matches', () => {
    const a = { statuses: [{ mandalId: 'm' }], computedAt: '2026-09-17T10:00:00.000Z' };
    const b = { statuses: [{ mandalId: 'm' }], computedAt: '2026-09-17T10:00:02.339Z' };
    const omit = (s: typeof a) => {
      const c: Partial<typeof a> = { ...s };
      delete c.computedAt;
      return c;
    };
    const first = cachedJson(a, get(), { etagOf: omit(a) });
    const etag = first.headers.get('etag')!;

    // Two seconds later, same readings, new build time.
    const second = cachedJson(b, get(etag), { etagOf: omit(b) });
    expect(second.status).toBe(304);
  });

  /** Hashing the whole body is what made it useless — pin the contrast. */
  it('would NOT have matched while the build time was hashed', () => {
    const a = { statuses: [{ mandalId: 'm' }], computedAt: '2026-09-17T10:00:00.000Z' };
    const b = { statuses: [{ mandalId: 'm' }], computedAt: '2026-09-17T10:00:02.339Z' };
    const etag = cachedJson(a, get()).headers.get('etag')!;
    expect(cachedJson(b, get(etag)).status).toBe(200);
  });

  it('still changes when a reading actually changes', () => {
    const a = { statuses: [{ mandalId: 'm', status: 'short' }], computedAt: 'x' };
    const b = { statuses: [{ mandalId: 'm', status: 'long' }], computedAt: 'x' };
    const etag = cachedJson(a, get(), { etagOf: { s: a.statuses } }).headers.get('etag')!;
    expect(cachedJson(b, get(etag), { etagOf: { s: b.statuses } }).status).toBe(200);
  });

  it('keeps the cache headers on the 304, not just the 200', () => {
    const data = { statuses: [] };
    const etag = cachedJson(data, get()).headers.get('etag')!;
    const notModified = cachedJson(data, get(etag));
    expect(notModified.status).toBe(304);
    expect(notModified.headers.get('cache-control')).toContain('s-maxage=');
    expect(notModified.headers.get('etag')).toBe(etag);
  });
});
