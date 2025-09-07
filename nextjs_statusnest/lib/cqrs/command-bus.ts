import { Command, Event } from '@/types';
import { EventStore, assert } from './event-store';
import { v4 as uuidv4 } from 'uuid';

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
}