import { CommandBus } from '@/lib/cqrs/command-bus';
import { getSystemDatabase } from '@/lib/infrastructure/database/connection';
import { catchUpReporting, getDueSummaries } from './reporting-projection';
import { summaryAggregate } from './weekly-summary';

let running: Promise<void> | undefined;

/** Timer robot: translate accounts into schedules, read the todo view, issue commands. */
export function runSummaryAutomation(): Promise<void> {
  if (running) return running;
  running = run().finally(() => { running = undefined; });
  return running;
}

async function run(): Promise<void> {
  const db = getSystemDatabase();
  let accounts: { id: string; email: string }[];
  try { accounts = db.prepare('SELECT id, email FROM users ORDER BY id').all() as typeof accounts; }
  finally { db.close(); }
  const bus = new CommandBus();
  const failures: string[] = [];
  for (const account of accounts) {
    try {
      // New registrations already have a schedule. Existing accounts get one
      // immediate report on rollout; the event stream makes enrollment idempotent.
      await bus.dispatch({ userId: account.id, aggregateId: summaryAggregate(account.id), type: 'StartWeeklySummaries', payload: { email: account.email } });
      await catchUpReporting(account.id);
    } catch (error) {
      failures.push(account.id);
      console.error(`Weekly summary enrollment/projection failed for ${account.id}`, error);
    }
  }
  const accountIds = new Set(accounts.map(a => a.id));
  for (const due of getDueSummaries(new Date())) {
    if (!accountIds.has(due.userId) || failures.includes(due.userId)) continue;
    try {
      await bus.dispatch({ userId: due.userId, aggregateId: summaryAggregate(due.userId), type: 'PrepareWeeklySummary', payload: { dueAt: due.nextDueAt } });
      await catchUpReporting(due.userId);
    } catch (error) {
      failures.push(due.userId);
      console.error(`Weekly summary preparation failed for ${due.userId}`, error);
    }
  }
  if (failures.length) throw new Error(`Weekly summary automation failed for ${failures.length} account(s); will retry`);
}

let timer: NodeJS.Timeout | undefined;
export function startSummaryAutomation(): void {
  if (timer) return;
  const tick = () => runSummaryAutomation().catch(error => console.error('Weekly summaries:', error));
  timer = setInterval(tick, 60_000);
  timer.unref();
  void tick();
}
