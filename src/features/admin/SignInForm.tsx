'use client';

import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

/**
 * Google OAuth plus an email magic link.
 *
 * Both paths are wired to real Supabase auth — neither is a placeholder.
 * If a provider is not enabled in the Supabase project, the error surfaces
 * verbatim rather than failing silently.
 */
export function SignInForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  /**
   * Sign-in is allowlisted in the database, and Supabase flattens the
   * trigger's message into a generic "Database error saving new user"
   * before it reaches here. Showing that verbatim reads as the site being
   * broken rather than the account not being permitted, so it is mapped to
   * something a person can act on.
   *
   * Matched on substrings rather than a code because Supabase does not
   * give this case one; if the wording upstream changes, the fallback is
   * the provider's own message, which is no worse than today.
   */
  const readableError = (message: string): string => {
    const m = message.toLowerCase();
    if (
      m.includes('database error saving new user') ||
      m.includes('sign-up is not open') ||
      m.includes('signups not allowed') ||
      m.includes('signup is disabled')
    ) {
      return 'This site does not accept new accounts. Everything except saving across devices works without signing in.';
    }
    return message;
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(readableError(error.message));
  };

  const sendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setStatus('sending');
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(readableError(error.message));
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  };

  if (status === 'sent') {
    return (
      <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--tulsi)]/40 bg-[var(--tulsi)]/10 p-4">
        <p className="text-[14px] font-semibold text-[var(--chandan)]">Check your email</p>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          We sent a sign-in link to {email}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <Button onClick={signInWithGoogle} variant="secondary" full size="lg">
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-[12px] text-[var(--faint)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        or
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-2">
        <label htmlFor="email" className="sr-only">Email address</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="h-12 w-full rounded-[var(--radius-field)] border border-[var(--line-strong)] bg-[var(--dhoop)] px-4 text-[16px] text-[var(--chandan)] placeholder:text-[var(--faint)] focus:border-[var(--shendur)]/60 focus:outline-none"
        />
        <Button type="submit" full size="lg" disabled={status === 'sending'}>
          {status === 'sending' ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Sending…</>
          ) : (
            <><Mail size={16} aria-hidden="true" />Email me a link</>
          )}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-[13px] text-[#ef8f88]">{error}</p>
      )}
    </div>
  );
}
