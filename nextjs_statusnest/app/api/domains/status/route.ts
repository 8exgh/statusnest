import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionFromRequest } from '@/lib/infrastructure/security/auth';
import { QueryBus } from '@/lib/cqrs/query-bus';

export async function GET(request: NextRequest) {
  try {
    const token = getSessionFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    const queryBus = new QueryBus();
    const domains = await queryBus.getUserDomains(user.id);
    
    return NextResponse.json({
      domains
    });
  } catch (error) {
    console.error('Get domains error:', error);
    return NextResponse.json(
      { error: 'Failed to get domains' },
      { status: 500 }
    );
  }
}