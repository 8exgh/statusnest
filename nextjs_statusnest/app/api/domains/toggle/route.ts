import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionFromRequest } from '@/lib/infrastructure/security/auth';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { QueryBus } from '@/lib/cqrs/query-bus';

export async function POST(request: NextRequest) {
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
    
    const { domainId, active } = await request.json();
    
    if (!domainId) {
      return NextResponse.json(
        { error: 'Domain ID is required' },
        { status: 400 }
      );
    }
    
    if (typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'Active status must be a boolean' },
        { status: 400 }
      );
    }
    
    // Verify the domain belongs to the user
    const queryBus = new QueryBus();
    const domain = await queryBus.getDomainById(domainId);
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }
    
    if (domain.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    const commandBus = new CommandBus();
    
    await commandBus.dispatch({
      userId: user.id,
      aggregateId: domainId,
      type: active ? 'ActivateDomain' : 'DeactivateDomain',
      payload: {
        domainId,
        domain: domain.domain
      }
    });
    
    return NextResponse.json({
      success: true,
      domainId,
      active
    });
  } catch (error) {
    console.error('Domain toggle error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle domain status' },
      { status: 500 }
    );
  }
}