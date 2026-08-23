import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';
import { asCheckTier, type CheckTier } from './schedule';

/**
 * Minimal read-model data for the sitemap, in two queries.
 *
 * Deliberately separate from `queries.ts`: the sitemap only needs identifiers
 * and timestamps, not mapped `PublicSite` objects with their per-site page
 * queries — at 100 sites that difference is ~100 round trips per crawl.
 */

export interface SitemapPage {
  slug: string;
  /** Position 0 is the site's primary page. */
  position: number;
  lastModified: Date;
  /** False when the page has never been checked (no content to index yet). */
  checked: boolean;
}

export interface SitemapSite {
  slug: string;
  tier: CheckTier;
  lastModified: Date;
  checked: boolean;
  pages: SitemapPage[];
}

export interface SitemapData {
  sites: SitemapSite[];
  /** Most recent check across every monitored page — when the index last changed. */
  lastCheckedAt: Date | null;
}

function bestDate(...values: unknown[]): Date {
  for (const value of values) {
    if (typeof value === 'string' && value) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return new Date(0);
}

export function getSitemapData(): SitemapData {
  const db = getReadModelDatabase();
  try {
    const siteRows = db.prepare(`
      SELECT id, slug, tier, last_checked_at, updated_at
      FROM public_sites WHERE active = 1
      ORDER BY position ASC, slug ASC
    `).all() as any[];
    
    const pageRows = db.prepare(`
      SELECT site_id, slug, position, last_checked_at, updated_at
      FROM public_pages WHERE active = 1
      ORDER BY site_id ASC, position ASC
    `).all() as any[];
    
    const pagesBySite = new Map<string, SitemapPage[]>();
    for (const row of pageRows) {
      const page: SitemapPage = {
        slug: row.slug,
        position: row.position ?? 0,
        lastModified: bestDate(row.last_checked_at, row.updated_at),
        checked: Boolean(row.last_checked_at)
      };
      const list = pagesBySite.get(row.site_id);
      if (list) list.push(page);
      else pagesBySite.set(row.site_id, [page]);
    }
    
    let latest: Date | null = null;
    const sites: SitemapSite[] = siteRows.map(row => {
      const lastModified = bestDate(row.last_checked_at, row.updated_at);
      if (row.last_checked_at && (!latest || lastModified > latest)) latest = lastModified;
      return {
        slug: row.slug,
        tier: asCheckTier(row.tier),
        lastModified,
        checked: Boolean(row.last_checked_at),
        pages: pagesBySite.get(row.id) ?? []
      };
    });
    
    return { sites, lastCheckedAt: latest };
  } finally {
    db.close();
  }
}
