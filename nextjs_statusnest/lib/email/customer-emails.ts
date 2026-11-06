import { createHash } from 'crypto';
import type { Event } from '@/types';
import { absoluteUrl } from '@/lib/site-url';

export function emailId(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function customerEmail(userId: string, to: string, kind: string, key: string,
  subject: string, text: string, now: Date): Event {
  const notificationId = emailId(key);
  return {
    aggregateId: notificationId, aggregateType: 'EmailNotification',
    eventType: 'EmailNotificationRequestedEvent', eventVersion: 1,
    eventData: { notificationId, userId, to, kind, subject, text, timestamp: now.toISOString() },
    createdAt: now, sequenceNumber: 0
  };
}

export function onboardingEmail(userId: string, email: string, now: Date): Event {
  return customerEmail(userId, email, 'onboarding', `onboarding:${userId}`,
    'Welcome to StatusNest — let’s get your websites monitored', [
      'Welcome to StatusNest!', '',
      `Your account: ${email}`, '',
      `1. Add your first website: ${absoluteUrl('/dashboard')}`,
      'We check your active websites about every five minutes.', '',
      `2. Set up outage alerts: ${absoluteUrl('/profile')}`,
      'Add your phone number in international format for critical phone and SMS alerts through AlertTray. Without a phone number, alerts use your email.', '',
      '3. Watch for your weekly report.',
      'Every seven days we’ll email your online percentage, monitoring coverage, and detected outages. Your first report arrives in one week.', '',
      'Checks can detect an outage only when they run; unobserved time is shown separately in your report.', '',
      'The StatusNest team'
    ].join('\n'), now);
}
