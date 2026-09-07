import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import type { Command, Event } from '@/types';

export const NOTIFICATION_RECIPIENT = 'sbennett@8examples.com';
export const EMAIL_LEASE_MS = 5 * 60 * 1000;

export interface EmailTask {
  notificationId: string;
  userId: string;
  to: string;
  subject: string;
  text: string;
}

export class EmailTaskConflict extends Error {}

/** Appended in the same transaction as the registration, only for new activity. */
export function requestEmail(
  userId: string,
  email: string,
  timestamp: Date,
  website?: { domainId: string; domain: string }
): Event {
  const notificationId = randomUUID();
  return {
    aggregateId: notificationId,
    aggregateType: 'EmailNotification',
    eventType: 'EmailNotificationRequestedEvent',
    eventVersion: 1,
    eventData: {
      notificationId,
      userId,
      kind: website ? 'website-added' : 'signup',
      to: NOTIFICATION_RECIPIENT,
      subject: website ? 'StatusNest: new website added' : 'StatusNest: new signup',
      text: [
        website ? 'A website was added to a StatusNest account.' : 'A new account signed up for StatusNest.',
        '',
        `Account email: ${email}`,
        `Account ID: ${userId}`,
        ...(website ? [`Website: ${website.domain}`, `Website ID: ${website.domainId}`] : []),
        `Time (UTC): ${timestamp.toISOString()}`
      ].join('\n'),
      timestamp
    },
    createdAt: timestamp,
    sequenceNumber: 0
  };
}

export const EMAIL_COMMANDS = new Set(['ClaimEmailNotification', 'RecordEmailNotificationSent', 'RecordEmailNotificationFailed']);

/** Runs against the event stream inside a write transaction, never a stale projection. */
export function decideEmailCommand(command: Command, history: Event[], now = new Date()): Event[] {
  const requested = history.find(event => event.eventType === 'EmailNotificationRequestedEvent');
  if (!requested || requested.eventData.userId !== command.userId) {
    throw new EmailTaskConflict('Email task not found');
  }
  const { attemptId } = command.payload;
  if (typeof attemptId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(attemptId)) {
    throw new EmailTaskConflict('Invalid attempt ID');
  }
  const last = history[history.length - 1];
  const sent = history.find(event => event.eventType === 'EmailNotificationSentEvent');
  // Acknowledgements can be retried safely when the HTTP response was lost.
  const resultType = command.type === 'RecordEmailNotificationSent'
    ? 'EmailNotificationSentEvent' : 'EmailNotificationFailedEvent';
  if (command.type !== 'ClaimEmailNotification' && history.some(event =>
    event.eventType === resultType && event.eventData.attemptId === attemptId)) return [];
  if (sent) throw new EmailTaskConflict('Email already sent');

  const timestamp = now.toISOString();
  let eventType: string;
  let data: Record<string, unknown>;
  if (command.type === 'ClaimEmailNotification') {
    if (last.eventType === 'EmailNotificationClaimedEvent' && new Date(last.eventData.leaseUntil) > now) {
      throw new EmailTaskConflict('Email already claimed');
    }
    if (last.eventType === 'EmailNotificationFailedEvent' && new Date(last.eventData.nextAttemptAt) > now) {
      throw new EmailTaskConflict('Email retry is not due');
    }
    const attempt = history.filter(event => event.eventType === 'EmailNotificationClaimedEvent').length + 1;
    if (history.some(event => event.eventType === 'EmailNotificationClaimedEvent' && event.eventData.attemptId === attemptId)) {
      throw new EmailTaskConflict('Attempt ID already used');
    }
    eventType = 'EmailNotificationClaimedEvent';
    data = { attempt, leaseUntil: new Date(now.getTime() + EMAIL_LEASE_MS).toISOString() };
  } else {
    if (last.eventType !== 'EmailNotificationClaimedEvent' || last.eventData.attemptId !== attemptId) {
      throw new EmailTaskConflict('Email claim is no longer current');
    }
    if (command.type === 'RecordEmailNotificationSent') {
      eventType = 'EmailNotificationSentEvent';
      data = { messageId: `<${command.aggregateId}@notifications.statusnest.com>` };
    } else {
      eventType = 'EmailNotificationFailedEvent';
      const delay = Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(last.eventData.attempt - 1, 6));
      data = {
        error: String(command.payload.error || 'Email delivery failed').slice(0, 1000),
        nextAttemptAt: new Date(now.getTime() + delay).toISOString()
      };
    }
  }
  return [{
    aggregateId: command.aggregateId!,
    aggregateType: 'EmailNotification',
    eventType,
    eventVersion: 1,
    eventData: { notificationId: command.aggregateId, attemptId, ...data, timestamp },
    createdAt: now,
    sequenceNumber: 0
  }];
}

export function projectEmailEvent(db: Database.Database, event: Event, userId: string): void {
  const data = event.eventData;
  switch (event.eventType) {
    case 'EmailNotificationRequestedEvent':
      db.prepare(`
        INSERT INTO email_notifications (id, user_id, recipient, subject, body, status, attempts, next_attempt_at, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(event.aggregateId, userId, data.to, data.subject, data.text, event.createdAt.toISOString(), event.createdAt.toISOString());
      break;
    case 'EmailNotificationClaimedEvent':
      db.prepare(`UPDATE email_notifications SET status = 'processing', attempts = ?, attempt_id = ?, lease_until = ? WHERE id = ?`)
        .run(data.attempt, data.attemptId, data.leaseUntil, event.aggregateId);
      break;
    case 'EmailNotificationSentEvent':
      db.prepare(`UPDATE email_notifications SET status = 'sent', sent_at = ?, lease_until = NULL, last_error = NULL WHERE id = ?`)
        .run(data.timestamp, event.aggregateId);
      break;
    case 'EmailNotificationFailedEvent':
      db.prepare(`UPDATE email_notifications SET status = 'pending', next_attempt_at = ?, lease_until = NULL, last_error = ? WHERE id = ?`)
        .run(data.nextAttemptAt, data.error, event.aggregateId);
      break;
  }
}
