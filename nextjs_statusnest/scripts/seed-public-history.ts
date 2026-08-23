/**
 * Dev tooling: back-fill ~90 days of plausible check history for every site
 * in PUBLIC_SITES so the status pages and charts have something to show.
 *
 *   DATABASE_PATH=/path/to/data npx tsx scripts/seed-public-history.ts
 *
 * Goes through the real command path (RecordPublicSiteCheck), so the running
 * app's projection engine turns the events into read-model rows a few seconds
 * later. Refuses to run if history already exists. Density is tiered (every
 * ~3 h for days 8–90, hourly for days 2–7, every ~13 min for the last 24 h) to
 * keep the event count around 10k.
 */
import { CommandBus } from '@/lib/cqrs/command-bus';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import { PUBLIC_MONITORS_USER_ID } from '@/lib/public-monitors/seed';
import { PUBLIC_SITES, publicPageId, publicSiteId } from '@/lib/public-monitors/sites';
import type { PublicPageCheckResult } from '@/types';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Deterministic PRNG so re-runs on a fresh DB produce the same picture. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Outage {
  siteSlug: string;
  /** Restrict to one page slug; otherwise every page of the site. */
  pageSlug?: string;
  start: number;
  end: number;
  kind: 'error' | 'timeout' | 'blocked';
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_PATH) {
    console.warn('DATABASE_PATH is not set — seeding ./data');
  }
  const now = Date.now();
  const queries = new PublicMonitorQueries();
  const firstPage = publicPageId(PUBLIC_SITES[0].slug, PUBLIC_SITES[0].pages[0].slug);
  const existing = queries.getPageChecks(firstPage, new Date(now - 90 * DAY)).length;
  if (existing > 100) {
    console.error(`Refusing to seed: ${firstPage} already has ${existing} checks in the last 90 days.`);
    process.exit(1);
  }

  const outages: Outage[] = [
    { siteSlug: 'discord', start: now - 3 * DAY - 2 * HOUR, end: now - 3 * DAY - 80 * MIN, kind: 'error' },
    { siteSlug: 'steam', start: now - 20 * DAY - 15 * HOUR, end: now - 20 * DAY - 13 * HOUR, kind: 'timeout' },
    { siteSlug: 'github', pageSlug: 'docs', start: now - 10 * DAY - 12 * HOUR, end: now - 10 * DAY - 1 * HOUR, kind: 'blocked' },
    { siteSlug: 'netflix', start: now - 5 * HOUR - 20 * MIN, end: now - 4 * HOUR - 55 * MIN, kind: 'error' },
  ];

  const commandBus = new CommandBus();
  let visits = 0;

  for (const [siteIndex, site] of PUBLIC_SITES.entries()) {
    const rand = mulberry32(1000 + siteIndex);
    const siteId = publicSiteId(site.slug);
    const baseMs = 250 + siteIndex * 60;
    const times: number[] = [];

    let t = now - 90 * DAY;
    while (t < now) {
      times.push(t);
      const age = now - t;
      const interval = age > 7 * DAY ? 180 * MIN : age > DAY ? 60 * MIN : 13 * MIN;
      t += interval + (rand() - 0.5) * interval * 0.3;
    }

    for (const checkedAt of times) {
      const results: PublicPageCheckResult[] = site.pages.map((page, pageIndex) => {
        const pageId = publicPageId(site.slug, page.slug);
        const outage = outages.find(
          (o) => o.siteSlug === site.slug && (!o.pageSlug || o.pageSlug === page.slug) && checkedAt >= o.start && checkedAt < o.end
        );
        const noise = (rand() + rand() + rand() - 1.5) * 120;
        const spike = rand() < 0.02 ? 2.5 : 1;
        const responseTimeMs = Math.max(80, Math.round((baseMs + pageIndex * 90 + noise) * spike));
        if (outage?.kind === 'error') {
          return { pageId, status: 'offline', responseCode: 503, responseTimeMs: Math.round(responseTimeMs * 0.6), error: 'HTTP 503' };
        }
        if (outage?.kind === 'timeout') {
          return { pageId, status: 'offline', responseTimeMs: 30000, error: 'Navigation timeout of 30000 ms exceeded' };
        }
        if (outage?.kind === 'blocked') {
          return { pageId, status: 'offline', responseCode: 403, responseTimeMs, blocked: true, title: 'Just a moment...' };
        }
        if (rand() < 0.002) {
          return { pageId, status: 'offline', responseCode: 502, responseTimeMs, error: 'HTTP 502' };
        }
        return { pageId, status: 'online', responseCode: pageIndex === 0 && siteIndex % 3 === 1 ? 301 : 200, responseTimeMs, finalUrl: page.url, title: page.name };
      });

      await commandBus.dispatch({
        userId: PUBLIC_MONITORS_USER_ID,
        aggregateId: siteId,
        type: 'RecordPublicSiteCheck',
        payload: {
          siteId,
          checkedAt: new Date(checkedAt).toISOString(),
          checker: { engine: 'chromium', version: 'seed', display: 'xvfb' },
          results,
        },
      });
      visits += 1;
    }
    console.log(`${site.slug}: ${times.length} visits seeded`);
  }

  console.log(`Done: ${visits} site visits (${visits * 3} page checks). The projection engine will catch up within a few seconds.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
