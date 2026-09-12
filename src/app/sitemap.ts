import type { MetadataRoute } from 'next';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { getRoutes } from '@/services/routes';
import { GUIDES } from '@/content/guides';
import { CATALOGUE_GENERATED_AT } from '@/services/catalogue';
import { env } from '@/lib/env';

/**
 * Generated from the catalogue, so new mandals and routes appear without a
 * code change.
 *
 * ---------------------------------------------------------------------
 * On lastModified.
 *
 * This used to stamp `new Date()` on every URL, which says "everything on
 * this site changed just now" on every build — including the About page,
 * which has not changed in weeks. A crawler that is told everything
 * changed constantly learns to ignore the field, and the pages that
 * genuinely did change lose the signal along with the rest.
 *
 * So it is only claimed where it is known. Mandals carry a real
 * `updatedAt`. An area or category page changes when the mandals inside
 * it change, so it inherits the newest of them. Routes have no timestamp
 * column, and the static pages change only on deploy — both omit the
 * field rather than invent one. Omitted is a legitimate answer; wrong is
 * not.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;
  const [ganpatis, areas, categories, routes] = await Promise.all([
    getAllGanpatis(), getAreas(), getCategories(), getRoutes(),
  ]);

  /**
   * A Date only when the timestamp is real.
   *
   * `new Date(undefined)` is an Invalid Date, and Next.js serialises
   * lastModified with toISOString(), which throws on one — taking the
   * whole build down rather than degrading.
   */
  const when = (value: string | null | undefined): Date | undefined => {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : undefined;
  };

  /**
   * When the catalogue data was last regenerated.
   *
   * Per-row updatedAt is not wired through — the mapper sets it to an
   * empty string — so there is no honest per-mandal timestamp to publish.
   * The snapshot's own generation time is, and it is the right kind of
   * wrong when it is wrong: if a mandal was edited in Supabase after the
   * snapshot was cut, this understates the change date. Understating
   * costs a re-crawl; overstating teaches a crawler to distrust the field
   * across the whole site.
   */
  const catalogueUpdated = when(CATALOGUE_GENERATED_AT);

  return [
    { url: `${base}/`, lastModified: catalogueUpdated, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, lastModified: catalogueUpdated, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/map`, lastModified: catalogueUpdated, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/routes`, lastModified: catalogueUpdated, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/guides`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/plan`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/how-to-use`, changeFrequency: 'monthly', priority: 0.6 },
    // The Marathi guide is its own URL, so it needs its own row — an
    // hreflang pair is not a substitute for being listed.
    { url: `${base}/how-to-use/marathi`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/licences`, changeFrequency: 'yearly', priority: 0.3 },

    ...ganpatis.map((g) => ({
      url: `${base}/ganpati/${g.slug}`,
      lastModified: catalogueUpdated,
      changeFrequency: 'weekly' as const,
      // Manache Paach and featured mandals carry the most search demand.
      priority: g.category === 'maanache' ? 0.9 : g.featured ? 0.85 : 0.7,
    })),

    // Curated routes were absent entirely, so nothing pointed a crawler at
    // seventeen pages that each answer a real query — "every mandal in one
    // walk", "manache paach route", "ganpati darshan in one hour".
    ...routes.map((r) => ({
      url: `${base}/routes/${r.slug}`,
      lastModified: catalogueUpdated,
      changeFrequency: 'monthly' as const,
      priority: r.featured ? 0.8 : 0.7,
    })),

    // Guides carry their own edit date, which is the one lastmod on this
    // site that is genuinely per-URL.
    ...GUIDES.map((g) => ({
      url: `${base}/guides/${g.slug}`,
      lastModified: when(g.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    })),

    ...areas.map((a) => ({
      url: `${base}/area/${a.slug}`,
      lastModified: catalogueUpdated,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    })),

    ...categories.map((c) => ({
      url: `${base}/category/${c.key}`,
      lastModified: catalogueUpdated,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
