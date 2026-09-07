import { DomainMonitor, Task } from '@/types';
import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';
import type { EmailTask } from '@/lib/email/notifications';

export class QueryBus {
  async getPendingEmails(): Promise<EmailTask[]> {
    const db = getReadModelDatabase();
    try {
      // Queries are read-only; the claim command checks the authoritative stream.
      return db.prepare(`
        SELECT id AS notificationId, user_id AS userId, recipient AS "to", subject, body AS text
        FROM email_notifications
        WHERE status != 'sent' AND next_attempt_at <= ? AND (lease_until IS NULL OR lease_until <= ?)
        ORDER BY next_attempt_at, created_at, id LIMIT 10
      `).all(new Date().toISOString(), new Date().toISOString()) as EmailTask[];
    } finally {
      db.close();
    }
  }

  async getUserDomains(userId: string): Promise<DomainMonitor[]> {
    const db = getReadModelDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM domain_monitors 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(userId) as any[];
    
    db.close();
    
    return rows.map(mapDomainMonitorRow);
  }
  
  async getPendingChecks(): Promise<Task[]> {
    const db = getReadModelDatabase();
    
    const stmt = db.prepare(`
      SELECT id, domain, user_id 
      FROM domain_monitors 
      WHERE active = 1 
        AND (next_check_at IS NULL OR next_check_at <= ?)
      ORDER BY next_check_at ASC
      LIMIT 100
    `);
    
    const rows = stmt.all(new Date().toISOString()) as any[];
    
    db.close();
    
    return rows.map(row => ({
      domainId: row.id,
      domain: row.domain,
      userId: row.user_id
    }));
  }
  
  async getDomainById(domainId: string): Promise<DomainMonitor | null> {
    const db = getReadModelDatabase();
    
    const stmt = db.prepare('SELECT * FROM domain_monitors WHERE id = ?');
    const row = stmt.get(domainId) as any;
    
    db.close();
    
    if (!row) {
      return null;
    }
    
    return mapDomainMonitorRow(row);
  }
}

function parseChannels(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function mapDomainMonitorRow(row: any): DomainMonitor {
  return {
    id: row.id,
    domain: row.domain,
    userId: row.user_id,
    status: row.status || 'unknown',
    active: Boolean(row.active),
    lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : undefined,
    nextCheckAt: row.next_check_at ? new Date(row.next_check_at) : undefined,
    responseCode: row.response_code,
    responseTimeMs: row.response_time_ms,
    lastAlertAt: row.last_alert_at ? new Date(row.last_alert_at) : undefined,
    lastAlertChannels: parseChannels(row.last_alert_channels),
    lastAlertError: row.last_alert_error || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}
