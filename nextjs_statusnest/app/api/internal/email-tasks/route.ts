import { NextRequest, NextResponse } from 'next/server';
import { withInternalAuth, createInternalResponse } from '@/lib/infrastructure/security/api-security';
import { QueryBus } from '@/lib/cqrs/query-bus';
import { CommandBus } from '@/lib/cqrs/command-bus';
import { EmailTaskConflict } from '@/lib/email/notifications';
import { initializeApp } from '@/lib/startup';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withInternalAuth(request, async () => {
    initializeApp();
    try {
      return createInternalResponse({ tasks: await new QueryBus().getPendingEmails() });
    } catch (error) {
      console.error('Email task query failed:', error);
      return NextResponse.json({ error: 'Failed to query email tasks' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withInternalAuth(request, async req => {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const { action, notificationId, userId, attemptId, error } = body ?? {};
    const validId = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);
    if (!validId(notificationId) || !validId(userId) || !validId(attemptId)
      || !['claim', 'sent', 'failed'].includes(action)
      || (action === 'failed' && (typeof error !== 'string' || !error || error.length > 1000))) {
      return NextResponse.json({ error: 'Invalid email task command' }, { status: 400 });
    }
    const types = {
      claim: 'ClaimEmailNotification',
      sent: 'RecordEmailNotificationSent',
      failed: 'RecordEmailNotificationFailed'
    } as const;
    try {
      await new CommandBus().dispatch({
        userId,
        aggregateId: notificationId,
        type: types[action as keyof typeof types],
        payload: { attemptId, error }
      });
      return createInternalResponse({ success: true });
    } catch (error) {
      if (error instanceof EmailTaskConflict) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error('Email task command failed:', error);
      return NextResponse.json({ error: 'Failed to record email task command' }, { status: 500 });
    }
  });
}
