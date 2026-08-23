import { Event, DomainMonitor, ProjectionCheckpoint } from '@/types';
import { EventStore } from './event-store';
import { getReadModelDatabase, getAllUserIds } from '@/lib/infrastructure/database/connection';
import { CHECK_RETENTION_DAYS } from '@/lib/public-monitors/schedule';

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
      case 'PublicSiteRegisteredEvent':
        this.projectPublicSiteRegistered(db, event);
        break;
      case 'PublicPageRegisteredEvent':
        this.projectPublicPageRegistered(db, event);
        break;
      case 'PublicSiteDeactivatedEvent':
        this.projectPublicSiteDeactivated(db, event);
        break;
      case 'PublicPageDeactivatedEvent':
        this.projectPublicPageDeactivated(db, event);
        break;
      case 'PublicPageCheckedEvent':
        this.projectPublicPageChecked(db, event);
        break;
      case 'PublicSiteCheckScheduledEvent':
        this.projectPublicSiteCheckScheduled(db, event);
        break;
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
  
  // ---------------------------------------------------------------------
  // Public monitors. Registrations are upserts so re-seeding is harmless.
  // ---------------------------------------------------------------------
  
  private projectPublicSiteRegistered(db: any, event: Event): void {
    const { siteId, slug, name, url, description, category, tier, position } = event.eventData;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO public_sites (id, slug, name, url, description, category, tier, position, active, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'unknown', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        url = excluded.url,
        description = excluded.description,
        category = excluded.category,
        tier = excluded.tier,
        position = excluded.position,
        active = 1,
        updated_at = excluded.updated_at
    `).run(siteId, slug, name, url, description ?? '', category ?? 'other', tier ?? 'standard', position ?? 0, now, now);
  }
  
  private projectPublicPageRegistered(db: any, event: Event): void {
    const { pageId, siteId, slug, name, url, position } = event.eventData;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO public_pages (id, site_id, slug, name, url, position, active, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'unknown', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        site_id = excluded.site_id,
        slug = excluded.slug,
        name = excluded.name,
        url = excluded.url,
        position = excluded.position,
        active = 1,
        updated_at = excluded.updated_at
    `).run(pageId, siteId, slug, name, url, position ?? 0, now, now);
  }
  
  private projectPublicSiteDeactivated(db: any, event: Event): void {
    const { siteId } = event.eventData;
    const now = new Date().toISOString();
    db.prepare('UPDATE public_sites SET active = 0, next_check_at = NULL, claimed_at = NULL, updated_at = ? WHERE id = ?').run(now, siteId);
    db.prepare('UPDATE public_pages SET active = 0, updated_at = ? WHERE site_id = ?').run(now, siteId);
  }
  
  private projectPublicPageDeactivated(db: any, event: Event): void {
    const { pageId } = event.eventData;
    db.prepare('UPDATE public_pages SET active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), pageId);
  }
  
  private projectPublicPageChecked(db: any, event: Event): void {
    const { pageId, siteId, status, responseCode, responseTimeMs, finalUrl, title, error, blocked, checkedAt } = event.eventData;
    const checkedAtIso = new Date(checkedAt).toISOString();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO public_page_checks (page_id, site_id, checked_at, status, response_code, response_time_ms, final_url, title, error, blocked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pageId, siteId, checkedAtIso, status, responseCode ?? null, responseTimeMs ?? null, finalUrl ?? null, title ?? null, error ?? null, blocked ? 1 : 0);
    
    // A bot challenge means we could not verify the page — it does NOT mean the
    // site is down (it is usually up and simply refusing an automated visitor).
    // Record the attempt, but leave the last known status alone so the status
    // pages never claim an outage we did not observe.
    if (blocked) {
      db.prepare('UPDATE public_pages SET response_code = ?, response_time_ms = ?, last_checked_at = ?, updated_at = ? WHERE id = ?')
        .run(responseCode ?? null, responseTimeMs ?? null, checkedAtIso, now, pageId);
      db.prepare('UPDATE public_sites SET last_checked_at = ?, updated_at = ? WHERE id = ?').run(checkedAtIso, now, siteId);
      return;
    }
    
    db.prepare(`
      UPDATE public_pages SET
        status = ?,
        response_code = ?,
        response_time_ms = ?,
        last_checked_at = ?,
        last_online_at = CASE WHEN ? = 'online' THEN ? ELSE last_online_at END,
        last_offline_at = CASE WHEN ? = 'offline' THEN ? ELSE last_offline_at END,
        updated_at = ?
      WHERE id = ?
    `).run(status, responseCode ?? null, responseTimeMs ?? null, checkedAtIso, status, checkedAtIso, status, checkedAtIso, now, pageId);
    
    // The site's headline status follows its primary page (position 0).
    const page = db.prepare('SELECT position FROM public_pages WHERE id = ?').get(pageId) as { position: number } | undefined;
    if (page && page.position === 0) {
      db.prepare('UPDATE public_sites SET status = ?, last_checked_at = ?, updated_at = ? WHERE id = ?').run(status, checkedAtIso, now, siteId);
    } else {
      db.prepare('UPDATE public_sites SET last_checked_at = ?, updated_at = ? WHERE id = ?').run(checkedAtIso, now, siteId);
    }
  }
  
  private projectPublicSiteCheckScheduled(db: any, event: Event): void {
    const { siteId, scheduledFor } = event.eventData;
    const now = new Date();
    db.prepare('UPDATE public_sites SET next_check_at = ?, claimed_at = NULL, updated_at = ? WHERE id = ?')
      .run(new Date(scheduledFor).toISOString(), now.toISOString(), siteId);
    
    // Cheap, indexed retention sweep: one per site visit (~100/day).
    const cutoff = new Date(now.getTime() - CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM public_page_checks WHERE site_id = ? AND checked_at < ?').run(siteId, cutoff);
  }
}

let globalProjectionEngine: ProjectionEngine | null = null;

export function getProjectionEngine(): ProjectionEngine {
  if (!globalProjectionEngine) {
    globalProjectionEngine = new ProjectionEngine();
  }
  return globalProjectionEngine;
}