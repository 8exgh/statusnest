import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { CheckerInfo, PageCheckResult, PublicSiteTask } from './api-client';
import { describeBlock, isBotBlocked } from './block-detection';

/**
 * Visits a site's pages in a real Chromium. Headed by default — the browser
 * draws into the Xvfb display that entrypoint.sh starts in the container, so
 * sites see an ordinary desktop Chrome (real user agent, real rendering), not
 * a headless one. Set BROWSER_HEADLESS=1 to run without a display locally.
 */

export const NAVIGATION_TIMEOUT_MS = Number(process.env.NAVIGATION_TIMEOUT_MS) || 30_000;
export const LOAD_SETTLE_TIMEOUT_MS = 10_000;
const HEADLESS = process.env.BROWSER_HEADLESS === '1';

/**
 * Context options every visit uses. Deliberately NOT overriding the user
 * agent: headed Chromium's real UA is the point. Shared so one-off tools
 * (verify-sites) see exactly what the production checker sees.
 */
export const BROWSER_CONTEXT_OPTIONS = {
  viewport: { width: 1366, height: 768 },
  locale: 'en-US',
  extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
} as const;

export interface SiteVisit {
  checkedAt: string;
  checker: CheckerInfo;
  results: PageCheckResult[];
}

export class BrowserChecker {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  get display(): CheckerInfo['display'] {
    return HEADLESS ? 'headless' : 'xvfb';
  }

  /** Launch (or re-launch after a crash) the single shared Chromium. */
  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    if (!this.launching) {
      this.launching = (async () => {
        if (!HEADLESS && !process.env.DISPLAY) {
          console.warn('⚠️  BROWSER_HEADLESS is not set and DISPLAY is empty — Chromium needs a display (use xvfb-run) or set BROWSER_HEADLESS=1');
        }
        console.log(`Launching Chromium (${HEADLESS ? 'headless' : `headed, DISPLAY=${process.env.DISPLAY}`})...`);
        const browser = await chromium.launch({ headless: HEADLESS });
        browser.on('disconnected', () => {
          // Only unexpected: close() clears this.browser before closing.
          if (this.browser === browser) {
            console.warn('Chromium disconnected; it will be relaunched on the next check');
            this.browser = null;
          }
        });
        console.log(`Chromium ${browser.version()} ready`);
        this.browser = browser;
        return browser;
      })().finally(() => {
        this.launching = null;
      });
    }
    return this.launching;
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = null;
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }

  /** Visit every page of one site, sequentially, in a fresh browser context. */
  async visitSite(task: PublicSiteTask): Promise<SiteVisit> {
    const checkedAt = new Date().toISOString();
    const browser = await this.getBrowser();
    const context = await browser.newContext({ ...BROWSER_CONTEXT_OPTIONS });

    let userAgent: string | undefined;
    const results: PageCheckResult[] = [];
    try {
      for (const pageTask of task.pages) {
        const page = await context.newPage();
        try {
          if (!userAgent) {
            userAgent = await page.evaluate(() => navigator.userAgent).catch(() => undefined);
          }
          const result = await visitPage(page, pageTask.pageId, pageTask.url);
          results.push(result);
          const code = result.responseCode ?? '-';
          const ms = result.responseTimeMs !== undefined ? `${result.responseTimeMs}ms` : 'n/a';
          const suffix = result.error ? ` — ${result.error}` : '';
          console.log(`${pageTask.pageId}: ${result.status} ${code} (${ms})${suffix}`);
        } finally {
          await page.close().catch(() => undefined);
        }
      }
    } finally {
      await context.close().catch(() => undefined);
    }

    return {
      checkedAt,
      checker: {
        engine: 'chromium',
        version: browser.version(),
        userAgent,
        display: this.display,
      },
      results,
    };
  }
}

/**
 * Visit one URL and decide online/offline. The single source of truth for what
 * counts as available — the poll loop and the verify-sites tool both call it,
 * so a site vetted offline here is one the live checker would record offline.
 */
export async function visitPage(page: Page, pageId: string, url: string): Promise<PageCheckResult> {
  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
    const responseTimeMs = Date.now() - started;

    // Let the page settle a little so challenge pages have rendered their text.
    await page.waitForLoadState('load', { timeout: LOAD_SETTLE_TIMEOUT_MS }).catch(() => undefined);

    const responseCode = response?.status();
    const finalUrl = page.url();
    const title = (await page.title().catch(() => ''))?.trim().slice(0, 300) || undefined;
    const bodyText = await page
      .evaluate(() => (document.body?.innerText ?? '').slice(0, 2000))
      .catch(() => '');

    const blocked = isBotBlocked({ status: responseCode, title, bodyText });

    if (!response) {
      // Navigations to about:blank or same-document navigations have no response.
      return { pageId, status: 'offline', responseTimeMs, finalUrl, title, error: 'No HTTP response', blocked: false };
    }

    const code = response.status();

    if (blocked) {
      return { pageId, status: 'offline', responseCode: code, responseTimeMs, finalUrl, title, error: describeBlock(code), blocked: true };
    }

    if (code >= 200 && code < 400) {
      return { pageId, status: 'online', responseCode: code, responseTimeMs, finalUrl, title, blocked: false };
    }

    return { pageId, status: 'offline', responseCode: code, responseTimeMs, finalUrl, title, error: `HTTP ${code}`, blocked: false };
  } catch (error) {
    const responseTimeMs = Date.now() - started;
    return {
      pageId,
      status: 'offline',
      responseTimeMs,
      finalUrl: safeUrl(page),
      error: describeNavigationError(error, responseTimeMs),
      blocked: false,
    };
  }
}

function safeUrl(page: Page): string | undefined {
  try {
    const url = page.url();
    return url && url !== 'about:blank' ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Turn Playwright's verbose navigation errors into a short, stable reason. */
function describeNavigationError(error: unknown, elapsedMs: number): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Timeout \d+ms exceeded/i.test(message) || (error instanceof Error && error.name === 'TimeoutError')) {
    return `Timeout after ${NAVIGATION_TIMEOUT_MS}ms`;
  }
  const net = message.match(/net::ERR_[A-Z0-9_]+/);
  if (net) {
    return net[0];
  }
  const firstLine = message.split('\n')[0].replace(/^page\.goto:\s*/i, '').trim();
  return firstLine.slice(0, 200) || `Navigation failed after ${elapsedMs}ms`;
}
