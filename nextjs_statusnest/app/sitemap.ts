import type { MetadataRoute } from 'next';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import { absoluteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: absoluteUrl('/status'), lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: absoluteUrl('/bot'), changeFrequency: 'monthly', priority: 0.3 },
    { url: absoluteUrl('/register'), changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/login'), changeFrequency: 'monthly', priority: 0.2 },
  ];
  
  for (const site of new PublicMonitorQueries().getSites()) {
    entries.push({
      url: absoluteUrl(`/status/${site.slug}`),
      lastModified: site.lastCheckedAt ?? site.updatedAt,
      changeFrequency: 'hourly',
      priority: 0.8,
    });
    for (const page of site.pages) {
      entries.push({
        url: absoluteUrl(`/status/${site.slug}/${page.slug}`),
        lastModified: page.lastCheckedAt ?? page.updatedAt,
        changeFrequency: 'hourly',
        priority: 0.6,
      });
    }
  }
  return entries;
}
