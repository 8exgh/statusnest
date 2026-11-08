import type { Command, Event } from '@/types';

export interface QuietHoursRange {
  /** Local weekdays on which the range starts: Sunday = 0. */
  days: number[];
  start: string;
  end: string;
}

export interface QuietHoursSettings {
  enabled: boolean;
  timeZone: string;
  ranges: QuietHoursRange[];
}

export const MAX_QUIET_HOURS_RANGES = 14;
export const quietHoursAggregate = (userId: string) => `alert-quiet-hours:${userId}`;
export const defaultQuietHours = (): QuietHoursSettings => ({ enabled: false, timeZone: 'UTC', ranges: [] });

export class QuietHoursValidationError extends Error {}

export function parseQuietHours(value: unknown): QuietHoursSettings {
  const fail = (message: string): never => { throw new QuietHoursValidationError(message); };
  if (!value || typeof value !== 'object') return fail('Quiet hours settings are required.');
  const { enabled, timeZone, ranges } = value as Record<string, unknown>;
  if (typeof enabled !== 'boolean') return fail('Enabled must be true or false.');
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 100) return fail('Choose a valid timezone.');
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); }
  catch { return fail('Choose a valid timezone, such as America/Edmonton.'); }
  if (!Array.isArray(ranges) || ranges.length > MAX_QUIET_HOURS_RANGES) {
    return fail(`Add no more than ${MAX_QUIET_HOURS_RANGES} quiet hours ranges.`);
  }
  if (enabled && !ranges.length) return fail('Add at least one time range to enable quiet hours.');
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return {
    enabled, timeZone,
    ranges: ranges.map((range: unknown, index: number) => {
      if (!range || typeof range !== 'object') return fail(`Range ${index + 1} is invalid.`);
      const { days, start, end } = range as Record<string, unknown>;
      if (!Array.isArray(days) || !days.length || days.length > 7
        || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
        return fail(`Choose at least one valid day for range ${index + 1}.`);
      }
      if (typeof start !== 'string' || typeof end !== 'string' || !timePattern.test(start) || !timePattern.test(end)) {
        return fail(`Use valid start and end times for range ${index + 1}.`);
      }
      if (start === end) return fail(`Start and end times must differ for range ${index + 1}.`);
      return { days: [...new Set(days)].sort((a, b) => a - b), start, end };
    })
  };
}

/** Local wall-clock ranges, inclusive at the start and exclusive at the end.
 * Overnight ranges belong to their starting day; DST repeats match both times.
 */
export function isWithinQuietHours(settings: QuietHoursSettings, now: Date = new Date()): boolean {
  if (!settings.enabled || !settings.ranges.length) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: settings.timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(part('weekday'));
  const time = `${part('hour')}:${part('minute')}`;
  return settings.ranges.some(range => range.start < range.end
    ? range.days.includes(day) && time >= range.start && time < range.end
    : (range.days.includes(day) && time >= range.start)
      || (range.days.includes((day + 6) % 7) && time < range.end));
}

export function decideQuietHours(command: Command, history: Event[], now: Date): Event[] {
  const settings = parseQuietHours(command.payload);
  const previous = history.filter(event => event.eventType === 'AlertQuietHoursUpdatedEvent').at(-1);
  if (JSON.stringify(previous?.eventData.settings) === JSON.stringify(settings)) return [];
  return [{
    aggregateId: quietHoursAggregate(command.userId), aggregateType: 'AlertPreferences',
    eventType: 'AlertQuietHoursUpdatedEvent', eventVersion: 1,
    eventData: { userId: command.userId, settings, timestamp: now.toISOString() },
    createdAt: now, sequenceNumber: 0
  }];
}
