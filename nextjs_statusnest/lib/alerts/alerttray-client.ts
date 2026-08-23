import type { AlertRecipients } from '@/types';

/**
 * Thin client for AlertTray's public push API.
 *
 * AlertTray routes by severity: `critical`/`high` → phone call + SMS (falling
 * back to email when there is no phone number), `medium`/`low` → email. The
 * `recipients` field tells AlertTray to reach the StatusNest user rather
 * than the AlertTray account that owns the API key.
 */

const DEFAULT_ALERTTRAY_API_URL = 'https://alerttray.com';
const REQUEST_TIMEOUT_MS = 10_000;

export type AlertTraySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertTrayPushRequest {
  purposeId: string;
  title: string;
  message: string;
  severity: AlertTraySeverity;
  metadata?: Record<string, unknown>;
  recipients: AlertRecipients;
}

export interface AlertTrayPushResult {
  notificationId: string;
  channels: string[];
  skippedChannels: string[];
}

export class AlertTrayError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AlertTrayError';
  }
}

export interface AlertTrayClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class AlertTrayClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  
  constructor(options: AlertTrayClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.ALERTTRAY_API_URL ?? DEFAULT_ALERTTRAY_API_URL)
      .replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? process.env.ALERTTRAY_API_KEY;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  
  /** True when an API key is available; without one nothing can be sent. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
  
  async push(request: AlertTrayPushRequest): Promise<AlertTrayPushResult> {
    if (!this.apiKey) {
      throw new AlertTrayError('AlertTray is not configured: ALERTTRAY_API_KEY is not set');
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/notifications/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });
    } catch (error) {
      throw new AlertTrayError(`AlertTray request failed: ${describeFetchError(error)}`);
    } finally {
      clearTimeout(timeout);
    }
    
    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON body; fall through to the status check below.
    }
    
    if (!response.ok || !data?.success) {
      const detail = data?.error ?? `${response.status} ${response.statusText}`;
      throw new AlertTrayError(`AlertTray rejected the notification: ${detail}`, response.status);
    }
    
    return {
      notificationId: String(data.notificationId),
      channels: Array.isArray(data.channels) ? data.channels.map(String) : [],
      skippedChannels: Array.isArray(data.skippedChannels) ? data.skippedChannels.map(String) : []
    };
  }
}

/**
 * Node's fetch reports network errors as a bare "fetch failed" with the real
 * reason (ECONNREFUSED, ENOTFOUND, ...) on `cause`; surface it.
 */
function describeFetchError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return `timed out after ${REQUEST_TIMEOUT_MS}ms`;
  }
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeText = cause instanceof Error ? cause.message : cause ? String(cause) : null;
    return causeText && causeText !== error.message ? `${error.message} (${causeText})` : error.message;
  }
  return String(error);
}
