import { CommandBus } from '@/lib/cqrs/command-bus';
import { ContactDetailsService } from '@/lib/infrastructure/users/contact-details';
import { AlertTrayClient, AlertTrayError } from './alerttray-client';

/**
 * Offline alerting: when a monitored domain transitions to `offline`, the
 * site owner is alerted through AlertTray at the highest severity, which
 * AlertTray delivers as a phone call + SMS (and email as the fallback when no
 * phone number is set). The outcome is recorded in the user's event stream
 * so the dashboard can show it.
 */

/** Highest AlertTray severity: phone call + SMS, with email as the fallback. */
export const OFFLINE_ALERT_SEVERITY = 'critical' as const;
export const OFFLINE_ALERT_PURPOSE_ID = 'statusnest-domain-offline';

export type MonitorStatus = 'online' | 'offline' | 'unknown';

/** Alert on the transition into `offline`, never while a domain stays offline. */
export function shouldAlertOffline(previousStatus: MonitorStatus, newStatus: MonitorStatus): boolean {
  return newStatus === 'offline' && previousStatus !== 'offline';
}

export interface OfflineCheck {
  userId: string;
  domainId: string;
  domain: string;
  responseCode?: number;
  responseTimeMs?: number;
  checkedAt: Date;
}

/**
 * Wording shared by every channel. AlertTray reads the title and message out
 * loud on the phone call, so keep them plain text (no emoji, no markup).
 */
export function buildOfflineAlertContent(check: Pick<OfflineCheck, 'domain' | 'responseCode' | 'responseTimeMs' | 'checkedAt'>): {
  title: string;
  message: string;
} {
  const when = check.checkedAt.toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short'
  }) + ' UTC';
  
  let reason: string;
  if (check.responseCode) {
    reason = `The server responded with HTTP ${check.responseCode}.`;
  } else if (check.responseTimeMs && check.responseTimeMs >= 1000) {
    reason = `There was no response: the connection failed or timed out after ${Math.round(check.responseTimeMs / 1000)} seconds.`;
  } else {
    reason = 'There was no response: the connection failed.';
  }
  
  return {
    title: `${check.domain} is offline`,
    message: `StatusNest could not reach ${check.domain} at ${when}. ${reason} Checks continue every 5 minutes.`
  };
}

/**
 * Send the offline alert for one check and record the result as a
 * DomainOfflineAlertSentEvent / DomainOfflineAlertFailedEvent. Never throws
 * for delivery problems — those are recorded; only a failure to append the
 * event itself propagates.
 */
export async function alertDomainOffline(
  check: OfflineCheck,
  client: AlertTrayClient = new AlertTrayClient()
): Promise<void> {
  const commandBus = new CommandBus();
  const recipients = ContactDetailsService.getAlertRecipients(check.userId);
  
  try {
    if (!client.isConfigured()) {
      throw new AlertTrayError('AlertTray is not configured: ALERTTRAY_API_KEY is not set');
    }
    if (!recipients.phoneNumber) {
      console.warn(
        `⚠️  ${check.domain} is offline but user ${check.userId} has no phone number — ` +
        `AlertTray will fall back to email (${recipients.email ?? 'none'})`
      );
    }
    
    const { title, message } = buildOfflineAlertContent(check);
    const result = await client.push({
      purposeId: OFFLINE_ALERT_PURPOSE_ID,
      title,
      message,
      severity: OFFLINE_ALERT_SEVERITY,
      metadata: {
        source: 'statusnest',
        domainId: check.domainId,
        domain: check.domain,
        responseCode: check.responseCode ?? null,
        responseTimeMs: check.responseTimeMs ?? null,
        checkedAt: check.checkedAt.toISOString()
      },
      recipients
    });
    
    console.log(
      `🚨 Offline alert for ${check.domain} sent via AlertTray (${result.notificationId}): ` +
      `channels=${result.channels.join(',') || 'none'}` +
      (result.skippedChannels.length ? ` skipped=${result.skippedChannels.join(',')}` : '')
    );
    
    await commandBus.dispatch({
      userId: check.userId,
      aggregateId: check.domainId,
      type: 'RecordOfflineAlertSent',
      payload: {
        domainId: check.domainId,
        domain: check.domain,
        notificationId: result.notificationId,
        channels: result.channels,
        skippedChannels: result.skippedChannels,
        recipients
      }
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ Offline alert for ${check.domain} failed: ${reason}`);
    
    await commandBus.dispatch({
      userId: check.userId,
      aggregateId: check.domainId,
      type: 'RecordOfflineAlertFailed',
      payload: {
        domainId: check.domainId,
        domain: check.domain,
        error: reason
      }
    });
  }
}
