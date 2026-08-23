/** Public base URL of this deployment, used for canonicals, sitemaps and JSON-LD. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'https://statusnest.com';
  return raw.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
