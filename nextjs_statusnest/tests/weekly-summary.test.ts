import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import type { Event } from '@/types';
import { summarizeDomain, renderUptimeReport, WEEK_MS, type Observation } from '@/lib/email/uptime-report';
import { decideSummaryCommand, startSummarySchedule, summaryAggregate } from '@/lib/email/weekly-summary';

const dataPath = mkdtempSync(join(tmpdir(), 'statusnest-summary-test-'));
process.env.DATABASE_PATH = dataPath;
process.env.BACKGROUND_PROCESSOR_API_KEY = 'summary-test-key';
process.env.NEXT_PHASE = 'phase-production-build';
after(() => rmSync(dataPath, { recursive: true, force: true }));

const origin = Date.parse('2026-11-01T00:00:00Z');
const at = (minutes: number) => new Date(origin + minutes * 60_000).toISOString();
const observation = (minutes: number, kind: Observation['kind'], sequence: number): Observation => ({ at: at(minutes), kind, sequence });

test('time-weighted uptime groups offline checks into one recovered outage', () => {
  const result = summarizeDomain('d', 'example.com', at(0), [
    observation(0, 'registered', 1), observation(0, 'online', 2),
    observation(5, 'offline', 3), observation(10, 'offline', 4), observation(15, 'online', 5)
  ], at(0), at(20));
  assert.equal(result.onlinePercentage, 50);
  assert.equal(result.coveragePercentage, 100);
  assert.equal(result.outages.length, 1);
  assert.equal(result.outages[0].durationMs, 10 * 60_000);
  assert.equal(result.outages[0].ending, 'recovered');
});

test('pauses and stale checks are excluded, with honest coverage and separate episodes after a gap', () => {
  const result = summarizeDomain('d', 'example.com', at(0), [
    observation(0, 'registered', 1), observation(0, 'offline', 2),
    observation(20, 'offline', 3), observation(25, 'deactivated', 4),
    observation(27, 'online', 5), // in-flight result after pause must not add coverage
    observation(30, 'activated', 6), observation(35, 'online', 7)
  ], at(0), at(40));
  assert.equal(result.offlineMs, 15 * 60_000);
  assert.equal(result.onlineMs, 5 * 60_000);
  assert.equal(result.unknownMs, 15 * 60_000);
  assert.equal(result.pausedMs, 5 * 60_000);
  assert.equal(result.onlinePercentage, 25);
  assert.equal(result.outages.length, 2);
  assert.deepEqual(result.outages.map(o => o.ending), ['coverage lost', 'monitoring paused']);
});

test('windows clip carry-in outages and exclude checks at the end; no data is N/A', () => {
  const result = summarizeDomain('d', 'example.com', at(-10), [
    observation(-10, 'registered', 1), observation(-5, 'offline', 2), observation(5, 'online', 3)
  ], at(0), at(5));
  assert.equal(result.onlinePercentage, 0);
  assert.equal(result.outages[0].carriedIn, true);
  assert.equal(result.outages[0].startedAt, at(0));
  assert.equal(result.outages[0].ending, 'ongoing at report end');
  const empty = summarizeDomain('d', 'new.example', at(2), [observation(2, 'registered', 1)], at(0), at(10));
  assert.equal(empty.onlinePercentage, null);
  assert.equal(empty.unknownMs, 8 * 60_000);
  assert.equal(empty.coveragePercentage, 0);
  const text = renderUptimeReport({ periodStart: at(0), periodEnd: at(10), sourceSequence: 1, domains: [empty] }, 'https://statusnest.com/dashboard');
  assert.match(text, /Overall online: N\/A/);
  assert.match(text, /Coverage: 0.00%/);
});

test('summary decision is idempotent, atomically requests email and advances schedule, skips missed weeks', () => {
  const userId = 'test-user';
  const now = new Date(origin);
  const started = startSummarySchedule(userId, 'owner@example.com', now, true);
  const command = { userId, aggregateId: summaryAggregate(userId), type: 'PrepareWeeklySummary', payload: { dueAt: at(0) } };
  const late = new Date(origin + WEEK_MS * 3 + 10_000);
  const report = { periodStart: new Date(origin + WEEK_MS * 2).toISOString(), periodEnd: new Date(origin + WEEK_MS * 3).toISOString(), sourceSequence: 1, domains: [] };
  const events = decideSummaryCommand(command, [started], late, report);
  assert.deepEqual(events.map(e => e.eventType), ['WeeklySummaryPreparedEvent', 'EmailNotificationRequestedEvent']);
  assert.equal(events[0].eventData.nextDueAt, new Date(origin + WEEK_MS * 4).toISOString());
  assert.equal(events[1].eventData.to, 'owner@example.com');
  assert.equal(events[1].aggregateId, events[0].eventData.notificationId);
  assert.deepEqual(decideSummaryCommand(command, [started, events[0]], late, report), []);
  assert.deepEqual(decideSummaryCommand(command, [started], new Date(origin - 1), report), []);
});

async function setup() {
  const { CommandBus } = await import('@/lib/cqrs/command-bus');
  const { EventStore } = await import('@/lib/cqrs/event-store');
  const { getSystemDatabase, getReadModelDatabase } = await import('@/lib/infrastructure/database/connection');
  const { catchUpReporting, queryUptimeReport } = await import('@/lib/email/reporting-projection');
  const userId = randomUUID();
  const email = `${userId}@example.com`;
  const db = getSystemDatabase();
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, 'test-only');
  db.close();
  return { userId, email, bus: new CommandBus(), store: new EventStore(), getReadModelDatabase, catchUpReporting, queryUptimeReport };
}

test('new registration requests one welcome and first report in a week, even when registration is retried', async () => {
  const { userId, email, bus, store } = await setup();
  const command = { userId, aggregateId: userId, type: 'RecordUserRegistration', payload: { email } };
  await bus.dispatch(command);
  await bus.dispatch(command);
  const events = await store.getEvents(userId);
  assert.equal(events.filter(e => e.eventType === 'UserRegisteredEvent').length, 1);
  const welcome = events.filter(e => e.eventData.kind === 'onboarding');
  assert.equal(welcome.length, 1);
  assert.equal(welcome[0].eventData.to, email);
  assert.match(welcome[0].eventData.text, /\/dashboard/);
  assert.match(welcome[0].eventData.text, /\/profile/);
  const schedule = events.find(e => e.eventType === 'WeeklySummaryScheduleStartedEvent')!;
  assert.equal(Date.parse(schedule.eventData.nextDueAt) - schedule.createdAt.getTime(), WEEK_MS);
});

test('historical checks backfill independently, isolate users, and replay reproduces the report', async () => {
  const { userId, store, getReadModelDatabase, catchUpReporting, queryUptimeReport } = await setup();
  const other = await setup();
  const event = (eventType: string, minutes: number, data: object): Event => ({
    aggregateId: 'd', aggregateType: 'Domain', eventType, eventVersion: 1,
    eventData: { domainId: 'd', domain: 'example.com', timestamp: at(minutes), ...data }, createdAt: new Date(at(minutes)), sequenceNumber: 0
  });
  await store.appendEvents(userId, [event('DomainRegisteredEvent', -10, {}), event('DomainStatusCheckedEvent', -5, { status: 'offline' }), event('DomainStatusCheckedEvent', 5, { status: 'online' })]);
  // Simulate an existing deployment whose main projection already processed these events.
  let db = getReadModelDatabase();
  db.prepare('INSERT INTO projection_checkpoints VALUES (?, 3, ?)').run(userId, at(0)); db.close();
  await catchUpReporting(userId);
  const before = queryUptimeReport(userId, at(0), at(10));
  assert.equal(before.domains[0].onlinePercentage, 50);
  assert.equal(before.domains[0].outages[0].carriedIn, true);
  assert.equal(queryUptimeReport(other.userId, at(0), at(10)).domains.length, 0);
  db = getReadModelDatabase();
  db.prepare('DELETE FROM reporting_checkpoints WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reporting_domains WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM reporting_observations WHERE user_id = ?').run(userId); db.close();
  await catchUpReporting(userId);
  assert.deepEqual(queryUptimeReport(userId, at(0), at(10)), before);
  assert.equal((await store.getEvents(userId)).length, 3);
});

test('rollout runs once, competing stale due commands request one email, and rebuilding cannot resend it', async () => {
  const { userId, bus, store, getReadModelDatabase, catchUpReporting } = await setup();
  const { runSummaryAutomation } = await import('@/lib/email/summary-automation');
  const { ProjectionEngine } = await import('@/lib/cqrs/projection-engine');
  const { QueryBus } = await import('@/lib/cqrs/query-bus');
  await runSummaryAutomation();
  await runSummaryAutomation();
  let events = await store.getEvents(userId);
  const schedule = events.find(e => e.eventType === 'WeeklySummaryScheduleStartedEvent')!;
  const command = { userId, aggregateId: summaryAggregate(userId), type: 'PrepareWeeklySummary', payload: { dueAt: schedule.eventData.nextDueAt } };
  await Promise.all([bus.dispatch(command), bus.dispatch(command)]);
  events = await store.getEvents(userId);
  assert.equal(events.filter(e => e.eventType === 'WeeklySummaryPreparedEvent').length, 1);
  assert.equal(events.filter(e => e.eventData.kind === 'weekly-summary').length, 1);
  assert.equal(events.filter(e => e.eventData.kind === 'onboarding').length, 0);
  const notification = events.find(e => e.eventData.kind === 'weekly-summary')!;
  await bus.dispatch({ userId, aggregateId: notification.aggregateId, type: 'ClaimEmailNotification', payload: { attemptId: 'worker' } });
  await bus.dispatch({ userId, aggregateId: notification.aggregateId, type: 'RecordEmailNotificationSent', payload: { attemptId: 'worker' } });
  const project = async () => { const engine = new ProjectionEngine(); await engine.start(); engine.stop(); };
  await project();
  const db = getReadModelDatabase();
  for (const table of ['reporting_checkpoints', 'weekly_summary_schedule', 'weekly_summary_reports', 'email_notifications', 'projection_checkpoints']) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
  }
  db.close();
  await catchUpReporting(userId);
  await project();
  await runSummaryAutomation();
  assert.equal((await store.getEvents(userId)).filter(e => e.eventData.kind === 'weekly-summary').length, 1);
  assert(!(await new QueryBus().getPendingEmails()).some(task => task.notificationId === notification.aggregateId));
});

test('post-deploy endpoint requires HMAC and repeated runs preserve report identity; GET does not write events', async () => {
  const { userId, store } = await setup();
  const { NextRequest } = await import('next/server');
  const { GET, POST } = await import('@/app/api/internal/weekly-summaries/route');
  const request = (method: string, signed = true) => new NextRequest('http://localhost/api/internal/weekly-summaries', {
    method, headers: signed ? { 'X-API-Key': 'summary-test-key', 'X-Signature': createHmac('sha256', 'summary-test-key').update('').digest('hex') } : {}
  });
  assert.equal((await POST(request('POST', false))).status, 401);
  assert.equal((await GET(request('GET', false))).status, 401);
  assert.equal((await POST(request('POST'))).status, 200);
  const before = await store.getEvents(userId);
  assert.equal((await POST(request('POST'))).status, 200);
  const response = await GET(request('GET'));
  assert.equal(response.status, 200);
  assert((await response.json()).reports.some((r: { userId: string }) => r.userId === userId));
  assert.deepEqual(await store.getEvents(userId), before);
});
