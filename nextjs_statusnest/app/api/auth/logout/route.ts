import { NextRequest, NextResponse } from 'next/server';
import { invalidateSession, getSessionFromRequest } from '@/lib/infrastructure/security/auth';

export async function POST(request: NextRequest) {
  try {
    const token = getSessionFromRequest(request);
    
    if (token) {
      await invalidateSession(token);
    }
    
    const response = NextResponse.json({ success: true });
    
    response.cookies.delete('session');
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}