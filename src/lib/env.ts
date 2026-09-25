import { z } from 'zod';

/**
 * Environment validation.
 *
 * Split into two schemas so a server-only secret can never be read from
 * browser code: `serverEnv` throws if evaluated in the browser, and the
 * files that use it are marked `server-only`.
 */

/**
 * An unset variable and a variable set to "" mean the same thing: absent.
 * Without this, a blank line in .env.local fails validation instead of
 * disabling the feature, which is never what the author intended.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optional(z.string().url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional(z.string().min(20)),
  NEXT_PUBLIC_APP_URL: z.preprocess(
    (v) => (v === '' || v === undefined ? 'http://localhost:3000' : v),
    z.string().url()
  ),
});

/**
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only for
 * statically analysable member expressions, so they must be written out
 * literally rather than iterated.
 */
const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

const parsedClient = clientSchema.safeParse(rawClientEnv);

if (!parsedClient.success) {
  throw new Error(
    `Invalid public environment variables:\n${parsedClient.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')}`
  );
}

export const env: z.infer<typeof clientSchema> = parsedClient.data;

/**
 * Feature availability. The app is designed to degrade rather than crash
 * when a key is absent, so these are checked at render time instead of
 * being asserted at boot.
 */
export const features = {
  // The map needs no key: OpenFreeMap tiles are open. Only Supabase is
  // conditional now.
  supabase: Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),

  /**
   * Live crowd readings and the report buttons that feed them.
   *
   * Switched off. The feature answers "how long is the queue at this
   * mandap", and once the idols leave for the procession there is no
   * queue and no mandap to have one — the crowd model already went
   * silent on visarjan afternoon for exactly that reason.
   *
   * A flag rather than a deletion, deliberately. This is wired into some
   * twenty-five files: the homepage, every mandal page, the map pins,
   * the planner, the cards and the opengraph image. Cutting that apart
   * during the busiest hours of the year is how a working site breaks,
   * and the whole point of turning it off is that it is no longer
   * telling anyone anything true. One line restores it; the code is
   * untouched and every test still runs against it.
   *
   * It also closes the write path. No report is accepted while this is
   * false, so nothing is collected that nobody will read.
   */
  crowd: false,
} as const;
