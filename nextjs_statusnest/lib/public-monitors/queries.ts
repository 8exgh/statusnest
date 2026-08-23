import type { PublicMonitorStatus, PublicPage, PublicPageCheck, PublicSite } from '@/types';
import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';
import { CLAIM_TIMEOUT_MS } from './schedule';

/**
 * Read-side queries for the public monitors. Everything the SEO pages and the
 * browser checker need comes from here; nothing here writes events.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UptimeWindow {
  /** Fraction 0..1, or null when there are no checks in the window. */
  uptime: number | null;
  checks: number;
  online: number;
  offline: number;
}

export interface UptimeSummary {
  last24h: UptimeWindow;
  last7d: UptimeWindow;
  last30d: UptimeWindow;
  last90d: UptimeWindow;
}

export interface DailyUptime {
  /** YYYY-MM-DD (UTC) */
  date: string;
  checks: number;
  online: number;
  offline: number;
  uptime: number | null;
}

export interface Incident {
  pageId: string;
  startedAt: Date;
  /** null while still ongoing */
  endedAt: Date | null;
  durationMs: number;
  checks: number;
  /** Most common error / HTTP code seen during the incident. */
  reason?: string;
}

/** Everything the index / home page needs for one site, fetched in a single connection. */
export interface PublicSiteOverview {
  site: PublicSite;
  /** The primary page (position 0), or null if the site has no active pages. */
  primary: PublicPage | null;
  uptime: UptimeSummary;
  /** Primary-page checks from the last 24 hours, oldest first. */
  recentChecks: PublicPageCheck[];
}

export interface PublicSiteTask {
  siteId: string;
  slug: string;
  name: string;
  pages: { pageId: string; slug: string; name: string; url: string }[];
}

function toDate(value: unknown): Date | undefined {
  return typeof value === 'string' && value ? new Date(value) : undefined;
}

function mapPage(row: any): PublicPage {
  return {
    id: row.id,
    siteId: row.site_id,
    slug: row.slug,
    name: row.name,
    url: row.url,
    position: row.position ?? 0,
    active: Boolean(row.active),
    status: (row.status || 'unknown') as PublicMonitorStatus,
    responseCode: row.response_code ?? undefined,
    responseTimeMs: row.response_time_ms ?? undefined,
    lastCheckedAt: toDate(row.last_checked_at),
    lastOnlineAt: toDate(row.last_online_at),
    lastOfflineAt: toDate(row.last_offline_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapSite(row: any, pages: PublicPage[]): PublicSite {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    url: row.url,
    description: row.description ?? '',
    position: row.position ?? 0,
    active: Boolean(row.active),
    status: (row.status || 'unknown') as PublicMonitorStatus,
    lastCheckedAt: toDate(row.last_checked_at),
    nextCheckAt: toDate(row.next_check_at),
    claimedAt: toDate(row.claimed_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    pages
  };
}

function mapCheck(row: any): PublicPageCheck {
  return {
    id: row.id,
    pageId: row.page_id,
    siteId: row.site_id,
    checkedAt: new Date(row.checked_at),
    status: row.status,
    responseCode: row.response_code ?? undefined,
    responseTimeMs: row.response_time_ms ?? undefined,
    finalUrl: row.final_url ?? undefined,
    title: row.title ?? undefined,
    error: row.error ?? undefined,
    blocked: Boolean(row.blocked)
  };
}

export class PublicMonitorQueries {
  /** All sites (active by default) with their active pages, in display order. */
  getSites(options: { includeInactive?: boolean } = {}): PublicSite[] {
    const db = getReadModelDatabase();
    try {
      const siteRows = db.prepare(
        `SELECT * FROM public_sites ${options.includeInactive ? '' : 'WHERE active = 1'} ORDER BY position ASC, name ASC`
      ).all() as any[];
      const pageStmt = db.prepare(
        `SELECT * FROM public_pages WHERE site_id = ? ${options.includeInactive ? '' : 'AND active = 1'} ORDER BY position ASC, name ASC`
      );
      return siteRows.map(row => mapSite(row, (pageStmt.all(row.id) as any[]).map(mapPage)));
    } finally {
      db.close();
    }
  }
  
  getSiteBySlug(slug: string): PublicSite | null {
    const db = getReadModelDatabase();
    try {
      const row = db.prepare('SELECT * FROM public_sites WHERE slug = ? AND active = 1').get(slug) as any;
      if (!row) return null;
      const pages = (db.prepare('SELECT * FROM public_pages WHERE site_id = ? AND active = 1 ORDER BY position ASC, name ASC').all(row.id) as any[]).map(mapPage);
      return mapSite(row, pages);
    } finally {
      db.close();
    }
  }
  
  /**
   * All active sites with their primary page's uptime windows and last-24h
   * checks, using one database connection (the index and home page call this
   * on every request).
   */
  getSitesOverview(now: Date = new Date()): PublicSiteOverview[] {
    const db = getReadModelDatabase();
    try {
      const siteRows = db.prepare('SELECT * FROM public_sites WHERE active = 1 ORDER BY position ASC, name ASC').all() as any[];
      const pageStmt = db.prepare('SELECT * FROM public_pages WHERE site_id = ? AND active = 1 ORDER BY position ASC, name ASC');
      const uptimeStmt = db.prepare(`
        SELECT COUNT(*) AS checks,
               SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online
        FROM public_page_checks
        WHERE page_id = ? AND checked_at >= ?
      `);
      const checksStmt = db.prepare('SELECT * FROM public_page_checks WHERE page_id = ? AND checked_at >= ? ORDER BY checked_at ASC');
      const windowFor = (pageId: string, days: number): UptimeWindow => {
        const row = uptimeStmt.get(pageId, new Date(now.getTime() - days * DAY_MS).toISOString()) as { checks: number; online: number | null };
        const checks = row.checks ?? 0;
        const online = row.online ?? 0;
        return { uptime: checks > 0 ? online / checks : null, checks, online, offline: checks - online };
      };
      const empty: UptimeWindow = { uptime: null, checks: 0, online: 0, offline: 0 };
      
      return siteRows.map(row => {
        const pages = (pageStmt.all(row.id) as any[]).map(mapPage);
        const site = mapSite(row, pages);
        const primary = pages[0] ?? null;
        if (!primary) {
          return { site, primary, uptime: { last24h: empty, last7d: empty, last30d: empty, last90d: empty }, recentChecks: [] };
        }
        return {
          site,
          primary,
          uptime: {
            last24h: windowFor(primary.id, 1),
            last7d: windowFor(primary.id, 7),
            last30d: windowFor(primary.id, 30),
            last90d: windowFor(primary.id, 90)
          },
          recentChecks: (checksStmt.all(primary.id, new Date(now.getTime() - DAY_MS).toISOString()) as any[]).map(mapCheck)
        };
      });
    } finally {
      db.close();
    }
  }
  
  /** Checks for one page since `since`, oldest first. */
  getPageChecks(pageId: string, since: Date): PublicPageCheck[] {
    const db = getReadModelDatabase();
    try {
      return (db.prepare(
        'SELECT * FROM public_page_checks WHERE page_id = ? AND checked_at >= ? ORDER BY checked_at ASC'
      ).all(pageId, since.toISOString()) as any[]).map(mapCheck);
    } finally {
      db.close();
    }
  }
  
  /** Checks for every page of a site since `since`, oldest first. */
  getSiteChecks(siteId: string, since: Date): PublicPageCheck[] {
    const db = getReadModelDatabase();
    try {
      return (db.prepare(
        'SELECT * FROM public_page_checks WHERE site_id = ? AND checked_at >= ? ORDER BY checked_at ASC'
      ).all(siteId, since.toISOString()) as any[]).map(mapCheck);
    } finally {
      db.close();
    }
  }
  
  /** Uptime over the standard windows for a page, or for a whole site (all its pages). */
  getUptime(scope: { pageId: string } | { siteId: string }, now: Date = new Date()): UptimeSummary {
    const db = getReadModelDatabase();
    try {
      const column = 'pageId' in scope ? 'page_id' : 'site_id';
      const id = 'pageId' in scope ? scope.pageId : scope.siteId;
      const stmt = db.prepare(`
        SELECT COUNT(*) AS checks,
               SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online
        FROM public_page_checks
        WHERE ${column} = ? AND checked_at >= ?
      `);
      const windowFor = (days: number): UptimeWindow => {
        const row = stmt.get(id, new Date(now.getTime() - days * DAY_MS).toISOString()) as { checks: number; online: number | null };
        const checks = row.checks ?? 0;
        const online = row.online ?? 0;
        return { uptime: checks > 0 ? online / checks : null, checks, online, offline: checks - online };
      };
      return { last24h: windowFor(1), last7d: windowFor(7), last30d: windowFor(30), last90d: windowFor(90) };
    } finally {
      db.close();
    }
  }
  
  /** One row per UTC day for the last `days` days (days without checks are included with null uptime). */
  getDailyUptime(scope: { pageId: string } | { siteId: string }, days: number, now: Date = new Date()): DailyUptime[] {
    const db = getReadModelDatabase();
    try {
      const column = 'pageId' in scope ? 'page_id' : 'site_id';
      const id = 'pageId' in scope ? scope.pageId : scope.siteId;
      const since = new Date(now.getTime() - (days - 1) * DAY_MS);
      since.setUTCHours(0, 0, 0, 0);
      const rows = db.prepare(`
        SELECT substr(checked_at, 1, 10) AS date,
               COUNT(*) AS checks,
               SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online
        FROM public_page_checks
        WHERE ${column} = ? AND checked_at >= ?
        GROUP BY substr(checked_at, 1, 10)
      `).all(id, since.toISOString()) as { date: string; checks: number; online: number }[];
      const byDate = new Map(rows.map(r => [r.date, r]));
      const result: DailyUptime[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
        const row = byDate.get(date);
        const checks = row?.checks ?? 0;
        const online = row?.online ?? 0;
        result.push({ date, checks, online, offline: checks - online, uptime: checks > 0 ? online / checks : null });
      }
      return result;
    } finally {
      db.close();
    }
  }
  
  /** Contiguous runs of offline checks for a page, newest first. */
  getIncidents(pageId: string, since: Date, now: Date = new Date()): Incident[] {
    const checks = this.getPageChecks(pageId, since);
    const incidents: Incident[] = [];
    let current: { start: PublicPageCheck; last: PublicPageCheck; count: number; reasons: Map<string, number> } | null = null;
    
    const reasonOf = (c: PublicPageCheck) =>
      c.blocked ? 'Bot challenge / access denied' : c.error ? c.error : c.responseCode ? `HTTP ${c.responseCode}` : 'No response';
    const close = (endedAt: Date | null) => {
      if (!current) return;
      const end = endedAt ?? now;
      const reason = Array.from(current.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
      incidents.push({
        pageId,
        startedAt: current.start.checkedAt,
        endedAt,
        durationMs: Math.max(0, end.getTime() - current.start.checkedAt.getTime()),
        checks: current.count,
        reason
      });
      current = null;
    };
    
    for (const check of checks) {
      if (check.status === 'offline') {
        if (!current) current = { start: check, last: check, count: 0, reasons: new Map() };
        current.count += 1;
        current.last = check;
        const r = reasonOf(check);
        current.reasons.set(r, (current.reasons.get(r) ?? 0) + 1);
      } else if (current) {
        close(check.checkedAt);
      }
    }
    close(null);
    return incidents.reverse();
  }
  
  /**
   * Hand out sites that are due, marking them claimed so a second checker (or
   * a crashed one's retry) does not get the same site until the claim expires.
   */
  claimDueSites(limit: number, now: Date = new Date()): PublicSiteTask[] {
    const db = getReadModelDatabase();
    try {
      const nowIso = now.toISOString();
      const claimCutoff = new Date(now.getTime() - CLAIM_TIMEOUT_MS).toISOString();
      const pick = db.prepare(`
        SELECT id, slug, name FROM public_sites
        WHERE active = 1
          AND (next_check_at IS NULL OR next_check_at <= ?)
          AND (claimed_at IS NULL OR claimed_at < ?)
        ORDER BY next_check_at ASC
        LIMIT ?
      `);
      const claim = db.prepare('UPDATE public_sites SET claimed_at = ? WHERE id = ? AND (claimed_at IS NULL OR claimed_at < ?)');
      const pages = db.prepare('SELECT id, slug, name, url FROM public_pages WHERE site_id = ? AND active = 1 ORDER BY position ASC');
      
      const tasks: PublicSiteTask[] = [];
      db.transaction(() => {
        for (const row of pick.all(nowIso, claimCutoff, limit) as { id: string; slug: string; name: string }[]) {
          if (claim.run(nowIso, row.id, claimCutoff).changes === 0) continue;
          const pageRows = pages.all(row.id) as { id: string; slug: string; name: string; url: string }[];
          if (pageRows.length === 0) continue;
          tasks.push({
            siteId: row.id,
            slug: row.slug,
            name: row.name,
            pages: pageRows.map(p => ({ pageId: p.id, slug: p.slug, name: p.name, url: p.url }))
          });
        }
      })();
      return tasks;
    } finally {
      db.close();
    }
  }
  
  /** Page ids that exist and are active for a site (used to validate checker reports). */
  getActivePageIds(siteId: string): Set<string> {
    const db = getReadModelDatabase();
    try {
      const rows = db.prepare('SELECT id FROM public_pages WHERE site_id = ? AND active = 1').all(siteId) as { id: string }[];
      return new Set(rows.map(r => r.id));
    } finally {
      db.close();
    }
  }
}
