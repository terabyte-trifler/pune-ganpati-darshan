/**
 * Who counts as an admin.
 *
 * Extracted from `services/auth.ts` so it can be tested directly. That
 * file is `server-only` and pulls in the Supabase client; this decision is
 * pure string comparison and is the one place in the product where being
 * wrong is a breach rather than a bug, so it is worth pinning on its own.
 *
 * Admin requires TWO independent things to be true:
 *
 *   1. `profiles.is_admin` in the database, which users cannot
 *      self-assign (the `profiles_no_self_admin` trigger enforces that),
 *   2. the account's email in `ADMIN_EMAILS`, which lives in the hosting
 *      platform rather than the database.
 *
 * Two gates because they fail independently. A database compromise that
 * flips `is_admin` grants nothing without also changing an environment
 * variable, and someone who can edit environment variables still needs a
 * row in a table they cannot write to.
 */

/**
 * Parsed `ADMIN_EMAILS`, or null when unset.
 *
 * Null means no allowlist is configured and admin falls back to the
 * database flag alone. That keeps local development — and any deployment
 * where nobody added the variable — working as before, instead of locking
 * every admin out of it. Failing open on a *missing* configuration is the
 * lesser evil here precisely because the database flag is still required.
 */
export function adminAllowlist(env = process.env): string[] | null {
  const raw = env.ADMIN_EMAILS;
  if (!raw || raw.trim() === '') return null;

  const list = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return list.length > 0 ? list : null;
}

/**
 * Both gates, or not an admin.
 *
 * The allowlist only ever NARROWS. An email in `ADMIN_EMAILS` without
 * `is_admin` is not an admin — otherwise editing one environment variable
 * would itself be a way in, which is the opposite of what a second gate
 * is for.
 */
export function resolveIsAdmin(
  email: string | null,
  dbFlag: boolean,
  env = process.env
): boolean {
  if (!dbFlag) return false;

  const allowlist = adminAllowlist(env);
  if (allowlist === null) return true;

  return email !== null && allowlist.includes(email.toLowerCase());
}
