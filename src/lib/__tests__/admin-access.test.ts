import { describe, it, expect, afterEach } from 'vitest';
import { resolveIsAdmin } from '@/lib/admin-access';

/**
 * Admin authorization.
 *
 * This is the one decision in the product where being wrong is a breach
 * rather than a bug, so it is pinned directly instead of inferred from a
 * redirect in a browser.
 *
 * Two gates must both hold: the `profiles.is_admin` flag in the database,
 * and the account's email in `ADMIN_EMAILS` in the hosting platform. They
 * fail independently, which is the point — neither a database compromise
 * nor an environment-variable change grants access on its own.
 */

const OWNER = 'owner@example.com';
const original = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (original === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = original;
});

describe('resolveIsAdmin', () => {
  it('grants when both gates hold', () => {
    process.env.ADMIN_EMAILS = OWNER;
    expect(resolveIsAdmin(OWNER, true)).toBe(true);
  });

  it('refuses an allowlisted email without the database flag', () => {
    // The allowlist must only ever NARROW. If it could grant on its own,
    // editing one environment variable would be a way in — which is the
    // opposite of what a second gate is for.
    process.env.ADMIN_EMAILS = OWNER;
    expect(resolveIsAdmin(OWNER, false)).toBe(false);
  });

  it('refuses the database flag when the email is not allowlisted', () => {
    // The case this whole mechanism exists for: someone flips is_admin in
    // the database and still gets nothing.
    process.env.ADMIN_EMAILS = OWNER;
    expect(resolveIsAdmin('someone.else@example.com', true)).toBe(false);
  });

  it('refuses an account with no email when an allowlist is set', () => {
    process.env.ADMIN_EMAILS = OWNER;
    expect(resolveIsAdmin(null, true)).toBe(false);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    process.env.ADMIN_EMAILS = `  ${OWNER.toUpperCase()} , other@example.com `;
    expect(resolveIsAdmin(OWNER, true)).toBe(true);
    expect(resolveIsAdmin('OTHER@Example.com', true)).toBe(true);
  });

  it('falls back to the database flag alone when ADMIN_EMAILS is unset', () => {
    // Not a loophole but a deliberate default: an unset variable means no
    // allowlist was configured, and locking every admin out of a
    // deployment where nobody added it would be a worse failure than the
    // one this guards against.
    delete process.env.ADMIN_EMAILS;
    expect(resolveIsAdmin(OWNER, true)).toBe(true);
    expect(resolveIsAdmin(OWNER, false)).toBe(false);
  });

  it('treats an empty or comma-only value as unset', () => {
    for (const value of ['', '   ', ',', ' , ']) {
      process.env.ADMIN_EMAILS = value;
      expect(resolveIsAdmin(OWNER, true), value).toBe(true);
    }
  });
});
