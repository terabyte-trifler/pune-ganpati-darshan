import { z } from 'zod';
import { UUID_PATTERN } from '@/lib/uuid';

/**
 * Input validation for every crowd endpoint.
 *
 * Nothing from a request reaches SQL, a cache key, or the aggregator
 * without passing through here first. Supabase's client parameterises
 * queries so injection is not the live risk; the live risks are oversized
 * payloads, unbounded batches, and attacker-chosen cache keys (§52, §53).
 */

/**
 * The SAME rule the browser applies before storing an id (lib/uuid.ts).
 *
 * It used to be `z.string().uuid()` while the client used a looser regex.
 * An id that satisfied one and not the other was stored permanently and
 * rejected on every submission — reporting broken forever on that device,
 * reported to the user as "try again shortly".
 */
export const deviceIdSchema = z.string().regex(UUID_PATTERN, 'not a UUID');

export const crowdLevelSchema = z.enum(['short', 'moving', 'long']);

export const mandalIdSchema = z.string().regex(UUID_PATTERN, 'not a UUID');

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
  /**
   * Whether the client believed it was at the mandal. Optional so an older
   * client keeps working, and a boolean rather than coordinates so nobody's
   * position ends up in a request log to support a weighting hint.
   */
  atMandal: z.boolean().optional(),
});

/** `?mandalIds=a,b,c` for the GET form of the batch read. */
export function parseMandalIdList(raw: string | null): string[] | null {
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const parsed = z.array(mandalIdSchema).min(1).max(MAX_BATCH_IDS).safeParse(ids);
  return parsed.success ? parsed.data : null;
}
