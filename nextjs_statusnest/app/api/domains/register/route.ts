import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionFromRequest } from '@/lib/infrastructure/security/auth';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { v4 as uuidv4 } from 'uuid';

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
    
    const { domain } = await request.json();
    
    if (!domain) {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }
    
    const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainPattern.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }
    
    const commandBus = new CommandBus();
    const domainId = uuidv4();
    
    await commandBus.dispatch({
      userId: user.id,
      aggregateId: domainId,
      type: 'RegisterDomain',
      payload: { domain }
    });
    
    return NextResponse.json({
      success: true,
      domainId,
      domain
    });
  } catch (error) {
    console.error('Domain registration error:', error);
    return NextResponse.json(
      { error: 'Failed to register domain' },
      { status: 500 }
    );
  }
}