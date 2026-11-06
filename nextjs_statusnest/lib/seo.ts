import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/site-url';

export const HOME_TITLE = 'Website Uptime Monitoring & Outage Alerts | StatusNest';
export const HOME_DESCRIPTION = 'Monitor your websites every five minutes, get outage alerts by phone, SMS or email, and receive weekly uptime reports. Check popular website status with StatusNest.';

export function publicMetadata(title: string, description: string, path: string, index = true): Metadata {
  const url = absoluteUrl(path);
  const image = { url: absoluteUrl('/opengraph-image'), width: 1200, height: 630, alt: 'StatusNest — website uptime monitoring and outage alerts' };
  return {
    title, description, alternates: { canonical: url },
    robots: { index, follow: true },
    openGraph: { title, description, url, type: 'website', siteName: 'StatusNest', locale: 'en_US', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

export function accountMetadata(title: string): Metadata {
  return { title: `${title} | StatusNest`, robots: { index: false, follow: false } };
}

/** A site's primary page shares its overview's canonical URL. */
export function statusHref(siteSlug: string, page?: { slug: string; position: number }): string {
  return `/status/${siteSlug}${page && page.position !== 0 ? `/${page.slug}` : ''}`;
}

export function statusDescription(name: string): string {
  return `Check ${name} status, recent outages, uptime history and page load times. See the latest independent browser observations from StatusNest.`;
}
