import { NextRequest } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { QueryBus } from '@/lib/cqrs/query-bus';
import { alertDomainOffline, shouldAlertOffline } from '@/lib/alerts/offline-alerts';

export async function POST(request: NextRequest) {
  return withInternalAuth(request, async (req) => {
    try {
      const body = await req.json();
      const { domainId, domain, status, responseCode, responseTimeMs, checkedAt } = body;
      
      if (!domainId || !domain || !status) {
        return createInternalResponse({
          error: 'Missing required fields'
        });
      }
      
      const queryBus = new QueryBus();
      const domainMonitor = await queryBus.getDomainById(domainId);
      
      if (!domainMonitor) {
        return createInternalResponse({
          error: 'Domain not found'
        });
      }
      
      const commandBus = new CommandBus();
      
      await commandBus.dispatch({
        userId: domainMonitor.userId,
        aggregateId: domainId,
        type: 'CheckDomainStatus',
        payload: {
          domainId,
          domain,
          status,
          responseCode,
          responseTimeMs
        }
      });
      
      // Alert the owner via AlertTray (phone call + SMS, or email) when the
      // domain has just gone offline. The read model held the previous status.
      // Alert problems are recorded as events and never fail the status update.
      if (shouldAlertOffline(domainMonitor.status, status)) {
        try {
          await alertDomainOffline({
            userId: domainMonitor.userId,
            domainId,
            domain,
            responseCode,
            responseTimeMs,
            checkedAt: checkedAt ? new Date(checkedAt) : new Date()
          });
        } catch (alertError) {
          console.error(`Failed to record offline alert for ${domain}:`, alertError);
        }
      }
      
      return createInternalResponse({
        success: true
      });
    } catch (error) {
      console.error('Status update error:', error);
      return createInternalResponse({
        error: 'Failed to update status'
      });
    }
  });
}
