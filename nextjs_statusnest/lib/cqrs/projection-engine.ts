import { Event, DomainMonitor, ProjectionCheckpoint } from '@/types';
import { EventStore } from './event-store';
import { getReadModelDatabase, getAllUserIds } from '@/lib/infrastructure/database/connection';

export class ProjectionEngine {
  private checkInterval = 1000;
  private intervalId: NodeJS.Timeout | null = null;
  private eventStore: EventStore;
  
  constructor() {
    this.eventStore = new EventStore();
  }
  
  async start(): Promise<void> {
    if (this.intervalId) {
      return;
    }
    
    this.intervalId = setInterval(async () => {
      try {
        await this.processProjections();
      } catch (error) {
        console.error('Error processing projections:', error);
      }
    }, this.checkInterval);
    
    await this.processProjections();
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private async processProjections(): Promise<void> {
    const userIds = getAllUserIds();
    
    for (const userId of userIds) {
      try {
        await this.processUserEvents(userId);
      } catch (error) {
        console.error(`Error processing events for user ${userId}:`, error);
      }
    }
  }
  
  private async processUserEvents(userId: string): Promise<void> {
    const db = getReadModelDatabase();
    
    const checkpointRow = db.prepare(
      'SELECT last_processed_sequence FROM projection_checkpoints WHERE user_id = ?'
    ).get(userId) as { last_processed_sequence: number } | undefined;
    
    const lastProcessedSequence = checkpointRow?.last_processed_sequence || 0;
    
    const events = await this.eventStore.getEvents(userId, lastProcessedSequence);
    
    if (events.length === 0) {
      db.close();
      return;
    }
    
    const updateCheckpoint = db.prepare(`
      INSERT INTO projection_checkpoints (user_id, last_processed_sequence, last_processed_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        last_processed_sequence = excluded.last_processed_sequence,
        last_processed_at = excluded.last_processed_at
    `);
    
    db.transaction(() => {
      for (const event of events) {
        this.projectEvent(db, event, userId);
      }
      
      const maxSequence = Math.max(...events.map(e => e.sequenceNumber));
      updateCheckpoint.run(userId, maxSequence, new Date().toISOString());
    })();
    
    db.close();
  }
  
  private projectEvent(db: any, event: Event, userId: string): void {
    switch (event.eventType) {
      case 'DomainRegisteredEvent':
        this.projectDomainRegistered(db, event, userId);
        break;
      case 'DomainStatusCheckedEvent':
        this.projectDomainStatusChecked(db, event);
        break;
      case 'DomainCheckScheduledEvent':
        this.projectDomainCheckScheduled(db, event);
        break;
      case 'DomainActivatedEvent':
        this.projectDomainActivated(db, event);
        break;
      case 'DomainDeactivatedEvent':
        this.projectDomainDeactivated(db, event);
        break;
      case 'DomainOfflineAlertSentEvent':
        this.projectOfflineAlertSent(db, event);
        break;
      case 'DomainOfflineAlertFailedEvent':
        this.projectOfflineAlertFailed(db, event);
        break;
      // ContactDetailsUpdatedEvent: contact details are read from the system
      // database, so there is nothing to project.
    }
  }
  
  private projectDomainRegistered(db: any, event: Event, userId: string): void {
    const { domainId, domain } = event.eventData;
    
    const insert = db.prepare(`
      INSERT INTO domain_monitors (
        id, domain, user_id, status, active, created_at, updated_at
      ) VALUES (?, ?, ?, 'unknown', 1, ?, ?)
    `);
    
    const now = new Date().toISOString();
    insert.run(domainId, domain, userId, now, now);
  }
  
  private projectDomainStatusChecked(db: any, event: Event): void {
    const { domainId, status, responseCode, responseTimeMs } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        status = ?,
        response_code = ?,
        response_time_ms = ?,
        last_checked_at = ?,
        updated_at = ?
      WHERE id = ?
    `);
    
    const now = new Date().toISOString();
    update.run(
      status,
      responseCode || null,
      responseTimeMs || null,
      now,
      now,
      domainId
    );
  }
  
  private projectDomainCheckScheduled(db: any, event: Event): void {
    const { domainId, scheduledFor } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        next_check_at = ?,
        updated_at = ?
      WHERE id = ?
    `);
    
    update.run(
      new Date(scheduledFor).toISOString(),
      new Date().toISOString(),
      domainId
    );
  }
  
  private projectDomainActivated(db: any, event: Event): void {
    const { domainId } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        active = 1,
        updated_at = ?
      WHERE id = ?
    `);
    
    update.run(new Date().toISOString(), domainId);
  }
  
  private projectDomainDeactivated(db: any, event: Event): void {
    const { domainId } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        active = 0,
        next_check_at = NULL,
        updated_at = ?
      WHERE id = ?
    `);
    
    update.run(new Date().toISOString(), domainId);
  }
  
  private projectOfflineAlertSent(db: any, event: Event): void {
    const { domainId, channels, timestamp } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        last_alert_at = ?,
        last_alert_channels = ?,
        last_alert_error = NULL,
        updated_at = ?
      WHERE id = ?
    `);
    
    update.run(
      new Date(timestamp).toISOString(),
      JSON.stringify(channels ?? []),
      new Date().toISOString(),
      domainId
    );
  }
  
  private projectOfflineAlertFailed(db: any, event: Event): void {
    const { domainId, error, timestamp } = event.eventData;
    
    const update = db.prepare(`
      UPDATE domain_monitors SET
        last_alert_at = ?,
        last_alert_channels = NULL,
        last_alert_error = ?,
        updated_at = ?
      WHERE id = ?
    `);
    
    update.run(
      new Date(timestamp).toISOString(),
      error,
      new Date().toISOString(),
      domainId
    );
  }
}

let globalProjectionEngine: ProjectionEngine | null = null;

export function getProjectionEngine(): ProjectionEngine {
  if (!globalProjectionEngine) {
    globalProjectionEngine = new ProjectionEngine();
  }
  return globalProjectionEngine;
}