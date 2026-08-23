import { NextRequest } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import { initializeApp } from '@/lib/startup';

// With ~100 sites the checker needs roughly 3 site visits per minute; handing
// out 10 per poll (every 30s) leaves plenty of headroom for bursts, and each
// site is claimed so two checkers never collide.
const MAX_SITES_PER_POLL = 10;

/**
 * Sites whose jittered check time has come, for the browser checker. Each
 * site is claimed on hand-out (claim expires after CLAIM_TIMEOUT_MS) so two
 * checkers never visit the same site at once.
 */
export async function GET(request: NextRequest) {
  initializeApp();
  return withInternalAuth(request, async () => {
    try {
      const tasks = new PublicMonitorQueries().claimDueSites(MAX_SITES_PER_POLL);
      return createInternalResponse({ tasks });
    } catch (error) {
      console.error('Get public tasks error:', error);
      return createInternalResponse({ error: 'Failed to get public tasks', tasks: [] });
    }
  });
}
