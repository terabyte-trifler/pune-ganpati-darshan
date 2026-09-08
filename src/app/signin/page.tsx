import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionUser } from '@/services/auth';
import { features } from '@/lib/env';
import { SignInForm } from '@/features/admin/SignInForm';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Sign-in exists only for synced favourites, saved plans and admin.
 * Browsing, search, the map and planning never require it (§29).
 */
export default async function SignInPage() {
  const user = await getSessionUser();

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md place-items-center px-6">
      <div className="w-full">
        <h1 className="text-[24px] font-extrabold tracking-tight text-[var(--chandan)]">
          Sign in
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Only needed to sync saved mandals across devices, or to manage the
          catalogue. Everything else works without an account.
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
