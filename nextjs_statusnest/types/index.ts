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
  /** E.164 phone number that is called / texted when a domain goes offline. */
  phoneNumber?: string | null;
  /** Address offline alerts are emailed to; falls back to the account email. */
  notificationEmail?: string | null;
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
  /** When the most recent offline alert was attempted via AlertTray. */
  lastAlertAt?: Date;
  /** AlertTray channels the most recent offline alert went out on (call, sms, email, ...). */
  lastAlertChannels?: string[];
  /** Set when the most recent offline alert could not be sent. */
  lastAlertError?: string;
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

export interface ContactDetailsUpdatedEvent {
  userId: string;
  phoneNumber: string | null;
  notificationEmail: string | null;
  timestamp: Date;
}

/** Who an offline alert was addressed to (what StatusNest handed to AlertTray). */
export interface AlertRecipients {
  phoneNumber: string | null;
  email: string | null;
}

export interface DomainOfflineAlertSentEvent {
  domainId: string;
  domain: string;
  /** AlertTray notification id. */
  notificationId: string;
  /** Channels AlertTray scheduled delivery on. */
  channels: string[];
  /** Channels AlertTray wanted but had no recipient for (e.g. no phone number). */
  skippedChannels: string[];
  recipients: AlertRecipients;
  timestamp: Date;
}

export interface DomainOfflineAlertFailedEvent {
  domainId: string;
  domain: string;
  error: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Public monitors: well-known sites checked from a real Chromium browser and
// published on the SEO status pages (/status/...). System-owned, not tied to a
// user, and never routed to AlertTray.
// ---------------------------------------------------------------------------

export type PublicCheckStatus = 'online' | 'offline';
export type PublicMonitorStatus = PublicCheckStatus | 'unknown';

export interface PublicPage {
  id: string;
  siteId: string;
  slug: string;
  name: string;
  url: string;
  position: number;
  active: boolean;
  status: PublicMonitorStatus;
  responseCode?: number;
  responseTimeMs?: number;
  lastCheckedAt?: Date;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicSite {
  id: string;
  slug: string;
  name: string;
  url: string;
  description: string;
  position: number;
  active: boolean;
  /** Status of the site's primary page (position 0). */
  status: PublicMonitorStatus;
  lastCheckedAt?: Date;
  nextCheckAt?: Date;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  pages: PublicPage[];
}

export interface PublicPageCheck {
  id: number;
  pageId: string;
  siteId: string;
  checkedAt: Date;
  status: PublicCheckStatus;
  responseCode?: number;
  responseTimeMs?: number;
  finalUrl?: string;
  title?: string;
  error?: string;
  /** The site answered but served a bot challenge / access-denied page. */
  blocked: boolean;
}

/** What the browser checker reports for one page. */
export interface PublicPageCheckResult {
  pageId: string;
  status: PublicCheckStatus;
  responseCode?: number;
  responseTimeMs?: number;
  finalUrl?: string;
  title?: string;
  error?: string;
  blocked?: boolean;
}

export interface PublicCheckerInfo {
  /** e.g. "chromium" */
  engine: string;
  version?: string;
  userAgent?: string;
  /** e.g. "xvfb" when a real window was used, "headless" otherwise */
  display?: string;
}

export interface PublicSiteRegisteredEvent {
  siteId: string;
  slug: string;
  name: string;
  url: string;
  description: string;
  position: number;
  timestamp: Date;
}

export interface PublicPageRegisteredEvent {
  pageId: string;
  siteId: string;
  slug: string;
  name: string;
  url: string;
  position: number;
  timestamp: Date;
}

export interface PublicSiteDeactivatedEvent {
  siteId: string;
  timestamp: Date;
}

export interface PublicPageDeactivatedEvent {
  pageId: string;
  siteId: string;
  timestamp: Date;
}

export interface PublicPageCheckedEvent extends PublicPageCheckResult {
  siteId: string;
  blocked: boolean;
  checkedAt: Date;
  checker: PublicCheckerInfo;
  timestamp: Date;
}

export interface PublicSiteCheckScheduledEvent {
  siteId: string;
  scheduledFor: Date;
  timestamp: Date;
}

