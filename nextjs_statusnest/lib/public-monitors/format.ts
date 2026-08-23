import type { PublicMonitorStatus } from '@/types';
import { asCheckTier, describeCadence } from './schedule';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "4 minutes ago", "2 hours ago", "3 days ago" — or "never". */
export function relativeTime(date: Date | undefined, now: Date = new Date()): string {
  if (!date) return 'never';
  const diff = Math.max(0, now.getTime() - date.getTime());
  if (diff < 45 * 1000) return 'just now';
  if (diff < HOUR) {
    const m = Math.round(diff / MINUTE);
    return `${m} minute${m === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return `${h} hour${h === 1 ? '' : 's'} ago`;
  }
  const d = Math.round(diff / DAY);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

/** Compact form for tight layouts: "just now", "16 min ago", "3 h ago", "2 d ago". */
export function relativeTimeShort(date: Date | undefined, now: Date = new Date()): string {
  if (!date) return 'never';
  const diff = Math.max(0, now.getTime() - date.getTime());
  if (diff < 45 * 1000) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)} h ago`;
  return `${Math.round(diff / DAY)} d ago`;
}

/** 0..1 → "99.98%", 1 → "100%", null → "—". */
export function formatUptime(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—';
  const pct = fraction * 100;
  if (pct >= 100) return '100%';
  if (pct <= 0) return '0%';
  return `${pct.toFixed(2)}%`;
}

export function formatMs(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)} s`;
  return `${Math.round(ms)} ms`;
}

/** "14 min", "2 h 13 min", "1 d 3 h", "< 1 min". */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return '< 1 min';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.round((ms % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  return `${minutes} min`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "Aug 23, 2026, 14:05 UTC" */
export function formatDateTimeUTC(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

/** "14:05" (UTC) */
export function formatTimeUTC(date: Date): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** "YYYY-MM-DD" → "Aug 23" (or "Aug 23, 2026" with `withYear`). */
export function formatDayUTC(isoDay: string, withYear = false): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const base = `${MONTHS[(m || 1) - 1]} ${d}`;
  return withYear ? `${base}, ${y}` : base;
}

/**
 * What we display, as opposed to what is stored.
 *
 * A site that answers a bot challenge tells us nothing about whether it is up
 * — it is usually fine and simply refusing an automated visitor — so it gets
 * its own state rather than being reported as an outage.
 */
export type VerifyState = 'online' | 'offline' | 'blocked' | 'unknown';

export function verifyState(status: PublicMonitorStatus, latestBlocked?: boolean): VerifyState {
  return latestBlocked ? 'blocked' : status;
}

export function verifyLabel(state: VerifyState, name?: string): string {
  switch (state) {
    case 'online':
      return name ? `${name} is up` : 'Online';
    case 'offline':
      return name ? `${name} is unavailable` : 'Unavailable';
    case 'blocked':
      return name ? `Couldn’t verify ${name}` : 'Couldn’t verify';
    default:
      return 'Not checked yet';
  }
}

/**
 * One sentence for the hero when the latest check was a bot challenge: says
 * what we saw, what it usually means, and what we last actually observed.
 */
export function blockedExplanation(name: string, lastStatus: PublicMonitorStatus, lastSeen: Date | undefined, now: Date): string {
  const seen =
    lastStatus === 'online'
      ? `we last confirmed it up ${relativeTime(lastSeen, now)}`
      : lastStatus === 'offline'
        ? `the last check we could complete found it unavailable ${relativeTime(lastSeen, now)}`
        : 'we have not completed a check yet';
  return `${name} showed a bot check to our browser instead of the page. That normally means the site is up but refusing automated visitors, so we do not count it as an outage — ${seen}.`;
}

export function statusLabel(status: PublicMonitorStatus, name?: string): string {
  switch (status) {
    case 'online':
      return name ? `${name} is up` : 'Online';
    case 'offline':
      return name ? `${name} is unavailable` : 'Unavailable';
    default:
      return 'Not checked yet';
  }
}

export function statusWord(status: PublicMonitorStatus): 'up' | 'unavailable' | 'not checked yet' {
  return status === 'online' ? 'up' : status === 'offline' ? 'unavailable' : 'not checked yet';
}

/** "GitHub" + page "GitHub" → "GitHub"; "Google" + "Gmail" → "Google Gmail". */
export function subjectName(siteName: string, pageName?: string): string {
  if (!pageName || pageName.toLowerCase() === siteName.toLowerCase()) return siteName;
  return pageName.toLowerCase().includes(siteName.toLowerCase()) ? pageName : `${siteName} ${pageName}`;
}

/** "every 5–20 minutes" / "every 20–60 minutes" for a site's cadence tier. */
export function cadenceFor(tier: string): string {
  return describeCadence(asCheckTier(tier));
}

/** One plain sentence about how often this subject is checked, and why. */
export function cadenceSentence(tier: string, name: string): string {
  return asCheckTier(tier) === 'primary'
    ? `${name} is one of our headline sites, so it is checked ${describeCadence('primary')} — more often than the rest.`
    : `${name} is checked ${describeCadence('standard')}.`;
}
