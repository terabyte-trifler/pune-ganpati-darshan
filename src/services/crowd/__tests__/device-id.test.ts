import { describe, it, expect } from 'vitest';
import { isUuid, uuidV4, UUID_PATTERN } from '@/lib/uuid';
import { deviceIdSchema, mandalIdSchema } from '../crowd-validation';

/**
 * The browser decides whether to keep a stored device id; the server
 * decides whether to accept it. When those two rules differed, an id could
 * be kept forever and rejected forever — reporting permanently dead on
 * that device, and the user told "try again shortly", which would never
 * have worked.
 *
 * These tests pin the two to the same rule.
 */
describe('device id validation', () => {
  const CASES = [
    // Real generator output must always be accepted.
    ...Array.from({ length: 200 }, () => uuidV4()),
    // Shaped like a UUID but not RFC-conformant — the exact class that
    // used to pass on the client and fail on the server.
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'aaaaaaaa-bbbb-0ccc-8ddd-eeeeeeeeeeee', // version 0
    'aaaaaaaa-bbbb-4ccc-7ddd-eeeeeeeeeeee', // variant 7
    // Not UUIDs at all.
    '',
    'nope',
    '../../etc/passwd',
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-extra',
  ];

  it('client and server agree on every case', () => {
    for (const value of CASES) {
      const client = isUuid(value);
      const server = deviceIdSchema.safeParse(value).success;
      expect(server, `disagreed on ${JSON.stringify(value)}`).toBe(client);
    }
  });

  it('mandal ids use the same rule as device ids', () => {
    for (const value of CASES) {
      expect(mandalIdSchema.safeParse(value).success).toBe(isUuid(value));
    }
  });

  it('accepts everything the generator produces', () => {
    for (let i = 0; i < 500; i++) {
      const id = uuidV4();
      expect(isUuid(id), id).toBe(true);
      expect(deviceIdSchema.safeParse(id).success, id).toBe(true);
    }
  });

  it('rejects the non-conformant shapes that caused the bug', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(false);
    expect(UUID_PATTERN.test('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe(true);
  });
});
