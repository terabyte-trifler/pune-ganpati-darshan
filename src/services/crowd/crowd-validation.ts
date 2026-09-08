import { z } from 'zod';

/**
 * Input validation for every crowd endpoint.
 *
 * Nothing from a request reaches SQL, a cache key, or the aggregator
 * without passing through here first. Supabase's client parameterises
 * queries so injection is not the live risk; the live risks are oversized
 * payloads, unbounded batches, and attacker-chosen cache keys (§52, §53).
 */

/** Matches the client's `crypto.randomUUID()` and the DB's CHECK. */
export const deviceIdSchema = z.string().uuid();

export const crowdLevelSchema = z.enum(['short', 'moving', 'long']);

export const mandalIdSchema = z.string().uuid();

/**
 * Idempotency key. Length-bounded and restricted to a safe alphabet: it is
 * stored, compared, and returned, so it must not be able to carry anything
 * that could be interpreted elsewhere.
 */
export const requestIdSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'request id must be url-safe');

/**
 * Batch size cap (§21).
 *
 * 100 is comfortably above the whole catalogue, so a legitimate client
 * never hits it, while a caller asking for 10,000 ids is refused before
 * any work happens.
 */
export const MAX_BATCH_IDS = 100;

export const batchBodySchema = z.object({
  mandalIds: z.array(mandalIdSchema).min(1).max(MAX_BATCH_IDS),
});

export const reportBodySchema = z.object({
  deviceId: deviceIdSchema,
  status: crowdLevelSchema,
  requestId: requestIdSchema.optional(),
});

/** `?mandalIds=a,b,c` for the GET form of the batch read. */
export function parseMandalIdList(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const parsed = z.array(mandalIdSchema).min(1).max(MAX_BATCH_IDS).safeParse(ids);
  return parsed.success ? parsed.data : null;
}

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().int().min(100).max(20_000).default(3_000),
});
