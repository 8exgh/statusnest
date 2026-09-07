import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
import type { Command, Event } from '@/types';

const dataPath = mkdtempSync(join(tmpdir(), 'statusnest-email-test-'));
process.env.DATABASE_PATH = dataPath;
process.env.BACKGROUND_PROCESSOR_API_KEY = 'email-test-key';
// Route tests must not start the public-site seeder or projection interval.
process.env.NEXT_PHASE = 'phase-production-build';
after(() => rmSync(dataPath, { recursive: true, force: true }));

async function setup() {
  const { CommandBus } = await import('@/lib/cqrs/command-bus');
  const { EventStore } = await import('@/lib/cqrs/event-store');
  const { QueryBus } = await import('@/lib/cqrs/query-bus');
  const { ProjectionEngine } = await import('@/lib/cqrs/projection-engine');
  const { getSystemDatabase, getReadModelDatabase } = await import('@/lib/infrastructure/database/connection');
  const userId = randomUUID();
  const db = getSystemDatabase();
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, `${userId}@example.com`, 'test-only');
  db.close();
  const engine = new ProjectionEngine();
  const project = async () => { await engine.start(); engine.stop(); };
  return { userId, bus: new CommandBus(), store: new EventStore(), query: new QueryBus(), project, getReadModelDatabase };
}

test('signup and website commands queue one email each; unrelated events and public monitors do not', async () => {
  const { userId, bus, store, query, project } = await setup();
  const email = `${userId}@example.com`;
  await bus.dispatch({ userId, aggregateId: userId, type: 'RecordUserRegistration', payload: { email } });
  const domainId = randomUUID();
  await bus.dispatch({ userId, aggregateId: domainId, type: 'RegisterDomain', payload: { domain: 'example.com' } });
  await bus.dispatch({ userId, aggregateId: domainId, type: 'ActivateDomain', payload: { domainId, domain: 'example.com' } });
  await bus.dispatch({ userId, aggregateId: `public-${userId}`, type: 'RegisterPublicSite', payload: { slug: `public-${userId}`, name: 'Example', url: 'https://example.com' } });
  const events = await store.getEvents(userId);
  assert.equal(events.filter(event => event.eventType === 'EmailNotificationRequestedEvent').length, 2);
  assert.equal((await query.getPendingEmails()).filter(task => task.userId === userId).length, 0);
  await project();
  const tasks = (await query.getPendingEmails()).filter(task => task.userId === userId);
  assert.equal(tasks.length, 2);
  assert(tasks.every(task => task.to === 'sbennett@8examples.com' && task.text.includes(email)));
  assert(tasks.some(task => task.subject.includes('signup')));
  assert(tasks.some(task => task.subject.includes('website') && task.text.includes('Website: example.com')));
  await project();
  assert.deepEqual((await query.getPendingEmails()).filter(task => task.userId === userId), tasks);
});

test('claims serialize before projection catches up; receipts are idempotent and survive a read-model rebuild', async () => {
  const { userId, bus, store, query, project, getReadModelDatabase } = await setup();
  await bus.dispatch({ userId, aggregateId: userId, type: 'RecordUserRegistration', payload: { email: 'owner@example.com' } });
  await project();
  const task = (await query.getPendingEmails()).find(task => task.userId === userId)!;
  const command = (type: string, attemptId: string): Command => ({ userId, aggregateId: task.notificationId, type, payload: { attemptId } });
  const claims = await Promise.allSettled([
    bus.dispatch(command('ClaimEmailNotification', 'worker-one')),
    bus.dispatch(command('ClaimEmailNotification', 'worker-two'))
  ]);
  assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1);
  await assert.rejects(bus.dispatch(command('RecordEmailNotificationSent', 'worker-two')));
  await bus.dispatch(command('RecordEmailNotificationSent', 'worker-one'));
  await bus.dispatch(command('RecordEmailNotificationSent', 'worker-one'));
  await assert.rejects(bus.dispatch(command('ClaimEmailNotification', 'worker-three')));
  assert.equal((await store.getEvents(userId)).filter(event => event.eventType === 'EmailNotificationSentEvent').length, 1);
  await project();
  assert(!(await query.getPendingEmails()).some(task => task.userId === userId));
  const db = getReadModelDatabase();
  db.prepare('DELETE FROM email_notifications WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM projection_checkpoints WHERE user_id = ?').run(userId);
  db.close();
  await project();
  assert(!(await query.getPendingEmails()).some(task => task.userId === userId));
});

test('failure backs off; expired claims recover; stale workers cannot acknowledge a newer claim', async () => {
  const { userId, store, query, project } = await setup();
  const { requestEmail, decideEmailCommand, EMAIL_LEASE_MS } = await import('@/lib/email/notifications');
  const start = new Date(Date.now() - 60 * 60 * 1000);
  const request = requestEmail(userId, 'owner@example.com', start);
  const history: Event[] = [request];
  const decide = (type: string, attemptId: string, now: Date) => decideEmailCommand({
    userId, aggregateId: request.aggregateId, type, payload: { attemptId, error: 'SMTP unavailable' }
  }, history, now);
  history.push(...decide('ClaimEmailNotification', 'one', start));
  history.push(...decide('RecordEmailNotificationFailed', 'one', start));
  assert.throws(() => decide('ClaimEmailNotification', 'too-early', new Date(start.getTime() + 59_999)));
  assert.equal(decide('RecordEmailNotificationFailed', 'one', start).length, 0);
  const retryAt = new Date(start.getTime() + 60_000);
  history.push(...decide('ClaimEmailNotification', 'two', retryAt));
  assert.throws(() => decide('ClaimEmailNotification', 'three', new Date(retryAt.getTime() + EMAIL_LEASE_MS - 1)));
  history.push(...decide('ClaimEmailNotification', 'three', new Date(retryAt.getTime() + EMAIL_LEASE_MS)));
  assert.throws(() => decide('RecordEmailNotificationSent', 'two', new Date()));
  await store.appendEvents(userId, history);
  await project();
  assert((await query.getPendingEmails()).some(task => task.notificationId === request.aggregateId));
});

test('replaying historical registrations never creates retrospective email tasks', async () => {
  const { userId, store, query, project } = await setup();
  await store.appendEvents(userId, [{
    aggregateId: userId, aggregateType: 'User', eventType: 'UserRegisteredEvent', eventVersion: 1,
    eventData: { userId, email: 'old@example.com' }, createdAt: new Date('2020-01-01'), sequenceNumber: 0
  }, {
    aggregateId: randomUUID(), aggregateType: 'Domain', eventType: 'DomainRegisteredEvent', eventVersion: 1,
    eventData: { domainId: randomUUID(), domain: 'old.example.com' }, createdAt: new Date('2020-01-01'), sequenceNumber: 0
  }]);
  await project();
  assert(!(await query.getPendingEmails()).some(task => task.userId === userId));
});

test('email API authenticates, validates paths and JSON, and returns conflict status for claimed work', async () => {
  const { userId, bus, project } = await setup();
  const { NextRequest } = await import('next/server');
  const { GET, POST } = await import('@/app/api/internal/email-tasks/route');
  const request = (method: string, body?: string, signed = true) => new NextRequest('http://localhost/api/internal/email-tasks', {
    method, body,
    headers: signed ? { 'X-API-Key': 'email-test-key', 'X-Signature': createHmac('sha256', 'email-test-key').update(body ?? '').digest('hex') } : {}
  });
  assert.equal((await GET(request('GET', undefined, false))).status, 401);
  assert.equal((await POST(request('POST', '{'))).status, 400);
  assert.equal((await POST(request('POST', JSON.stringify({ action: 'claim', userId: '../system', notificationId: 'id', attemptId: 'one' })))).status, 400);
  await bus.dispatch({ userId, aggregateId: userId, type: 'RecordUserRegistration', payload: { email: 'api@example.com' } });
  await project();
  const response = await GET(request('GET'));
  assert.equal(response.status, 200);
  const { tasks } = await response.json();
  const task = tasks.find((task: { userId: string }) => task.userId === userId);
  const body = JSON.stringify({ userId, notificationId: task.notificationId, attemptId: 'one', action: 'claim' });
  assert.equal((await POST(request('POST', body, false))).status, 401);
  assert.equal((await POST(request('POST', body))).status, 200);
  assert.equal((await POST(request('POST', body))).status, 409);
});

test('real registration routes queue emails only for successful signup and website addition', async () => {
  const { NextRequest } = await import('next/server');
  const { POST: signup } = await import('@/app/api/auth/register/route');
  const { POST: addWebsite } = await import('@/app/api/domains/register/route');
  const { EventStore } = await import('@/lib/cqrs/event-store');
  const email = `${randomUUID()}@example.com`;
  const signupRequest = () => new NextRequest('http://localhost/api/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password: 'test-password-only' })
  });
  const response = await signup(signupRequest());
  assert.equal(response.status, 200);
  const { user, token } = await response.json();
  assert.equal((await signup(signupRequest())).status, 400);
  const domainRequest = (domain: string) => new NextRequest('http://localhost/api/domains/register', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ domain })
  });
  assert.equal((await addWebsite(domainRequest('not a domain'))).status, 400);
  assert.equal((await addWebsite(domainRequest('example.com'))).status, 200);
  const events = await new EventStore().getEvents(user.id);
  const emails = events.filter(event => event.eventType === 'EmailNotificationRequestedEvent');
  assert.equal(emails.length, 2);
  assert.deepEqual(emails.map(event => event.eventData.kind), ['signup', 'website-added']);
  assert(emails.every(event => event.eventData.to === 'sbennett@8examples.com' && event.eventData.text.includes(email)));
});
