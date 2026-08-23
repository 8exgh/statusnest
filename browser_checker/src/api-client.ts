import { createHmac } from 'crypto';

/**
 * Internal StatusNest API client. Same HMAC scheme as the domain-check
 * background processor: `X-API-Key` carries the shared secret and
 * `X-Signature` is the hex SHA-256 HMAC of the raw request body (the empty
 * string for GET) keyed with that secret.
 */

export interface PublicPageTask {
  pageId: string;
  slug: string;
  name: string;
  url: string;
}

export interface PublicSiteTask {
  siteId: string;
  slug: string;
  name: string;
  pages: PublicPageTask[];
}

export type CheckStatus = 'online' | 'offline';

export interface PageCheckResult {
  pageId: string;
  status: CheckStatus;
  responseCode?: number;
  responseTimeMs?: number;
  finalUrl?: string;
  title?: string;
  error?: string;
  blocked?: boolean;
}

export interface CheckerInfo {
  engine: 'chromium';
  version?: string;
  userAgent?: string;
  display: 'xvfb' | 'headless';
}

export interface SiteCheckReport {
  siteId: string;
  checkedAt: string;
  checker: CheckerInfo;
  results: PageCheckResult[];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = (process.env.STATUSNEST_API_URL || 'http://localhost:3000').replace(/\/+$/, '');
    this.apiKey = process.env.API_KEY || '';
    assert(this.apiKey, 'API_KEY environment variable is required');
  }

  get url(): string {
    return this.baseUrl;
  }

  private sign(body: string): string {
    return createHmac('sha256', this.apiKey).update(body).digest('hex');
  }

  /** Sites whose jittered check time has come. The server claims them on hand-out. */
  async getPublicTasks(): Promise<PublicSiteTask[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/public-tasks`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Signature': this.sign(''),
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as { tasks?: PublicSiteTask[]; error?: string };
      if (data.error) {
        console.error(`Task poll returned an error: ${data.error}`);
      }
      return data.tasks ?? [];
    } catch (error) {
      console.error('Error getting public tasks:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /** Report one site visit (a result per page). Throws on failure so the caller can log it. */
  async reportSiteCheck(report: SiteCheckReport): Promise<number> {
    const body = JSON.stringify(report);
    const response = await fetch(`${this.baseUrl}/api/internal/public-check-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Signature': this.sign(body),
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { success?: boolean; recorded?: number; error?: string };
    if (!data.success) {
      throw new Error(data.error || 'Server did not accept the report');
    }
    return data.recorded ?? report.results.length;
  }
}
