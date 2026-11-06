import type Database from 'better-sqlite3';
import type { Event } from '@/types';
import { EventStore } from '@/lib/cqrs/event-store';
import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';
import { summarizeDomain, type Observation, type ObservationKind, type UptimeReport } from './uptime-report';

export function ensureReportingSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reporting_checkpoints (user_id TEXT PRIMARY KEY, sequence INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reporting_domains (
      user_id TEXT NOT NULL, domain_id TEXT NOT NULL, domain TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(user_id, domain_id)
    );
    CREATE TABLE IF NOT EXISTS reporting_observations (
      user_id TEXT NOT NULL, sequence INTEGER NOT NULL, domain_id TEXT NOT NULL, at TEXT NOT NULL, kind TEXT NOT NULL,
      PRIMARY KEY(user_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS idx_reporting_observations ON reporting_observations(user_id, domain_id, at);
    CREATE TABLE IF NOT EXISTS weekly_summary_schedule (
      user_id TEXT PRIMARY KEY, email TEXT NOT NULL, next_due_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_summary_reports (
      notification_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, period_start TEXT NOT NULL,
      period_end TEXT NOT NULL, snapshot TEXT NOT NULL
    );
  `);
}

export function projectReportingEvent(db: Database.Database, event: Event, userId: string): void {
  const data = event.eventData;
  const at = new Date(data.timestamp ?? event.createdAt).toISOString();
  if (event.eventType === 'WeeklySummaryScheduleStartedEvent') {
    db.prepare('INSERT OR IGNORE INTO weekly_summary_schedule (user_id, email, next_due_at) VALUES (?, ?, ?)')
      .run(userId, data.email, data.nextDueAt);
  } else if (event.eventType === 'WeeklySummaryPreparedEvent') {
    db.prepare('UPDATE weekly_summary_schedule SET next_due_at = ? WHERE user_id = ?').run(data.nextDueAt, userId);
    db.prepare('INSERT OR IGNORE INTO weekly_summary_reports VALUES (?, ?, ?, ?, ?)')
      .run(data.notificationId, userId, data.report.periodStart, data.report.periodEnd, JSON.stringify(data.report));
  }
  if (event.eventType === 'DomainRegisteredEvent') {
    db.prepare('INSERT OR IGNORE INTO reporting_domains VALUES (?, ?, ?, ?)').run(userId, data.domainId, data.domain, at);
  }
  const kinds: Record<string, ObservationKind | undefined> = {
    DomainRegisteredEvent: 'registered', DomainActivatedEvent: 'activated', DomainDeactivatedEvent: 'deactivated',
    DomainStatusCheckedEvent: data.status === 'online' || data.status === 'offline' ? data.status : undefined
  };
  const kind = kinds[event.eventType];
  if (kind) db.prepare('INSERT OR IGNORE INTO reporting_observations VALUES (?, ?, ?, ?, ?)')
    .run(userId, event.sequenceNumber, data.domainId, at, kind);
}

/** Independent checkpoint backfills historical checks without resetting delivery projections. */
export async function catchUpReporting(userId: string): Promise<void> {
  const db = getReadModelDatabase();
  const store = new EventStore();
  try {
    ensureReportingSchema(db);
    for (;;) {
      const row = db.prepare('SELECT sequence FROM reporting_checkpoints WHERE user_id = ?').get(userId) as { sequence: number } | undefined;
      const events = await store.getEvents(userId, row?.sequence ?? 0, undefined, 1000);
      if (!events.length) return;
      db.transaction(() => {
        const current = db.prepare('SELECT sequence FROM reporting_checkpoints WHERE user_id = ?').get(userId) as { sequence: number } | undefined;
        for (const event of events) if (event.sequenceNumber > (current?.sequence ?? 0)) projectReportingEvent(db, event, userId);
        db.prepare(`INSERT INTO reporting_checkpoints VALUES (?, ?)
          ON CONFLICT(user_id) DO UPDATE SET sequence = MAX(sequence, excluded.sequence)`)
          .run(userId, events[events.length - 1].sequenceNumber);
      }).immediate();
      if (events.length < 1000) return;
    }
  } finally { db.close(); }
}

export interface SummaryDue { userId: string; email: string; nextDueAt: string }

export function getDueSummaries(now: Date): SummaryDue[] {
  const db = getReadModelDatabase();
  try {
    ensureReportingSchema(db);
    return db.prepare(`SELECT user_id AS userId, email, next_due_at AS nextDueAt
      FROM weekly_summary_schedule WHERE next_due_at <= ? ORDER BY next_due_at, user_id`)
      .all(now.toISOString()) as SummaryDue[];
  } finally { db.close(); }
}

export function queryUptimeReport(userId: string, periodStart: string, periodEnd: string): UptimeReport {
  const db = getReadModelDatabase();
  try {
    ensureReportingSchema(db);
    return db.transaction(() => {
      const checkpoint = db.prepare('SELECT sequence FROM reporting_checkpoints WHERE user_id = ?').get(userId) as { sequence: number } | undefined;
      const domains = db.prepare('SELECT domain_id, domain, created_at FROM reporting_domains WHERE user_id = ? AND created_at < ? ORDER BY domain, domain_id')
        .all(userId, periodEnd) as { domain_id: string; domain: string; created_at: string }[];
      const during = db.prepare(`SELECT at, sequence, kind FROM reporting_observations
        WHERE user_id = ? AND domain_id = ? AND at >= ? AND at < ? ORDER BY at, sequence`);
      const before = db.prepare(`SELECT at, sequence, kind FROM reporting_observations
        WHERE user_id = ? AND domain_id = ? AND at < ? AND kind IN (?, ?, ?) ORDER BY at DESC, sequence DESC LIMIT 1`);
      return { periodStart, periodEnd, sourceSequence: checkpoint?.sequence ?? 0, domains: domains.map(d => {
        // Carry in the last lifecycle event and last check, in their original order.
        const control = before.get(userId, d.domain_id, periodStart, 'registered', 'activated', 'deactivated') as Observation | undefined;
        const check = before.get(userId, d.domain_id, periodStart, 'online', 'offline', 'offline') as Observation | undefined;
        const observations = [control, check, ...during.all(userId, d.domain_id, periodStart, periodEnd) as Observation[]]
          .filter((o): o is Observation => Boolean(o));
        return summarizeDomain(d.domain_id, d.domain, d.created_at, observations, periodStart, periodEnd);
      }) };
    })();
  } finally { db.close(); }
}

export function getSummaryDeliveryStatus() {
  const db = getReadModelDatabase();
  try {
    ensureReportingSchema(db);
    return db.prepare(`SELECT r.notification_id AS notificationId, r.user_id AS userId,
      r.period_start AS periodStart, r.period_end AS periodEnd,
      COALESCE(e.status, 'awaiting projection') AS status, e.sent_at AS sentAt, e.last_error AS lastError
      FROM weekly_summary_reports r LEFT JOIN email_notifications e ON e.id = r.notification_id
      ORDER BY r.period_end DESC, r.user_id`).all();
  } finally { db.close(); }
}
