import { Command, Event, PublicPageCheckResult } from '@/types';
import { EventStore, assert } from './event-store';
import { v4 as uuidv4 } from 'uuid';
import { scheduleNextPublicCheck } from '@/lib/public-monitors/schedule';

export class CommandBus {
  private eventStore: EventStore;
  
  constructor() {
    this.eventStore = new EventStore();
  }
  
  async dispatch(command: Command): Promise<void> {
    assert(command.userId, "User ID is required");
    assert(command.type, "Command type is required");
    
    const events = await this.handleCommand(command);
    
    if (events.length > 0) {
      await this.eventStore.appendEvents(command.userId, events);
    }
  }
  
  private async handleCommand(command: Command): Promise<Event[]> {
    switch (command.type) {
      case 'RegisterDomain':
        return this.handleRegisterDomain(command);
      case 'CheckDomainStatus':
        return this.handleCheckDomainStatus(command);
      case 'ScheduleDomainCheck':
        return this.handleScheduleDomainCheck(command);
      case 'ActivateDomain':
        return this.handleActivateDomain(command);
      case 'DeactivateDomain':
        return this.handleDeactivateDomain(command);
      case 'UpdateContactDetails':
        return this.handleUpdateContactDetails(command);
      case 'RecordOfflineAlertSent':
        return this.handleRecordOfflineAlertSent(command);
      case 'RecordOfflineAlertFailed':
        return this.handleRecordOfflineAlertFailed(command);
      case 'RegisterPublicSite':
        return this.handleRegisterPublicSite(command);
      case 'RegisterPublicPage':
        return this.handleRegisterPublicPage(command);
      case 'DeactivatePublicSite':
        return this.handleDeactivatePublicSite(command);
      case 'DeactivatePublicPage':
        return this.handleDeactivatePublicPage(command);
      case 'RecordPublicSiteCheck':
        return this.handleRecordPublicSiteCheck(command);
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }
  
  private handleRegisterDomain(command: Command): Event[] {
    const { domain } = command.payload;
    assert(domain, "Domain is required");
    
    const domainId = command.aggregateId || uuidv4();
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainRegisteredEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          userId: command.userId,
          domain,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      },
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainCheckScheduledEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          scheduledFor: now,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleCheckDomainStatus(command: Command): Event[] {
    const { domainId, domain, status, responseCode, responseTimeMs } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    assert(status, "Status is required");
    
    const now = new Date();
    const nextCheck = new Date(now.getTime() + 5 * 60 * 1000);
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainStatusCheckedEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          status,
          responseCode,
          responseTimeMs,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      },
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainCheckScheduledEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          scheduledFor: nextCheck,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleScheduleDomainCheck(command: Command): Event[] {
    const { domainId, domain, scheduledFor } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    assert(scheduledFor, "Scheduled time is required");
    
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainCheckScheduledEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          scheduledFor: new Date(scheduledFor),
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleActivateDomain(command: Command): Event[] {
    const { domainId, domain } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainActivatedEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      },
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainCheckScheduledEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          scheduledFor: now,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleDeactivateDomain(command: Command): Event[] {
    const { domainId, domain } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainDeactivatedEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleUpdateContactDetails(command: Command): Event[] {
    const { phoneNumber = null, notificationEmail = null } = command.payload;
    
    const now = new Date();
    
    return [
      {
        aggregateId: command.userId,
        aggregateType: 'User',
        eventType: 'ContactDetailsUpdatedEvent',
        eventVersion: 1,
        eventData: {
          userId: command.userId,
          phoneNumber,
          notificationEmail,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleRecordOfflineAlertSent(command: Command): Event[] {
    const { domainId, domain, notificationId, channels, skippedChannels, recipients } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    assert(notificationId, "AlertTray notification ID is required");
    
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainOfflineAlertSentEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          notificationId,
          channels: channels ?? [],
          skippedChannels: skippedChannels ?? [],
          recipients: recipients ?? { phoneNumber: null, email: null },
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  private handleRecordOfflineAlertFailed(command: Command): Event[] {
    const { domainId, domain, error } = command.payload;
    assert(domainId, "Domain ID is required");
    assert(domain, "Domain is required");
    assert(error, "Failure reason is required");
    
    const now = new Date();
    
    return [
      {
        aggregateId: domainId,
        aggregateType: 'Domain',
        eventType: 'DomainOfflineAlertFailedEvent',
        eventVersion: 1,
        eventData: {
          domainId,
          domain,
          error,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
  }
  
  // ---------------------------------------------------------------------
  // Public monitors (SEO status pages). Aggregate ids are deterministic
  // (site slug, "site/page") so the config seed is idempotent.
  // ---------------------------------------------------------------------
  
  private handleRegisterPublicSite(command: Command): Event[] {
    const { slug, name, url, description = '', position = 0, pages = [] } = command.payload;
    assert(slug, "Site slug is required");
    assert(name, "Site name is required");
    assert(url, "Site URL is required");
    
    const siteId = command.aggregateId || slug;
    const now = new Date();
    
    const events: Event[] = [
      {
        aggregateId: siteId,
        aggregateType: 'PublicSite',
        eventType: 'PublicSiteRegisteredEvent',
        eventVersion: 1,
        eventData: { siteId, slug, name, url, description, position, timestamp: now },
        createdAt: now,
        sequenceNumber: 0
      }
    ];
    
    (pages as { slug: string; name: string; url: string }[]).forEach((page, index) => {
      assert(page.slug && page.name && page.url, "Each page needs slug, name and url");
      const pageId = `${slug}/${page.slug}`;
      events.push({
        aggregateId: pageId,
        aggregateType: 'PublicPage',
        eventType: 'PublicPageRegisteredEvent',
        eventVersion: 1,
        eventData: { pageId, siteId, slug: page.slug, name: page.name, url: page.url, position: index, timestamp: now },
        createdAt: now,
        sequenceNumber: 0
      });
    });
    
    // First check as soon as a checker is free.
    events.push({
      aggregateId: siteId,
      aggregateType: 'PublicSite',
      eventType: 'PublicSiteCheckScheduledEvent',
      eventVersion: 1,
      eventData: { siteId, scheduledFor: now, timestamp: now },
      createdAt: now,
      sequenceNumber: 0
    });
    
    return events;
  }
  
  private handleRegisterPublicPage(command: Command): Event[] {
    const { siteId, slug, name, url, position = 0 } = command.payload;
    assert(siteId, "Site ID is required");
    assert(slug && name && url, "Page slug, name and url are required");
    
    const pageId = command.aggregateId || `${siteId}/${slug}`;
    const now = new Date();
    
    return [{
      aggregateId: pageId,
      aggregateType: 'PublicPage',
      eventType: 'PublicPageRegisteredEvent',
      eventVersion: 1,
      eventData: { pageId, siteId, slug, name, url, position, timestamp: now },
      createdAt: now,
      sequenceNumber: 0
    }];
  }
  
  private handleDeactivatePublicSite(command: Command): Event[] {
    const { siteId } = command.payload;
    assert(siteId, "Site ID is required");
    const now = new Date();
    return [{
      aggregateId: siteId,
      aggregateType: 'PublicSite',
      eventType: 'PublicSiteDeactivatedEvent',
      eventVersion: 1,
      eventData: { siteId, timestamp: now },
      createdAt: now,
      sequenceNumber: 0
    }];
  }
  
  private handleDeactivatePublicPage(command: Command): Event[] {
    const { pageId, siteId } = command.payload;
    assert(pageId, "Page ID is required");
    assert(siteId, "Site ID is required");
    const now = new Date();
    return [{
      aggregateId: pageId,
      aggregateType: 'PublicPage',
      eventType: 'PublicPageDeactivatedEvent',
      eventVersion: 1,
      eventData: { pageId, siteId, timestamp: now },
      createdAt: now,
      sequenceNumber: 0
    }];
  }
  
  /**
   * One browser visit of a site: a result per page, then the next visit is
   * scheduled with jitter (5–20 min, mode 15). Never touches AlertTray.
   */
  private handleRecordPublicSiteCheck(command: Command): Event[] {
    const { siteId, checker = { engine: 'unknown' } } = command.payload;
    const results = (command.payload.results ?? []) as PublicPageCheckResult[];
    assert(siteId, "Site ID is required");
    assert(results.length > 0, "At least one page result is required");
    
    const now = new Date();
    const checkedAt = command.payload.checkedAt ? new Date(command.payload.checkedAt) : now;
    assert(!Number.isNaN(checkedAt.getTime()), "checkedAt must be a valid date");
    
    const events: Event[] = results.map(result => {
      assert(result.pageId, "Page ID is required for each result");
      assert(result.status === 'online' || result.status === 'offline', `Invalid status for ${result.pageId}: ${result.status}`);
      return {
        aggregateId: result.pageId,
        aggregateType: 'PublicPage',
        eventType: 'PublicPageCheckedEvent',
        eventVersion: 1,
        eventData: {
          pageId: result.pageId,
          siteId,
          status: result.status,
          responseCode: result.responseCode ?? null,
          responseTimeMs: result.responseTimeMs ?? null,
          finalUrl: result.finalUrl ?? null,
          title: result.title ?? null,
          error: result.error ?? null,
          blocked: Boolean(result.blocked),
          checkedAt,
          checker,
          timestamp: now
        },
        createdAt: now,
        sequenceNumber: 0
      };
    });
    
    events.push({
      aggregateId: siteId,
      aggregateType: 'PublicSite',
      eventType: 'PublicSiteCheckScheduledEvent',
      eventVersion: 1,
      eventData: { siteId, scheduledFor: scheduleNextPublicCheck(now), timestamp: now },
      createdAt: now,
      sequenceNumber: 0
    });
    
    return events;
  }
}
