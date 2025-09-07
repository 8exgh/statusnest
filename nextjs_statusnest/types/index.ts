export interface Event {
  id?: number;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  eventData: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  sequenceNumber: number;
}

export interface Command {
  userId: string;
  aggregateId: string;
  type: string;
  payload: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface DomainMonitor {
  id: string;
  domain: string;
  userId: string;
  status: 'online' | 'offline' | 'unknown';
  active: boolean;
  lastCheckedAt?: Date;
  nextCheckAt?: Date;
  responseCode?: number;
  responseTimeMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectionCheckpoint {
  userId: string;
  lastProcessedSequence: number;
  lastProcessedAt: Date;
}

export interface StatusUpdate {
  domainId: string;
  domain: string;
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs?: number;
  checkedAt: Date;
}

export interface Task {
  domainId: string;
  domain: string;
  userId: string;
}

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  timestamp: Date;
}

export interface DomainRegisteredEvent {
  domainId: string;
  userId: string;
  domain: string;
  timestamp: Date;
}

export interface DomainStatusCheckedEvent {
  domainId: string;
  domain: string;
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs?: number;
  timestamp: Date;
}

export interface DomainCheckScheduledEvent {
  domainId: string;
  domain: string;
  scheduledFor: Date;
  timestamp: Date;
}

export interface DomainActivatedEvent {
  domainId: string;
  domain: string;
  timestamp: Date;
}

export interface DomainDeactivatedEvent {
  domainId: string;
  domain: string;
  timestamp: Date;
}