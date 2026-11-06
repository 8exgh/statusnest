import type { Command, Event } from '@/types';
import { absoluteUrl } from '@/lib/site-url';
import { customerEmail, emailId } from './customer-emails';
import { WEEK_MS, renderUptimeReport, type UptimeReport } from './uptime-report';

export const summaryAggregate = (userId: string) => `weekly-summary-${userId}`;
export const SUMMARY_COMMANDS = new Set(['StartWeeklySummaries', 'PrepareWeeklySummary']);

export function startSummarySchedule(userId: string, email: string, now: Date, immediate: boolean): Event {
  return {
    aggregateId: summaryAggregate(userId), aggregateType: 'WeeklySummary',
    eventType: 'WeeklySummaryScheduleStartedEvent', eventVersion: 1,
    eventData: { userId, email, nextDueAt: new Date(now.getTime() + (immediate ? 0 : WEEK_MS)).toISOString(), timestamp: now.toISOString() },
    createdAt: now, sequenceNumber: 0
  };
}

export function decideSummaryCommand(command: Command, history: Event[], now: Date, report?: UptimeReport): Event[] {
  const started = history.find(e => e.eventType === 'WeeklySummaryScheduleStartedEvent');
  if (command.type === 'StartWeeklySummaries') {
    if (started) return [];
    if (typeof command.payload.email !== 'string' || !command.payload.email.includes('@')) throw new Error('Account email required');
    return [startSummarySchedule(command.userId, command.payload.email, now, true)];
  }
  if (!started) throw new Error('Weekly summaries have not been started');
  const previous = [...history].reverse().find(e => e.eventType === 'WeeklySummaryPreparedEvent');
  const dueAt = previous?.eventData.nextDueAt ?? started.eventData.nextDueAt;
  // An old view or a repeated timer tick must never request the same report twice.
  if (command.payload.dueAt !== dueAt || Date.parse(dueAt) > now.getTime()) return [];
  if (!report || Date.parse(report.periodEnd) > now.getTime()
    || Date.parse(report.periodEnd) < Date.parse(dueAt)
    || Date.parse(report.periodEnd) - Date.parse(report.periodStart) !== WEEK_MS) throw new Error('Invalid weekly report window');
  const notificationId = emailId(`weekly-summary:${command.userId}:${dueAt}`);
  const nextDueAt = new Date(Date.parse(dueAt) + (Math.floor((now.getTime() - Date.parse(dueAt)) / WEEK_MS) + 1) * WEEK_MS).toISOString();
  return [{
    aggregateId: summaryAggregate(command.userId), aggregateType: 'WeeklySummary',
    eventType: 'WeeklySummaryPreparedEvent', eventVersion: 1,
    eventData: { userId: command.userId, dueAt, nextDueAt, notificationId, report, timestamp: now.toISOString() },
    createdAt: now, sequenceNumber: 0
  }, customerEmail(command.userId, started.eventData.email, 'weekly-summary', `weekly-summary:${command.userId}:${dueAt}`,
    `StatusNest weekly report — ${report.periodEnd.slice(0, 10)}`,
    renderUptimeReport(report, absoluteUrl('/dashboard')), now)];
}
