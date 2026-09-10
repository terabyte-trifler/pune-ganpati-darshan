import type { MetadataRoute } from 'next';
import { getAllGanpatis, getAreas, getCategories } from '@/services/ganpati';
import { env } from '@/lib/env';

/** Generated from the catalogue, so new mandals appear without a code change. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_APP_URL;
  const [ganpatis, areas, categories] = await Promise.all([
    getAllGanpatis(), getAreas(), getCategories(),
  ]);
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/map`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/plan`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/how-to-use`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    ...ganpatis.map((g) => ({
      url: `${base}/ganpati/${g.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      // Manache Paach and featured mandals carry the most search demand.
      priority: g.category === 'maanache' ? 0.9 : g.featured ? 0.85 : 0.7,
    })),
    ...areas.map((a) => ({
      url: `${base}/area/${a.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    })),
    ...categories.map((c) => ({
      url: `${base}/category/${c.key}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
