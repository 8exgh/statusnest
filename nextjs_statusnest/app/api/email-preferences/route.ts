import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, validateSession } from '@/lib/infrastructure/security/auth';
import { catchUpReporting, getWeeklySummaryPreference } from '@/lib/email/reporting-projection';
import { setWeeklySummaryPreference } from '@/lib/email/preference-service';

export const dynamic = 'force-dynamic';

async function authenticate(request: NextRequest) {
  const token = getSessionFromRequest(request);
  return token ? validateSession(token) : null;
}

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await catchUpReporting(user.id);
  return NextResponse.json({ weeklySummary: getWeeklySummaryPreference(user.id) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: NextRequest) {
  const user = await authenticate(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Enabled must be true or false' }, { status: 400 });
  try {
    const weeklySummary = await setWeeklySummaryPreference(user.id, body.enabled, 'profile');
    return NextResponse.json({ weeklySummary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not save weekly email preference' }, { status: 500 });
  }
}
