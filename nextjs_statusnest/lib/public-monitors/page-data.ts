import { cache } from 'react';
import type { PublicPage, PublicSite } from '@/types';
import { PublicMonitorQueries, type Incident, type UptimeSummary, type DailyUptime } from './queries';
import type { PublicPageCheck } from '@/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface IncidentWithPage extends Incident {
  pageName: string;
  pageHref: string;
}

export interface PageDetailData {
  site: PublicSite;
  page: PublicPage;
  uptime: UptimeSummary;
  checks24h: PublicPageCheck[];
  daily90: DailyUptime[];
  incidents30d: IncidentWithPage[];
}

export interface SiteDetailData extends Omit<PageDetailData, 'page'> {
  /** Primary page, or null when the site has no active pages. */
  primary: PublicPage | null;
  pageUptime24h: Map<string, UptimeSummary['last24h']>;
}

/** Deduplicated per request (generateMetadata and the page both call it). */
export const loadSite = cache((slug: string): PublicSite | null => new PublicMonitorQueries().getSiteBySlug(slug));

function incidentsFor(queries: PublicMonitorQueries, site: PublicSite, page: PublicPage, since: Date, now: Date): IncidentWithPage[] {
  return queries.getIncidents(page.id, since, now).map((inc) => ({
    ...inc,
    pageName: page.name,
    pageHref: `/status/${site.slug}/${page.slug}`
  }));
}

export const loadSiteDetail = cache((slug: string, nowMs: number): SiteDetailData | null => {
  const now = new Date(nowMs);
  const site = loadSite(slug);
  if (!site) return null;
  const queries = new PublicMonitorQueries();
  const primary = site.pages[0] ?? null;
  const since24h = new Date(nowMs - DAY_MS);
  const since30d = new Date(nowMs - 30 * DAY_MS);
  const empty = { uptime: null, checks: 0, online: 0, offline: 0 };
  
  const pageUptime24h = new Map<string, UptimeSummary['last24h']>();
  let uptime: UptimeSummary = { last24h: empty, last7d: empty, last30d: empty, last90d: empty };
  for (const page of site.pages) {
    const u = queries.getUptime({ pageId: page.id }, now);
    pageUptime24h.set(page.id, u.last24h);
    if (primary && page.id === primary.id) uptime = u;
  }
  
  const incidents30d = site.pages
    .flatMap((page) => incidentsFor(queries, site, page, since30d, now))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  
  return {
    site,
    primary,
    uptime,
    checks24h: primary ? queries.getPageChecks(primary.id, since24h) : [],
    daily90: primary ? queries.getDailyUptime({ pageId: primary.id }, 90, now) : [],
    incidents30d,
    pageUptime24h
  };
});

export const loadPageDetail = cache((siteSlug: string, pageSlug: string, nowMs: number): PageDetailData | null => {
  const now = new Date(nowMs);
  const site = loadSite(siteSlug);
  if (!site) return null;
  const page = site.pages.find((p) => p.slug === pageSlug);
  if (!page) return null;
  const queries = new PublicMonitorQueries();
  return {
    site,
    page,
    uptime: queries.getUptime({ pageId: page.id }, now),
    checks24h: queries.getPageChecks(page.id, new Date(nowMs - DAY_MS)),
    daily90: queries.getDailyUptime({ pageId: page.id }, 90, now),
    incidents30d: incidentsFor(queries, site, page, new Date(nowMs - 30 * DAY_MS), now)
  };
});

/** The request clock, truncated to the minute so cached loaders dedupe within a render. */
export function requestNow(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}
