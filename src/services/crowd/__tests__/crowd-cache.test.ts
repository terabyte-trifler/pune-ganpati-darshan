import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryCrowdCache, crowdCacheKey } from '../crowd-cache';
import {
  batchBodySchema,
  parseMandalIdList,
  reportBodySchema,
  MAX_BATCH_IDS,
} from '../crowd-validation';
import type { CrowdStatus } from '@/types/crowd';

const status = (mandalId: string): CrowdStatus => ({
  mandalId,
  status: 'long',
  label: 'Heavy',
  detail: 'Devotees report a heavy crowd',
  reportCount: 4,
  confidence: 'medium',
  lastUpdated: new Date().toISOString(),
  trend: 'stable',
});

afterEach(() => vi.useRealTimers());

describe('cache keys', () => {
  it('is versioned and namespaced by festival year', () => {
    expect(crowdCacheKey('abc', 2026)).toBe('crowd:v1:2026:mandal:abc');
  });

  it('separates the same mandal across festival years', () => {
    expect(crowdCacheKey('abc', 2026)).not.toBe(crowdCacheKey('abc', 2027));
  });
});

describe('MemoryCrowdCache', () => {
  it('returns what was stored', async () => {
    const cache = new MemoryCrowdCache(2026);
    await cache.set('a', status('a'), 15);
    expect((await cache.get('a'))?.mandalId).toBe('a');
  });

  it('misses for an unknown key rather than throwing', async () => {
    const cache = new MemoryCrowdCache(2026);
    expect(await cache.get('nope')).toBeNull();
  });

  it('expires entries once the TTL has passed', async () => {
    vi.useFakeTimers();
    const cache = new MemoryCrowdCache(2026);
    await cache.set('a', status('a'), 15);

    vi.advanceTimersByTime(14_000);
    expect(await cache.get('a')).not.toBeNull();

    vi.advanceTimersByTime(2_000);
    expect(await cache.get('a')).toBeNull();
  });

  it('invalidates only the mandal asked for', async () => {
    // The whole point of §48: one report must not discard the city.
    const cache = new MemoryCrowdCache(2026);
    await cache.set('a', status('a'), 60);
    await cache.set('b', status('b'), 60);

    await cache.invalidate('a');

    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('b')).not.toBeNull();
  });

  it('stays bounded when written to far beyond its capacity', async () => {
    const cache = new MemoryCrowdCache(2026, 10);
    for (let i = 0; i < 500; i++) await cache.set(`m${i}`, status(`m${i}`), 60);
    expect(cache.size()).toBeLessThanOrEqual(10);
  });
});

describe('input validation', () => {
  it('accepts a well-formed report', () => {
    const parsed = reportBodySchema.safeParse({
      deviceId: '3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70',
      status: 'moving',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a status outside the three the product defines', () => {
    const parsed = reportBodySchema.safeParse({
      deviceId: '3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70',
      status: 'empty',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a device id that is not a UUID', () => {
    expect(
      reportBodySchema.safeParse({ deviceId: '../../etc/passwd', status: 'short' }).success
    ).toBe(false);
  });

  it('rejects an idempotency key carrying anything but url-safe characters', () => {
    expect(
      reportBodySchema.safeParse({
        deviceId: '3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70',
        status: 'short',
        requestId: 'abc/../../x',
      }).success
    ).toBe(false);
  });

  it('caps batch size so one request cannot ask for unbounded work', () => {
    const tooMany = Array.from(
      { length: MAX_BATCH_IDS + 1 },
      () => '3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70'
    );
    expect(batchBodySchema.safeParse({ mandalIds: tooMany }).success).toBe(false);
  });

  it('rejects a batch list containing a non-UUID', () => {
    expect(parseMandalIdList('3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70,DROP TABLE')).toBeNull();
  });

  it('rejects an empty or missing id list', () => {
    expect(parseMandalIdList(null)).toBeNull();
    expect(parseMandalIdList('')).toBeNull();
    expect(parseMandalIdList('   ')).toBeNull();
  });

  it('parses a valid comma-separated list', () => {
    const ids = parseMandalIdList(
      '3f0c8a3e-4d3b-4c8e-9f3a-2b1c4d5e6f70, 8a1c2d3e-4f5b-4c6d-8e9f-0a1b2c3d4e5f'
    );
    expect(ids).toHaveLength(2);
  });
});
