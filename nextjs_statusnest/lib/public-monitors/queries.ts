import type { PublicMonitorStatus, PublicPage, PublicPageCheck, PublicSite } from '@/types';
import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';
import { asCheckTier, CLAIM_TIMEOUT_MS, type CheckTier } from './schedule';

/**
 * Read-side queries for the public monitors. Everything the SEO pages and the
 * browser checker need comes from here; nothing here writes events.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cap on segments in a site card's 24-hour bar, so a flapping site cannot bloat the index. */
const MAX_SPARK_RUNS = 24;

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
  /** Checks we could actually complete (blocked ones excluded). */
  checks: number;
  online: number;
  offline: number;
  /** Checks that hit a bot challenge; they count toward no uptime figure. */
  blocked: number;
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

/** The three uptime windows the index and home page actually render. */
export interface OverviewUptime {
  last24h: UptimeWindow;
  last7d: UptimeWindow;
  last30d: UptimeWindow;
}

/**
 * One segment of the compact 24-hour bar on a site card: a run of consecutive
 * checks that shared a status. Runs (rather than one mark per check) keep the
 * index tiny — an all-green site is a single segment instead of ~100 rects.
 */
export interface SparkRun {
  status: 'online' | 'offline';
  /** Number of checks in the run; used as the segment's relative width. */
  weight: number;
}

/** Everything the index / home page needs for one site, fetched in a single connection. */
export interface PublicSiteOverview {
  site: PublicSite;
  /** The primary page (position 0), or null if the site has no active pages. */
  primary: PublicPage | null;
  uptime: OverviewUptime;
  /** Primary-page check history for the last 24 h, oldest first, run-length encoded. */
  spark: SparkRun[];
  /** Total primary-page checks in the last 24 h (0 → nothing to draw). */
  spark24hChecks: number;
  /**
   * The newest primary-page check hit a bot challenge, so `site.status` is the
   * last status we could actually observe rather than a current reading.
   */
  latestBlocked: boolean;
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
    category: row.category ?? 'other',
    tier: asCheckTier(row.tier),
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
   * All active sites with their primary page's uptime windows and a compact
   * 24-hour history, in four set-based queries rather than a handful per site
   * (the index renders 100 sites on every request).
   */
  getSitesOverview(now: Date = new Date()): PublicSiteOverview[] {
    const db = getReadModelDatabase();
    try {
      const siteRows = db.prepare('SELECT * FROM public_sites WHERE active = 1 ORDER BY position ASC, name ASC').all() as any[];
      if (siteRows.length === 0) return [];

      const pageRows = db.prepare(
        'SELECT * FROM public_pages WHERE active = 1 ORDER BY site_id ASC, position ASC, name ASC'
      ).all() as any[];
      const pagesBySite = new Map<string, PublicPage[]>();
      for (const row of pageRows) {
        const list = pagesBySite.get(row.site_id);
        if (list) list.push(mapPage(row));
        else pagesBySite.set(row.site_id, [mapPage(row)]);
      }

      const primaryIds = siteRows
        .map(row => pagesBySite.get(row.id)?.[0]?.id)
        .filter((id): id is string => Boolean(id));
      const empty: UptimeWindow = { uptime: null, checks: 0, online: 0, offline: 0 };
      const emptyUptime: OverviewUptime = { last24h: empty, last7d: empty, last30d: empty };

      const windows = new Map<string, OverviewUptime>();
      const runs = new Map<string, SparkRun[]>();
      const totals = new Map<string, number>();

      if (primaryIds.length > 0) {
        const placeholders = primaryIds.map(() => '?').join(',');
        const since24h = new Date(now.getTime() - DAY_MS).toISOString();
        const since7d = new Date(now.getTime() - 7 * DAY_MS).toISOString();
        const since30d = new Date(now.getTime() - 30 * DAY_MS).toISOString();

        // One pass over the 30-day window yields all three uptime windows.
        const aggregates = db.prepare(`
          SELECT page_id,
                 SUM(CASE WHEN checked_at >= ? THEN 1 ELSE 0 END) AS checks24,
                 SUM(CASE WHEN checked_at >= ? AND status = 'online' THEN 1 ELSE 0 END) AS online24,
                 SUM(CASE WHEN checked_at >= ? THEN 1 ELSE 0 END) AS checks7,
                 SUM(CASE WHEN checked_at >= ? AND status = 'online' THEN 1 ELSE 0 END) AS online7,
                 COUNT(*) AS checks30,
                 SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) AS online30
          FROM public_page_checks
          WHERE page_id IN (${placeholders}) AND checked_at >= ? AND blocked = 0
          GROUP BY page_id
        `).all(since24h, since24h, since7d, since7d, ...primaryIds, since30d) as any[];

        const windowOf = (checks: number, online: number): UptimeWindow => ({
          uptime: checks > 0 ? online / checks : null,
          checks,
          online,
          offline: checks - online
        });
        for (const row of aggregates) {
          windows.set(row.page_id, {
            last24h: windowOf(row.checks24 ?? 0, row.online24 ?? 0),
            last7d: windowOf(row.checks7 ?? 0, row.online7 ?? 0),
            last30d: windowOf(row.checks30 ?? 0, row.online30 ?? 0)
          });
        }

        // Statuses only — enough to run-length encode the 24-hour bar.
        const recent = db.prepare(`
          SELECT page_id, status FROM public_page_checks
          WHERE page_id IN (${placeholders}) AND checked_at >= ? AND blocked = 0
          ORDER BY page_id ASC, checked_at ASC
        `).all(...primaryIds, since24h) as { page_id: string; status: 'online' | 'offline' }[];
        for (const row of recent) {
          totals.set(row.page_id, (totals.get(row.page_id) ?? 0) + 1);
          const list = runs.get(row.page_id);
          if (!list) {
            runs.set(row.page_id, [{ status: row.status, weight: 1 }]);
            continue;
          }
          const last = list[list.length - 1];
          if (last.status === row.status) last.weight += 1;
          else if (list.length < MAX_SPARK_RUNS) list.push({ status: row.status, weight: 1 });
          else last.weight += 1; // pathological flapping: stop growing the payload
        }
      }

      // Newest check per primary page — one indexed lookup, not one per site.
      const latestBlocked = new Set<string>();
      if (primaryIds.length > 0) {
        const placeholders = primaryIds.map(() => '?').join(',');
        const latest = db.prepare(`
          SELECT c.page_id AS page_id, c.blocked AS blocked
          FROM public_page_checks c
          JOIN (
            SELECT page_id, MAX(id) AS id FROM public_page_checks
            WHERE page_id IN (${placeholders}) GROUP BY page_id
          ) newest ON newest.id = c.id
        `).all(...primaryIds) as { page_id: string; blocked: number }[];
        for (const row of latest) if (row.blocked) latestBlocked.add(row.page_id);
      }

      return siteRows.map(row => {
        const pages = pagesBySite.get(row.id) ?? [];
        const site = mapSite(row, pages);
        const primary = pages[0] ?? null;
        return {
          site,
          primary,
          uptime: (primary && windows.get(primary.id)) || emptyUptime,
          spark: (primary && runs.get(primary.id)) || [],
          spark24hChecks: (primary && totals.get(primary.id)) || 0,
          latestBlocked: primary ? latestBlocked.has(primary.id) : false
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
        WHERE ${column} = ? AND checked_at >= ? AND blocked = 0
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
               SUM(CASE WHEN blocked = 0 THEN 1 ELSE 0 END) AS checks,
               SUM(CASE WHEN blocked = 0 AND status = 'online' THEN 1 ELSE 0 END) AS online,
               SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) AS blocked
        FROM public_page_checks
        WHERE ${column} = ? AND checked_at >= ?
        GROUP BY substr(checked_at, 1, 10)
      `).all(id, since.toISOString()) as { date: string; checks: number; online: number; blocked: number }[];
      const byDate = new Map(rows.map(r => [r.date, r]));
      const result: DailyUptime[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10);
        const row = byDate.get(date);
        const checks = row?.checks ?? 0;
        const online = row?.online ?? 0;
        result.push({
          date,
          checks,
          online,
          offline: checks - online,
          blocked: row?.blocked ?? 0,
          uptime: checks > 0 ? online / checks : null
        });
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
      // Could not verify (bot challenge) — carry on without opening or closing
      // an incident; we have no evidence either way.
      if (check.blocked) continue;
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
  
  /**
   * The newest check for each of `pageIds`. Used to tell whether what we are
   * showing is a current reading or the last one we could complete before a
   * bot challenge got in the way.
   */
  getLatestChecks(pageIds: string[]): Map<string, PublicPageCheck> {
    if (pageIds.length === 0) return new Map();
    const db = getReadModelDatabase();
    try {
      const placeholders = pageIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT c.* FROM public_page_checks c
        JOIN (
          SELECT page_id, MAX(id) AS id FROM public_page_checks
          WHERE page_id IN (${placeholders}) GROUP BY page_id
        ) newest ON newest.id = c.id
      `).all(...pageIds) as any[];
      return new Map(rows.map(row => [row.page_id as string, mapCheck(row)]));
    } finally {
      db.close();
    }
  }
  
  /**
   * What the result endpoint needs to validate a checker's report and schedule
   * the next visit: the site's active page ids and its cadence tier. Returns
   * null when the site is unknown or inactive.
   */
  getSiteCheckContext(siteId: string): { pageIds: Set<string>; tier: CheckTier } | null {
    const db = getReadModelDatabase();
    try {
      const site = db.prepare('SELECT tier FROM public_sites WHERE id = ? AND active = 1').get(siteId) as { tier: string | null } | undefined;
      if (!site) return null;
      const rows = db.prepare('SELECT id FROM public_pages WHERE site_id = ? AND active = 1').all(siteId) as { id: string }[];
      if (rows.length === 0) return null;
      return { pageIds: new Set(rows.map(r => r.id)), tier: asCheckTier(site.tier) };
    } finally {
      db.close();
    }
  }
}
