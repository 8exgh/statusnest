import { NextRequest } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { QueryBus } from '@/lib/cqrs/query-bus';

export async function GET(request: NextRequest) {
  return withInternalAuth(request, async () => {
    try {
      const queryBus = new QueryBus();
      const tasks = await queryBus.getPendingChecks();
      
      return createInternalResponse({ tasks });
    } catch (error) {
      console.error('Get tasks error:', error);
      return createInternalResponse({ 
        error: 'Failed to get tasks',
        tasks: []
      });
    }
  });
}