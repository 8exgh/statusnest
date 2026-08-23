import type { PublicMonitorStatus } from '@/types';

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

