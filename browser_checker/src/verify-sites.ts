import { readFileSync, writeFileSync } from 'fs';
import type { BrowserContext } from 'playwright';
import { BROWSER_CONTEXT_OPTIONS, BrowserChecker, visitPage } from './checker';

/**
 * Vet candidate sites before adding them to the public monitors.
 *
 * Visits every page of every candidate in the same real, headed Chromium the
 * production checker uses, applying the same verdict rules (visitPage), so a
 * site that passes here is one the live checker will record as online. Unlike
 * production this fans pages out concurrently — it is a one-off sweep, not the
 * polite 5–20 minute cadence.
 *
 *   node dist/verify-sites.js candidates.json [--out report.json] [--concurrency 5]
 */

interface CandidatePage {
  slug: string;
  name: string;
  url: string;
}

interface CandidateSite {
  slug: string;
  name: string;
  url: string;
  description?: string;
  category?: string;
  tier?: string;
  pages: CandidatePage[];
}

interface PageReport {
  siteSlug: string;
  pageSlug: string;
  name: string;
  url: string;
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs?: number;
  finalUrl?: string;
  title?: string;
  error?: string;
  blocked: boolean;
  /** Final URL is on a different registrable-ish host than the requested one. */
  redirectedOffHost: boolean;
}

interface SiteReport {
  slug: string;
  name: string;
  category?: string;
  tier?: string;
  pagesOk: number;
  pagesTotal: number;
  anyBlocked: boolean;
  verdict: 'pass' | 'fail';
}

interface Options {
  input: string;
  out: string;
  concurrency: number;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  let out: string | undefined;
  let concurrency = Number(process.env.VERIFY_CONCURRENCY) || 5;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[++i];
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else if (arg === '--concurrency') {
      concurrency = Number(argv[++i]);
    } else if (arg.startsWith('--concurrency=')) {
      concurrency = Number(arg.slice('--concurrency='.length));
    } else {
      positional.push(arg);
    }
  }

  const input = positional[0];
  if (!input) {
    console.error('Usage: node dist/verify-sites.js <candidates.json> [--out report.json] [--concurrency 5]');
    process.exit(2);
  }
  if (!Number.isFinite(concurrency) || concurrency < 1) {
    console.error(`Invalid concurrency: ${concurrency}`);
    process.exit(2);
  }
  return { input, out: out ?? input.replace(/\.json$/, '') + '-report.json', concurrency };
}

/**
 * Closing a context or the browser can hang on a page that refuses to go away
 * (stuck beforeunload, live media stream). Teardown must never cost us a
 * completed sweep, so every close is bounded.
 */
async function closeSafely(label: string, close: () => Promise<unknown>, ms = 15_000): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      close().catch(() => undefined),
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          console.warn(`(${label} did not close within ${ms}ms; continuing)`);
          resolve();
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
}

/** Same-brand check: either host ends with the other (apple.com vs support.apple.com). */
function sameBrand(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

function groupBySite(results: PageReport[]): Map<string, PageReport[]> {
  const byPage = new Map<string, PageReport[]>();
  for (const r of results) {
    const list = byPage.get(r.siteSlug) ?? [];
    list.push(r);
    byPage.set(r.siteSlug, list);
  }
  return byPage;
}

function rollUp(sites: CandidateSite[], results: PageReport[]): SiteReport[] {
  const byPage = groupBySite(results);
  return sites.map(site => {
    const pages = byPage.get(site.slug) ?? [];
    const pagesOk = pages.filter(p => p.status === 'online' && !p.blocked).length;
    return {
      slug: site.slug,
      name: site.name,
      category: site.category,
      tier: site.tier,
      pagesOk,
      pagesTotal: site.pages.length,
      anyBlocked: pages.some(p => p.blocked),
      verdict: pagesOk === site.pages.length ? 'pass' : 'fail',
    };
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const sites = JSON.parse(readFileSync(options.input, 'utf8')) as CandidateSite[];

  const queue: { site: CandidateSite; page: CandidatePage }[] = [];
  for (const site of sites) {
    for (const page of site.pages) {
      queue.push({ site, page });
    }
  }

  console.log(`Verifying ${sites.length} sites / ${queue.length} pages with concurrency ${options.concurrency}`);

  const checker = new BrowserChecker();
  const browser = await checker.getBrowser();
  console.log(`Browser: ${browser.version()} (${checker.display})`);

  const results: PageReport[] = [];
  let next = 0;
  let done = 0;

  const writeReport = (): void => {
    writeFileSync(options.out, JSON.stringify({
      generatedAt: new Date().toISOString(),
      complete: done === queue.length,
      pagesDone: done,
      pagesTotal: queue.length,
      browser: browser.version(),
      display: checker.display,
      sites: rollUp(sites, results),
      pages: results,
    }, null, 1));
  };

  const worker = async (): Promise<void> => {
    let context: BrowserContext | null = null;
    try {
      context = await browser.newContext({ ...BROWSER_CONTEXT_OPTIONS });
      while (true) {
        const index = next++;
        if (index >= queue.length) return;
        const { site, page: candidate } = queue[index];
        const pageId = `${site.slug}/${candidate.slug}`;
        const page = await context.newPage();
        try {
          const result = await visitPage(page, pageId, candidate.url);
          const finalHost = hostOf(result.finalUrl);
          const report: PageReport = {
            siteSlug: site.slug,
            pageSlug: candidate.slug,
            name: candidate.name,
            url: candidate.url,
            status: result.status,
            responseCode: result.responseCode,
            responseTimeMs: result.responseTimeMs,
            finalUrl: result.finalUrl,
            title: result.title,
            error: result.error,
            blocked: Boolean(result.blocked),
            redirectedOffHost: Boolean(finalHost) && !sameBrand(finalHost, hostOf(candidate.url)),
          };
          results.push(report);
          done++;
          const code = result.responseCode ?? '-';
          const ms = result.responseTimeMs !== undefined ? `${result.responseTimeMs}ms` : 'n/a';
          const flags = [result.blocked ? 'BLOCKED' : '', report.redirectedOffHost ? `→ ${finalHost}` : '']
            .filter(Boolean).join(' ');
          const suffix = result.error ? ` — ${result.error}` : '';
          console.log(`[${done}/${queue.length}] ${pageId}: ${result.status} ${code} (${ms}) ${flags}${suffix}`.trimEnd());
          // Periodic flush: results survive a hang, a kill or a crash.
          if (done % 25 === 0) writeReport();
        } finally {
          await closeSafely(`page ${pageId}`, () => page.close(), 5_000);
        }
      }
    } finally {
      if (context) await closeSafely('browser context', () => context!.close());
    }
  };

  await Promise.all(Array.from({ length: Math.min(options.concurrency, queue.length) }, () => worker()));

  // ---- rollups ----
  const byPage = groupBySite(results);
  const siteReports = rollUp(sites, results);

  // Written before teardown: the results are the point, closing the browser is not.
  writeReport();
  console.log(`Report written: ${options.out}`);

  await closeSafely('browser', () => checker.close());

  // ---- summary ----
  const passing = siteReports.filter(s => s.verdict === 'pass');
  const failing = siteReports.filter(s => s.verdict === 'fail');
  const online = results.filter(r => r.status === 'online').length;
  const blocked = results.filter(r => r.blocked).length;

  console.log('');
  console.log('='.repeat(78));
  console.log(`Sites : ${passing.length} pass / ${failing.length} fail (of ${siteReports.length})`);
  console.log(`Pages : ${online} online / ${results.length - online} offline (${blocked} blocked) of ${results.length}`);
  console.log(`Report: ${options.out}`);

  if (failing.length) {
    console.log('');
    console.log('FAILING SITES');
    for (const site of failing) {
      console.log(`  ${site.slug} (${site.pagesOk}/${site.pagesTotal} ok${site.anyBlocked ? ', BLOCKED' : ''})`);
      for (const page of (byPage.get(site.slug) ?? []).filter(p => p.status !== 'online' || p.blocked)) {
        console.log(`      ${page.pageSlug}: ${page.responseCode ?? '-'} ${page.blocked ? '[blocked] ' : ''}${page.error ?? ''} ${page.url}`);
        if (page.finalUrl && page.finalUrl !== page.url) console.log(`          final: ${page.finalUrl}`);
        if (page.title) console.log(`          title: ${page.title}`);
      }
    }
  }

  const offHost = results.filter(r => r.redirectedOffHost && r.status === 'online');
  if (offHost.length) {
    console.log('');
    console.log('REDIRECTED OFF-HOST (still online)');
    for (const page of offHost) {
      console.log(`  ${page.siteSlug}/${page.pageSlug}: ${page.url} → ${page.finalUrl} (${page.title ?? ''})`);
    }
  }

  const slow = results.filter(r => (r.responseTimeMs ?? 0) > 5000);
  if (slow.length) {
    console.log('');
    console.log('SLOW (>5s)');
    for (const page of slow.sort((a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0))) {
      console.log(`  ${page.siteSlug}/${page.pageSlug}: ${page.responseTimeMs}ms`);
    }
  }
}

main().then(() => {
  // Chromium can leave handles behind; the report is on disk, so exit cleanly.
  process.exit(0);
}).catch(error => {
  console.error('verify-sites failed:', error);
  process.exit(1);
});
