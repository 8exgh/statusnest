/**
 * Decide whether what the browser got back is a bot challenge / access denial
 * rather than the real page. Pure and side-effect free so it is easy to test.
 *
 * Two signals, either is enough:
 *  - a status code that challenge pages use (403, 429, 503) together with a
 *    marker in the title/body, OR a 403/429 even without a marker (nothing a
 *    public homepage legitimately returns to a visitor), OR
 *  - a marker in the title/body on its own (some challenges serve HTTP 200).
 */

const MARKERS: RegExp[] = [
  /just a moment/i,                  // Cloudflare
  /attention required/i,             // Cloudflare
  /checking your browser/i,          // Cloudflare
  /verify(?:ing)? (?:that )?you are (?:a )?human/i,
  /are you a robot/i,
  /unusual traffic/i,                // Google sorry page
  /pardon our interruption/i,        // Distil / Imperva
  /access denied/i,                  // Akamai and friends
  /request blocked/i,                // AWS WAF
  /reference #18\./i,                // Akamai
  /\bcaptcha\b/i,
  /enable javascript and cookies to continue/i,
  /bot detection/i,
  /automated access/i,
  /too many requests/i,
];

export interface BlockSignals {
  status?: number;
  title?: string;
  bodyText?: string;
}

export function hasChallengeMarker(text: string | undefined): boolean {
  if (!text) return false;
  return MARKERS.some(marker => marker.test(text));
}

export function isBotBlocked(signals: BlockSignals): boolean {
  const { status, title, bodyText } = signals;
  const marker = hasChallengeMarker(title) || hasChallengeMarker(bodyText);
  if (status === 403 || status === 429) return true;
  if (status === 503 && marker) return true;
  return marker;
}

/** Short reason for the error field. */
export function describeBlock(status?: number): string {
  return status ? `Bot challenge (HTTP ${status})` : 'Bot challenge';
}
