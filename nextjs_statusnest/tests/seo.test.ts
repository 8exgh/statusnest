import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicMetadata, accountMetadata, statusHref, statusDescription } from '@/lib/seo';
import { verifyState } from '@/lib/public-monitors/format';

const dataPath = mkdtempSync(join(tmpdir(), 'statusnest-seo-test-'));
process.env.DATABASE_PATH = dataPath;
process.env.NEXT_PHASE = 'phase-production-build';
process.env.NEXT_PUBLIC_SITE_URL = 'https://statusnest.com';
process.env.PUBLIC_MONITORS = 'on';
after(() => rmSync(dataPath, { recursive: true, force: true }));

test('public metadata uses one canonical identity and complete social metadata; account screens are noindex', () => {
  const metadata = publicMetadata('GitHub status', statusDescription('GitHub'), '/status/github');
  assert.equal(metadata.alternates?.canonical, 'https://statusnest.com/status/github');
  assert.equal(metadata.openGraph?.url, metadata.alternates?.canonical);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
  assert.equal((metadata.twitter as { card: string }).card, 'summary_large_image');
  assert.equal((metadata.openGraph?.images as { url: string }[])[0].url, 'https://statusnest.com/opengraph-image');
  assert.deepEqual(accountMetadata('Profile').robots, { index: false, follow: false });
  assert.deepEqual(publicMetadata('Not checked yet', '', '/status/new', false).robots, { index: false, follow: true });
});

test('primary-page internal links consolidate to the overview while secondary pages remain distinct', () => {
  assert.equal(statusHref('github', { slug: 'home', position: 0 }), '/status/github');
  assert.equal(statusHref('github', { slug: 'explore', position: 1 }), '/status/github/explore');
});

test('overdue observations are neither current uptime nor downtime; fresh bot blocks remain separate', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
  assert.equal(verifyState('online', false, minutesAgo(40), now, 'primary'), 'online');
  assert.equal(verifyState('online', false, minutesAgo(41), now, 'primary'), 'stale');
  assert.equal(verifyState('offline', false, minutesAgo(121), now, 'standard'), 'stale');
  assert.equal(verifyState('offline', false, minutesAgo(119), now, 'standard'), 'offline');
  assert.equal(verifyState('online', true, minutesAgo(5), now, 'primary'), 'blocked');
  assert.equal(verifyState('online', true, minutesAgo(121), now, 'standard'), 'stale');
  assert.equal(verifyState('online', false, undefined, now, 'primary'), 'unknown');
});

async function seed() {
  const { getReadModelDatabase } = await import('@/lib/infrastructure/database/connection');
  const db = getReadModelDatabase();
  const timestamp = '2026-11-06T12:00:00.000Z';
  for (const slug of ['github', 'unchecked', 'secondary-only']) {
    db.prepare(`INSERT OR IGNORE INTO public_sites
      (id, slug, name, url, description, category, tier, active, status, last_checked_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Example service', 'developer', 'primary', 1, 'online', ?, ?, ?)`)
      .run(slug, slug, slug === 'github' ? 'GitHub' : slug, `https://${slug}.example`, slug === 'unchecked' ? null : timestamp, timestamp, timestamp);
    for (const [position, page] of ['home', 'explore', 'not-checked'].entries()) {
      const checked = page !== 'not-checked' && slug !== 'unchecked' && !(slug === 'secondary-only' && position === 0);
      db.prepare(`INSERT OR IGNORE INTO public_pages
        (id, site_id, slug, name, url, position, active, status, last_checked_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 'online', ?, ?, ?)`)
        .run(`${slug}/${page}`, slug, page, page === 'home' ? slug : `Explore ${slug}`, `https://${slug}.example/${page}`, position, checked ? timestamp : null, timestamp, timestamp);
    }
  }
  db.close();
  return { getReadModelDatabase, timestamp };
}

test('sitemap contains checked canonical URLs, excludes forms and duplicates, and respects private deployments', async () => {
  const { timestamp } = await seed();
  const { default: sitemap } = await import('@/app/sitemap');
  const entries = sitemap();
  const urls = entries.map(entry => entry.url);
  assert(urls.includes('https://statusnest.com/status/github'));
  assert(urls.includes('https://statusnest.com/status/github/explore'));
  assert(urls.includes('https://statusnest.com/how-it-works'));
  assert(!urls.some(url => /\/(home|not-checked|login|register|profile|dashboard)$/.test(url)));
  assert(!urls.some(url => url.includes('/unchecked') || url.includes('/secondary-only')));
  assert.equal(new Set(urls).size, urls.length);
  assert.equal((entries[0].lastModified as Date).toISOString(), timestamp);
  process.env.PUBLIC_MONITORS = 'off';
  try { assert.deepEqual(sitemap(), []); } finally { process.env.PUBLIC_MONITORS = 'on'; }
});

test('sitemap omits fabricated modification dates when there are no observations, and robots lets crawlers read noindex', async () => {
  const { getReadModelDatabase } = await seed();
  const { default: sitemap } = await import('@/app/sitemap');
  const { default: robots } = await import('@/app/robots');
  const db = getReadModelDatabase();
  db.exec('UPDATE public_sites SET last_checked_at = NULL; UPDATE public_pages SET last_checked_at = NULL;'); db.close();
  assert(sitemap().every(entry => entry.lastModified === undefined));
  const rules = robots().rules as { disallow: string[] }[];
  assert(!rules[0].disallow.includes('/profile'));
  assert(!rules[0].disallow.includes('/dashboard'));
  assert(rules[0].disallow.includes('/api/'));
});
