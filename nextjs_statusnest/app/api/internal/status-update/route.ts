import { NextRequest } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { QueryBus } from '@/lib/cqrs/query-bus';

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