import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/services/auth';
import { features } from '@/lib/env';
import { SignInForm } from '@/features/admin/SignInForm';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Sign-in exists only for admin now. Accounts are allowlisted to the
 * owner in the database, so the favourites-sync and saved-plans reasons
 * this page used to give are no longer reachable by anyone else, and
 * offering them here would be a promise the trigger refuses.
 *
 * Browsing, search, the map, planning and crowd reports never require it
 * (§29) — that part is unchanged and is the load-bearing half.
 */
export default async function SignInPage() {
  const user = await getSessionUser();

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md place-items-center px-6">
      <div className="w-full">
        <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
          Sign in
        </h1>
        {/* Says up front what the outcome will be. Sign-in is allowlisted
            to the site admin now, so inviting a visitor to type an email
            and then refusing it wastes their time and reads as a fault. */}
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Sign-in is for the site admin, to manage the catalogue. Everything
          else — mandals, the map, routes and crowd reports — works without an
          account, and always will.
        </p>

        {!features.supabase ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
            <p className="text-[14px] font-semibold text-[var(--chandan)]">
              Sign-in isn&rsquo;t configured
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
              Add <code className="text-[var(--zendu)]">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="text-[var(--zendu)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable it.
            </p>
          </div>
        ) : user ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
            <p className="text-[14px] text-[var(--chandan)]">
              Signed in as {user.email}
            </p>
            {user.isAdmin && (
              <Button asChild size="sm" className="mt-3">
                <Link href="/admin">Open admin</Link>
              </Button>
            )}
          </div>
        ) : (
          <SignInForm />
        )}

        <Link href="/" className="mt-6 block text-[13px] text-[var(--shendur)]">
          ← Back to Pune Ganpati
        </Link>
      </div>
    </main>
  );
}
