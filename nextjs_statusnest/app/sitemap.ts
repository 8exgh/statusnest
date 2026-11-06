import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/lib/public-monitors/sitemap-data';
import { absoluteUrl } from '@/lib/site-url';
import { publicMonitorsEnabled } from '@/lib/public-monitors/sites';

/**
 * Sitemap computed from the read model on every request.
 *
 * Everything that can be derived from real data is: `lastModified` comes from
 * the actual last check of that page (never "now" — telling crawlers a page
 * changed at crawl time is noise that devalues the signal), and priority
 * follows the site's check tier. Pages that have never been checked are left
 * out: they render "Not checked yet" and are thin content until the browser
 * checker has visited them, at which point the next crawl picks them up.
 */

export const dynamic = 'force-dynamic';

/** Pages that are not derived from monitoring data. */
const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/bot', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  if (!publicMonitorsEnabled()) return [];
  const { sites, lastCheckedAt } = getSitemapData();
  
  // The home page and the status index both surface live check results, so
  // they last changed when the most recent check landed.
  const indexModified = lastCheckedAt ?? undefined;
  
  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: indexModified, changeFrequency: 'hourly', priority: 1 },
    { url: absoluteUrl('/status'), lastModified: indexModified, changeFrequency: 'hourly', priority: 0.9 },
  ];
  
  for (const site of sites) {
    if (!site.checked) continue;
    
    // Headline sites are checked 3× as often and carry the most search
    // interest, so they outrank the rest; a site page outranks its sub-pages.
    const sitePriority = site.tier === 'primary' ? 0.9 : 0.75;
    entries.push({
      url: absoluteUrl(`/status/${site.slug}`),
      lastModified: site.lastModified,
      changeFrequency: 'hourly',
      priority: sitePriority,
    });
    
    for (const page of site.pages) {
      if (!page.checked || page.position === 0) continue;
      entries.push({
        url: absoluteUrl(`/status/${site.slug}/${page.slug}`),
        lastModified: page.lastModified,
        changeFrequency: 'hourly',
        priority: sitePriority - 0.25,
      });
    }
  }
  
  for (const route of STATIC_ROUTES) {
    entries.push({
      url: absoluteUrl(route.path),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }
  
  return entries;
}
