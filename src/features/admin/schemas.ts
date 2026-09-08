import { z } from 'zod';

/**
 * Validation shared by the admin forms and the server actions.
 *
 * The server re-validates with the same schema — client validation is a
 * convenience, never the boundary (§30).
 */

export const ganpatiInputSchema = z.object({
  slug: z.string()
    .min(3).max(80)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and hyphens only'),
  name: z.string().min(2).max(160),
  nameMr: z.string().max(160).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  visitorTip: z.string().max(600).optional().nullable(),
  category: z.enum(['maanache', 'famous', 'historic', 'local']),
  areaSlug: z.string().min(1),
  address: z.string().max(300).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  googlePlaceId: z.string().max(200).optional().nullable(),
  manacheRank: z.coerce.number().int().min(1).max(5).optional().nullable(),
  prominence: z.coerce.number().int().min(0).max(1000).default(0),
  establishedYear: z.coerce.number().int().min(1600).max(2100).optional().nullable(),
  timingOpen: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  timingClose: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  timingNote: z.string().max(300).optional().nullable(),
  tags: z.array(z.string().max(40)).max(12).default([]),
  confidence: z.enum(['verified', 'community', 'demo']).default('community'),
  featured: z.boolean().default(false),
  verified: z.boolean().default(false),
  published: z.boolean().default(true),
})
  // Mirrors the database CHECK constraints so the UI fails fast with a
  // readable message instead of surfacing a Postgres error.
  .refine(
    (v) => (v.category === 'maanache') === (v.manacheRank != null),
    { message: 'Manache Paach mandals need a rank 1-5; others must have none', path: ['manacheRank'] }
  )
  .refine(
    (v) => (v.timingOpen == null) === (v.timingClose == null),
    { message: 'Set both opening and closing time, or neither', path: ['timingClose'] }
  );

export type GanpatiInput = z.infer<typeof ganpatiInputSchema>;

/** One row of a CSV/JSON import. */
export const importRowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(2),
  nameMr: z.string().optional(),
  category: z.enum(['maanache', 'famous', 'historic', 'local']),
  areaSlug: z.string().min(1),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  manacheRank: z.coerce.number().int().min(1).max(5).optional(),
  prominence: z.coerce.number().int().min(0).max(1000).optional(),
  establishedYear: z.coerce.number().int().min(1600).max(2100).optional(),
  description: z.string().optional(),
  confidence: z.enum(['verified', 'community', 'demo']).optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

/** Derives a URL slug from a mandal name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
