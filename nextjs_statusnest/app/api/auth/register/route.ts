import { NextRequest, NextResponse } from 'next/server';
import { createUser, createSession, findUserByEmail } from '@/lib/infrastructure/security/auth';
import { CommandBus } from '@/lib/cqrs/command-bus';

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
    
    await new CommandBus().dispatch({
      userId: user.id,
      aggregateId: user.id,
      type: 'RecordUserRegistration',
      payload: { email: user.email, registeredAt: user.createdAt }
    });
    
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
