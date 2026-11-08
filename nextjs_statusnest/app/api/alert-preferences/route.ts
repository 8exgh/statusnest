import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, validateSession } from '@/lib/infrastructure/security/auth';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { getQuietHours } from '@/lib/alerts/quiet-hours-service';
import { parseQuietHours, quietHoursAggregate, QuietHoursValidationError } from '@/lib/alerts/quiet-hours';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

async function authenticate(request: NextRequest) {
  const token = getSessionFromRequest(request);
  return token ? validateSession(token) : null;
}

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ quietHours: getQuietHours(user.id) }, { headers });
  } catch (error) {
    console.error('Load quiet hours failed:', error);
    return NextResponse.json({ error: 'Could not load quiet hours.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    await new CommandBus().dispatch({
      userId: user.id, aggregateId: quietHoursAggregate(user.id), type: 'SetAlertQuietHours', payload: parseQuietHours(body)
    });
    return NextResponse.json({ quietHours: getQuietHours(user.id) }, { headers });
  } catch (error) {
    if (error instanceof QuietHoursValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Save quiet hours failed:', error);
    return NextResponse.json({ error: 'Could not save quiet hours.' }, { status: 500 });
  }
}
