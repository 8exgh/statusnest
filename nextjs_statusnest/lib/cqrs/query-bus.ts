import { DomainMonitor, Task } from '@/types';
import { getReadModelDatabase } from '@/lib/infrastructure/database/connection';

export class QueryBus {
  async getUserDomains(userId: string): Promise<DomainMonitor[]> {
    const db = getReadModelDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM domain_monitors 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all(userId) as any[];
    
    db.close();
    
    return rows.map(row => ({
      id: row.id,
      domain: row.domain,
      userId: row.user_id,
      status: row.status || 'unknown',
      active: Boolean(row.active),
      lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at) : undefined,
      nextCheckAt: row.next_check_at ? new Date(row.next_check_at) : undefined,
      responseCode: row.response_code,
      responseTimeMs: row.response_time_ms,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
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
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}