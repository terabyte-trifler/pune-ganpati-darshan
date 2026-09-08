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
  /**
   * Salt for the crowd IP throttle digest. IPv4 has only ~4 billion
   * values, so an unsalted hash is trivially reversible by anyone who
   * gets the table. Optional so the feature still runs without it, but it
   * should be set in production — see hashIp() in crowd-service.ts.
   */
  CROWD_IP_SALT: optional(z.string().min(16)),
  /**
   * Enables the crowd metrics endpoint when set. Unset in normal
   * operation, which makes the endpoint return 404 rather than exist and
   * be denied — an endpoint that is not there cannot be probed.
   */
  CROWD_METRICS_TOKEN: optional(z.string().min(16)),
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
      CROWD_IP_SALT: process.env.CROWD_IP_SALT,
      CROWD_METRICS_TOKEN: process.env.CROWD_METRICS_TOKEN,
    });
  }
  return cache;
}
