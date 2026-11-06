import { CommandBus } from '@/lib/cqrs/command-bus';
import { getSystemDatabase } from '@/lib/infrastructure/database/connection';
import { catchUpReporting, getWeeklySummaryPreference } from './reporting-projection';
import { summaryAggregate } from './weekly-summary';

export async function setWeeklySummaryPreference(userId: string, enabled: boolean, source: 'profile' | 'unsubscribe') {
  const db = getSystemDatabase();
  let account: { email: string } | undefined;
  try { account = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as typeof account; }
  finally { db.close(); }
  if (!account) return null;
  const bus = new CommandBus();
  await bus.dispatch({ userId, aggregateId: summaryAggregate(userId), type: 'StartWeeklySummaries', payload: { email: account.email } });
  await bus.dispatch({ userId, aggregateId: summaryAggregate(userId), type: 'SetWeeklySummaryPreference', payload: { enabled, source } });
  await catchUpReporting(userId);
  return getWeeklySummaryPreference(userId);
}
