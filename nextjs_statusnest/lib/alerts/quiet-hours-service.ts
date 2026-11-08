import { getUserWriteDatabase } from '@/lib/infrastructure/database/connection';
import { defaultQuietHours, parseQuietHours, quietHoursAggregate, type QuietHoursSettings } from './quiet-hours';

/** Read the authoritative preference so a save applies to the very next alert. */
export function getQuietHours(userId: string): QuietHoursSettings {
  const db = getUserWriteDatabase(userId);
  try {
    const row = db.prepare(`SELECT event_data FROM events
      WHERE aggregate_id = ? AND event_type = 'AlertQuietHoursUpdatedEvent'
      ORDER BY sequence_number DESC LIMIT 1`).get(quietHoursAggregate(userId)) as { event_data: string } | undefined;
    return row ? parseQuietHours(JSON.parse(row.event_data).settings) : defaultQuietHours();
  } finally { db.close(); }
}
