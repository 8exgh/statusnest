import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultQuietHours, isWithinQuietHours, parseQuietHours, quietHoursAggregate, QuietHoursValidationError, type QuietHoursSettings } from '@/lib/alerts/quiet-hours';
import type { AlertTrayPushRequest } from '@/lib/alerts/alerttray-client';

const dataPath = mkdtempSync(join(tmpdir(), 'statusnest-quiet-hours-test-'));
process.env.DATABASE_PATH = dataPath;
process.env.NEXT_PHASE = 'phase-production-build';
after(() => rmSync(dataPath, { recursive: true, force: true }));

const schedule = (start = '22:00', end = '07:00', days = [0, 1, 2, 3, 4, 5, 6], timeZone = 'UTC'): QuietHoursSettings => ({
  enabled: true, timeZone, ranges: [{ days, start, end }]
});
const active = (settings: QuietHoursSettings, iso: string) => isWithinQuietHours(settings, new Date(iso));

test('quiet hours are off by default and same-day ranges include the start but exclude the end', () => {
  assert.equal(active(defaultQuietHours(), '2026-11-09T12:00:00Z'), false);
  const settings = schedule('12:00', '13:00', [1]); // Monday
  assert.equal(active(settings, '2026-11-09T11:59:59Z'), false);
  assert.equal(active(settings, '2026-11-09T12:00:00Z'), true);
  assert.equal(active(settings, '2026-11-09T12:59:59Z'), true);
  assert.equal(active(settings, '2026-11-09T13:00:00Z'), false);
  assert.equal(active(settings, '2026-11-10T12:00:00Z'), false);
  assert.equal(active({ ...settings, enabled: false }, '2026-11-09T12:00:00Z'), false);
});

test('overnight ranges follow the starting day, including the Saturday/Sunday wrap', () => {
  const settings = schedule('22:00', '07:00', [6]);
  assert.equal(active(settings, '2026-11-07T06:00:00Z'), false);
  assert.equal(active(settings, '2026-11-07T21:59:59Z'), false);
  assert.equal(active(settings, '2026-11-07T22:00:00Z'), true);
  assert.equal(active(settings, '2026-11-08T00:00:00Z'), true);
  assert.equal(active(settings, '2026-11-08T06:59:59Z'), true);
  assert.equal(active(settings, '2026-11-08T07:00:00Z'), false);
  assert.equal(active(settings, '2026-11-08T22:00:00Z'), false);
});

test('multiple and overlapping ranges are combined without filling gaps', () => {
  const settings = schedule('08:00', '10:00');
  settings.ranges.push({ days: [1], start: '09:00', end: '11:00' }, { days: [1], start: '14:00', end: '15:00' });
  for (const time of ['08:00', '09:30', '10:59', '14:00']) assert.equal(active(settings, `2026-11-09T${time}:00Z`), true);
  for (const time of ['07:59', '11:00', '13:59', '15:00']) assert.equal(active(settings, `2026-11-09T${time}:00Z`), false);
});

test('timezone determines the local date and supports fractional offsets', () => {
  const settings = schedule('22:00', '07:00', [6], 'America/Edmonton');
  assert.equal(active(settings, '2026-11-08T04:59:59Z'), false);
  assert.equal(active(settings, '2026-11-08T05:00:00Z'), true); // Saturday 22:00
  assert.equal(active(settings, '2026-11-08T14:00:00Z'), false);
  assert.equal(active(schedule('12:00', '13:00', [1], 'Asia/Kathmandu'), '2026-11-09T06:15:00Z'), true);
});

test('local schedules follow daylight saving, including skipped and repeated hours', () => {
  const night = schedule('22:00', '07:00', [0, 1, 2, 3, 4, 5, 6], 'America/Edmonton');
  assert.equal(active(night, '2026-01-12T04:30:00Z'), false); // 21:30 winter
  assert.equal(active(night, '2026-07-12T04:30:00Z'), true); // 22:30 summer
  const spring = schedule('01:30', '03:30', [0], 'America/Edmonton');
  assert.equal(active(spring, '2026-03-08T08:29:59Z'), false);
  assert.equal(active(spring, '2026-03-08T08:30:00Z'), true);
  assert.equal(active(spring, '2026-03-08T09:00:00Z'), true); // jumps to 03:00
  assert.equal(active(spring, '2026-03-08T09:30:00Z'), false);
  const fall = schedule('01:30', '02:00', [0], 'America/Edmonton');
  assert.equal(active(fall, '2026-11-01T07:45:00Z'), true); // first 01:45
  assert.equal(active(fall, '2026-11-01T08:45:00Z'), true); // repeated 01:45
  assert.equal(active(fall, '2026-11-01T09:00:00Z'), false);
});

test('validation rejects ambiguous or malformed schedules and normalizes weekday selection', () => {
  const settings = schedule();
  for (const invalid of [null, [], {}, { ...settings, enabled: 'true' }, { ...settings, timeZone: 'Invalid/Zone' },
    { ...settings, timeZone: '' }, { ...settings, ranges: [] }, { ...settings, ranges: '22:00-07:00' },
    { ...settings, ranges: Array(15).fill(settings.ranges[0]) }, { ...settings, ranges: [null] },
    schedule('24:00', '07:00'), schedule('22:60', '07:00'), schedule('9:00', '10:00'), schedule('07:00', '07:00'),
    schedule('22:00', '07:00', []), schedule('22:00', '07:00', [7]), schedule('22:00', '07:00', [1.5]),
    { ...settings, ranges: [{ days: ['1'], start: '22:00', end: '07:00' }] }
  ]) assert.throws(() => parseQuietHours(invalid), QuietHoursValidationError);
  assert.deepEqual(parseQuietHours(defaultQuietHours()), defaultQuietHours());
  assert.deepEqual(parseQuietHours(schedule('22:00', '07:00', [3, 1, 3])).ranges[0].days, [1, 3]);
});

async function setup() {
  const { CommandBus } = await import('@/lib/cqrs/command-bus');
  const { EventStore } = await import('@/lib/cqrs/event-store');
  const { getSystemDatabase } = await import('@/lib/infrastructure/database/connection');
  const { getQuietHours } = await import('@/lib/alerts/quiet-hours-service');
  const userId = randomUUID();
  const email = `${userId}@example.com`;
  const db = getSystemDatabase();
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, 'test-only');
  db.close();
  return { userId, email, bus: new CommandBus(), store: new EventStore(), getQuietHours };
}

test('authenticated preferences persist immediately, isolate accounts, reject invalid input, and disable without losing ranges', async () => {
  const { userId, store, getQuietHours } = await setup();
  const other = await setup();
  const { createSession } = await import('@/lib/infrastructure/security/auth');
  const { NextRequest } = await import('next/server');
  const { GET, PUT } = await import('@/app/api/alert-preferences/route');
  const { token } = await createSession(userId);
  const request = (method: string, body?: string, auth = token) => new NextRequest('http://localhost/api/alert-preferences', {
    method, body, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }
  });
  assert.equal((await GET(request('GET', undefined, ''))).status, 401);
  assert.equal((await PUT(request('PUT', JSON.stringify(schedule()), 'invalid-token'))).status, 401);
  assert.deepEqual((await (await GET(request('GET'))).json()).quietHours, defaultQuietHours());
  assert.equal((await PUT(request('PUT', '{'))).status, 400);
  assert.equal((await PUT(request('PUT', JSON.stringify(schedule('22:00', '22:00'))))).status, 400);
  const settings = schedule('22:00', '07:00', [1, 2, 3, 4, 5], 'America/Edmonton');
  const response = await PUT(request('PUT', JSON.stringify({ ...settings, userId: other.userId })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).quietHours, settings);
  assert.deepEqual(getQuietHours(userId), settings);
  assert.deepEqual(getQuietHours(other.userId), defaultQuietHours());
  assert.deepEqual((await (await GET(request('GET'))).json()).quietHours, settings);
  await PUT(request('PUT', JSON.stringify(settings)));
  assert.equal((await store.getEvents(userId)).length, 1); // repeated saves are idempotent
  assert.equal((await PUT(request('PUT', 'null'))).status, 400);
  assert.deepEqual(getQuietHours(userId), settings);
  assert.equal((await PUT(request('PUT', JSON.stringify({ ...settings, enabled: false })))).status, 200);
  assert.deepEqual(getQuietHours(userId), { ...settings, enabled: false });
  assert.deepEqual((await store.getEvents(userId)).map(event => event.eventType), ['AlertQuietHoursUpdatedEvent', 'AlertQuietHoursUpdatedEvent']);
});

test('outage dispatch uses email only during quiet hours, preserves normal alerts outside, and records delivery results', async () => {
  const { userId, email, bus, store } = await setup();
  const { ContactDetailsService } = await import('@/lib/infrastructure/users/contact-details');
  const { AlertTrayClient } = await import('@/lib/alerts/alerttray-client');
  const { alertDomainOffline, shouldAlertOffline } = await import('@/lib/alerts/offline-alerts');
  const requests: AlertTrayPushRequest[] = [];
  const client = new AlertTrayClient({ apiKey: 'test-only', fetchImpl: async (_url, options) => {
    const request = JSON.parse(options!.body as string) as AlertTrayPushRequest;
    requests.push(request);
    return new Response(JSON.stringify({ success: true, notificationId: `alert-${requests.length}`,
      channels: request.severity === 'medium' ? ['email'] : ['call', 'sms'], skippedChannels: [] }), { status: 200 });
  } });
  const check = { userId, domainId: 'test-domain', domain: 'example.com', checkedAt: new Date('2026-11-09T12:00:00Z') };
  ContactDetailsService.update(userId, { phoneNumber: '+14155552671', notificationEmail: 'alerts@example.com' });
  const send = (iso: string) => alertDomainOffline(check, client, new Date(iso));
  await send('2026-11-09T22:00:00Z'); // no preference: normal behavior
  assert.equal(requests.at(-1)!.severity, 'critical');
  await bus.dispatch({ userId, aggregateId: quietHoursAggregate(userId), type: 'SetAlertQuietHours', payload: schedule() });
  await send('2026-11-09T22:00:00Z'); // dispatch time wins over the earlier check timestamp
  assert.equal(requests.at(-1)!.severity, 'medium');
  assert.deepEqual(requests.at(-1)!.recipients, { phoneNumber: null, email: 'alerts@example.com' });
  assert.equal(requests.at(-1)!.metadata!.quietHoursActive, true);
  assert.deepEqual(ContactDetailsService.getAlertRecipients(userId), { phoneNumber: '+14155552671', email: 'alerts@example.com' });
  const sent = (await store.getEvents(userId)).filter(event => event.eventType === 'DomainOfflineAlertSentEvent');
  assert.deepEqual(sent.at(-1)!.eventData.channels, ['email']);
  assert.deepEqual(sent.at(-1)!.eventData.recipients, { phoneNumber: null, email: 'alerts@example.com' });
  ContactDetailsService.update(userId, { phoneNumber: '+14155552671', notificationEmail: null });
  await send('2026-11-10T06:59:59Z');
  assert.deepEqual(requests.at(-1)!.recipients, { phoneNumber: null, email });
  await send('2026-11-10T07:00:00Z');
  assert.equal(requests.at(-1)!.severity, 'critical');
  assert.equal(requests.at(-1)!.recipients.phoneNumber, '+14155552671');
  await bus.dispatch({ userId, aggregateId: quietHoursAggregate(userId), type: 'SetAlertQuietHours', payload: { ...schedule(), enabled: false } });
  await send('2026-11-10T22:00:00Z');
  assert.equal(requests.at(-1)!.severity, 'critical');
  assert.equal(requests.at(-1)!.recipients.phoneNumber, '+14155552671');
  assert.equal(shouldAlertOffline('offline', 'offline'), false);
  assert.equal(shouldAlertOffline('online', 'offline'), true);
  // Email delivery failure is recorded without retrying through phone channels.
  await bus.dispatch({ userId, aggregateId: quietHoursAggregate(userId), type: 'SetAlertQuietHours', payload: schedule() });
  let failedRequests = 0;
  const failingClient = new AlertTrayClient({ apiKey: 'test-only', fetchImpl: async (_url, options) => {
    failedRequests++;
    assert.equal(JSON.parse(options!.body as string).severity, 'medium');
    return new Response(JSON.stringify({ error: 'Email delivery unavailable' }), { status: 503 });
  } });
  await alertDomainOffline(check, failingClient, new Date('2026-11-10T22:00:00Z'));
  assert.equal(failedRequests, 1);
  assert.equal((await store.getEvents(userId)).at(-1)!.eventType, 'DomainOfflineAlertFailedEvent');
});
