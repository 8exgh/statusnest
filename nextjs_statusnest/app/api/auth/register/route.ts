import { NextRequest, NextResponse } from 'next/server';
import { createUser, createSession, findUserByEmail } from '@/lib/infrastructure/security/auth';
import { EventStore } from '@/lib/cqrs/event-store';
import { getUserWriteDatabase } from '@/lib/infrastructure/database/connection';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }
    
    const user = await createUser(email, password);
    
    getUserWriteDatabase(user.id).close();
    
    const eventStore = new EventStore();
    await eventStore.appendEvents(user.id, [{
      aggregateId: user.id,
      aggregateType: 'User',
      eventType: 'UserRegisteredEvent',
      eventVersion: 1,
      eventData: {
        userId: user.id,
        email: user.email,
        timestamp: user.createdAt
      },
      createdAt: user.createdAt,
      sequenceNumber: 0
    }]);
    
    const { session, token } = await createSession(user.id);
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}