import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';
import { publicMonitorsEnabled } from '@/lib/public-monitors/sites';

// Rendered per request: PUBLIC_MONITORS is a runtime setting, and a
// prerendered robots.txt would bake in the build machine's value.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // A deployment without public monitors has nothing worth indexing and
  // would only duplicate statusnest.com's marketing pages.
  if (!publicMonitorsEnabled()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    // Account pages must be crawlable for their noindex metadata to be read.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
