import 'server-only';

import { z } from 'zod';

/**
 * Server-only environment.
 *
 * Kept in a separate `server-only` module so that neither the secret values
 * NOR the schema describing them are reachable from the client graph. When
 * this lived alongside the public schema, the bundler shipped the key names
 * into a browser chunk — harmless, but it makes a security audit ambiguous,
 * and "harmless today" is how leaks start.
 */

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(20)),
  OPENROUTESERVICE_API_KEY: optional(z.string().min(10)),
  ROUTING_OSRM_URL: optional(z.string().url()),
});

let cache: z.infer<typeof serverSchema> | null = null;

/** Server-only secrets. Throws if ever reached from browser code. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() must never be called in the browser');
  }
  if (!cache) {
    cache = serverSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENROUTESERVICE_API_KEY: process.env.OPENROUTESERVICE_API_KEY,
      ROUTING_OSRM_URL: process.env.ROUTING_OSRM_URL,
    });
  }
  return cache;
}
