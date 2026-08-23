import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getSessionFromRequest } from '@/lib/infrastructure/security/auth';
import { ContactDetailsService } from '@/lib/infrastructure/users/contact-details';
import { isValidEmail, normalizePhoneNumber } from '@/lib/alerts/contact';
import { AlertTrayClient } from '@/lib/alerts/alerttray-client';
import { OFFLINE_ALERT_SEVERITY } from '@/lib/alerts/offline-alerts';
import { CommandBus } from '@/lib/cqrs/command-bus';

async function authenticate(request: NextRequest) {
  const token = getSessionFromRequest(request);
  if (!token) return null;
  return validateSession(token);
}

/** How offline alerts reach the user, for display on the profile page. */
function alertingInfo() {
  return {
    configured: new AlertTrayClient().isConfigured(),
    severity: OFFLINE_ALERT_SEVERITY,
    // Mirrors AlertTray's routing policy for `critical`.
    channels: ['call', 'sms'],
    fallbackChannel: 'email'
  };
}

/** Current user's alert contact details. */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const details = ContactDetailsService.getForUser(user.id);
    
    return NextResponse.json({
      contact: {
        email: details?.email ?? user.email,
        phoneNumber: details?.phoneNumber ?? null,
        notificationEmail: details?.notificationEmail ?? null
      },
      alerting: alertingInfo()
    });
  } catch (error) {
    console.error('Get contact details error:', error);
    return NextResponse.json({ error: 'Failed to get contact details' }, { status: 500 });
  }
}

/** Update the phone number (E.164) and/or the address offline alerts are emailed to. */
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    
    let phoneNumber: string | null = null;
    if (typeof body.phoneNumber === 'string' && body.phoneNumber.trim() !== '') {
      phoneNumber = normalizePhoneNumber(body.phoneNumber);
      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'Phone number must be in international format with country code, e.g. +14155552671' },
          { status: 400 }
        );
      }
    }
    
    let notificationEmail: string | null = null;
    if (typeof body.notificationEmail === 'string' && body.notificationEmail.trim() !== '') {
      const candidate: string = body.notificationEmail.trim().toLowerCase();
      if (!isValidEmail(candidate)) {
        return NextResponse.json({ error: 'Invalid notification email address' }, { status: 400 });
      }
      notificationEmail = candidate;
    }
    
    ContactDetailsService.update(user.id, { phoneNumber, notificationEmail });
    
    // Record the change in the user's event stream.
    const commandBus = new CommandBus();
    await commandBus.dispatch({
      userId: user.id,
      aggregateId: user.id,
      type: 'UpdateContactDetails',
      payload: { phoneNumber, notificationEmail }
    });
    
    return NextResponse.json({
      success: true,
      contact: {
        email: user.email,
        phoneNumber,
        notificationEmail
      },
      alerting: alertingInfo()
    });
  } catch (error) {
    console.error('Update contact details error:', error);
    return NextResponse.json({ error: 'Failed to update contact details' }, { status: 500 });
  }
}
