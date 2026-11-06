import { NextRequest, NextResponse } from 'next/server';
import { validUnsubscribeToken } from '@/lib/email/weekly-preferences';
import { setWeeklySummaryPreference } from '@/lib/email/preference-service';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };

// Header URL probes never unsubscribe. Browsers use the separate link in the email.
export async function GET() {
  return new Response('Use the unsubscribe link in your weekly report, or manage weekly emails on your Profile page.', { headers });
}

export async function POST(request: NextRequest) {
  let userId: unknown;
  let token: unknown;
  try {
    if (request.headers.get('Content-Type')?.includes('application/json')) {
      ({ userId, token } = await request.json());
    } else {
      const form = await request.formData();
      if (form.get('List-Unsubscribe') !== 'One-Click') throw new Error('Invalid one-click request');
      userId = request.nextUrl.searchParams.get('userId');
      token = request.nextUrl.searchParams.get('token');
    }
  } catch { return NextResponse.json({ error: 'Invalid unsubscribe request' }, { status: 400, headers }); }
  try {
    if (!validUnsubscribeToken(userId, token)) return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400, headers });
    const preference = await setWeeklySummaryPreference(userId, false, 'unsubscribe');
    if (!preference) return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400, headers });
    return NextResponse.json({ success: true, weeklySummary: preference }, { headers });
  } catch {
    return NextResponse.json({ error: 'Could not unsubscribe. Please try again.' }, { status: 500, headers });
  }
}
