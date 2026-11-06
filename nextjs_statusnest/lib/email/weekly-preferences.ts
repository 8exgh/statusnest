import { createHmac, timingSafeEqual } from 'crypto';
import type { Command, Event } from '@/types';
import { absoluteUrl } from '@/lib/site-url';
import { WEEK_MS } from './uptime-report';

function signature(userId: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required for unsubscribe links');
  return createHmac('sha256', secret).update(`weekly-summary-unsubscribe:v1:${userId}`).digest('hex');
}

export function unsubscribeLinks(userId: string) {
  const query = new URLSearchParams({ userId, token: signature(userId) });
  return { page: absoluteUrl(`/unsubscribe/weekly?${query}`), api: absoluteUrl(`/api/weekly-summary-unsubscribe?${query}`) };
}

export function validUnsubscribeToken(userId: unknown, token: unknown): userId is string {
  if (typeof userId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(userId)
    || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(signature(userId), 'hex'), Buffer.from(token, 'hex'));
}

export function weeklySummariesEnabled(history: Event[]): boolean {
  const preference = [...history].reverse().find(e => e.eventType === 'WeeklySummaryPreferenceChangedEvent');
  return preference?.eventData.enabled ?? true;
}

export function decideWeeklyPreference(command: Command, history: Event[], now: Date): Event[] {
  if (!history.some(e => e.eventType === 'WeeklySummaryScheduleStartedEvent')) throw new Error('Weekly summaries have not been started');
  const { enabled, source } = command.payload;
  if (typeof enabled !== 'boolean') throw new Error('Weekly summary preference must be a boolean');
  if (weeklySummariesEnabled(history) === enabled) return [];
  return [{
    aggregateId: command.aggregateId!, aggregateType: 'WeeklySummary',
    eventType: 'WeeklySummaryPreferenceChangedEvent', eventVersion: 1,
    eventData: { userId: command.userId, enabled, source, timestamp: now.toISOString(),
      // Re-enabling starts a fresh week rather than sending a backlog.
      ...(enabled ? { nextDueAt: new Date(now.getTime() + WEEK_MS).toISOString() } : {}) },
    createdAt: now, sequenceNumber: 0
  }];
}

export function suppressWeeklyEmail(requested: Event, schedule: Event[]): boolean {
  return requested.eventData.kind === 'weekly-summary' && (!weeklySummariesEnabled(schedule)
    || schedule.some(e => e.eventType === 'WeeklySummaryPreferenceChangedEvent'
      && e.eventData.enabled === false && e.sequenceNumber > requested.sequenceNumber));
}
