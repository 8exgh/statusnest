import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';
import { publicMonitorsEnabled } from '@/lib/public-monitors/sites';

export default function robots(): MetadataRoute.Robots {
  // A deployment without public monitors has nothing worth indexing and
  // would only duplicate statusnest.com's marketing pages.
  if (!publicMonitorsEnabled()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard', '/profile'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
