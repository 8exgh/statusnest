import { NextRequest } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import { PUBLIC_MONITORS_USER_ID } from '@/lib/public-monitors/seed';
import { initializeApp } from '@/lib/startup';
import type { PublicPageCheckResult } from '@/types';

function clampText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function optionalInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

/**
 * The browser checker's report for one site visit: a result per page. The
 * next visit is scheduled (with jitter) by the command handler. This path
 * never contacts AlertTray — public monitors are for the status pages only.
 */
export async function POST(request: NextRequest) {
  initializeApp();
  return withInternalAuth(request, async (req) => {
    try {
      const body = await req.json();
      const { siteId, checkedAt, checker } = body;
      const rawResults = Array.isArray(body.results) ? body.results : [];
      
      if (!siteId || rawResults.length === 0) {
        return createInternalResponse({ error: 'siteId and at least one result are required' });
      }
      
      const activePages = new PublicMonitorQueries().getActivePageIds(siteId);
      if (activePages.size === 0) {
        return createInternalResponse({ error: 'Unknown or inactive site' });
      }
      
      const results: PublicPageCheckResult[] = [];
      for (const r of rawResults) {
        if (!r || typeof r.pageId !== 'string' || !activePages.has(r.pageId)) continue;
        if (r.status !== 'online' && r.status !== 'offline') continue;
        results.push({
          pageId: r.pageId,
          status: r.status,
          responseCode: optionalInt(r.responseCode),
          responseTimeMs: optionalInt(r.responseTimeMs),
          finalUrl: clampText(r.finalUrl, 2048),
          title: clampText(r.title, 300),
          error: clampText(r.error, 500),
          blocked: Boolean(r.blocked)
        });
      }
      
      if (results.length === 0) {
        return createInternalResponse({ error: 'No valid page results for this site' });
      }
      
      await new CommandBus().dispatch({
        userId: PUBLIC_MONITORS_USER_ID,
        aggregateId: siteId,
        type: 'RecordPublicSiteCheck',
        payload: {
          siteId,
          checkedAt,
          checker: {
            engine: clampText(checker?.engine, 50) ?? 'unknown',
            version: clampText(checker?.version, 50),
            userAgent: clampText(checker?.userAgent, 300),
            display: clampText(checker?.display, 50)
          },
          results
        }
      });
      
      const offline = results.filter(r => r.status === 'offline').map(r => r.pageId);
      if (offline.length > 0) {
        console.log(`🔴 Public monitor ${siteId}: ${offline.join(', ')} unavailable`);
      }
      
      return createInternalResponse({ success: true, recorded: results.length });
    } catch (error) {
      console.error('Public check result error:', error);
      return createInternalResponse({ error: 'Failed to record public check' });
    }
  });
}
