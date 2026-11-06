import { NextRequest, NextResponse } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { getSummaryDeliveryStatus } from '@/lib/email/reporting-projection';
import { runSummaryAutomation } from '@/lib/email/summary-automation';

export const dynamic = 'force-dynamic';

// Read-only delivery receipts for deployment verification.
export async function GET(request: NextRequest) {
  return withInternalAuth(request, async () => createInternalResponse({ reports: getSummaryDeliveryStatus() }));
}

// The deploy job can run the same timer robot immediately after its health check.
// Repeating the request never forces a second send or resets a weekly schedule.
export async function POST(request: NextRequest) {
  return withInternalAuth(request, async () => {
    try {
      await runSummaryAutomation();
      return createInternalResponse({ success: true, reports: getSummaryDeliveryStatus() });
    } catch (error) {
      console.error('Weekly summary automation failed:', error);
      return NextResponse.json({ error: 'Weekly summary automation failed; will retry' }, { status: 500 });
    }
  });
}
