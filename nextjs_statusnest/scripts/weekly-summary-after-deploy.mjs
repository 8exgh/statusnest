import { createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const apiKey = process.env.BACKGROUND_PROCESSOR_API_KEY;
if (!apiKey) throw new Error('BACKGROUND_PROCESSOR_API_KEY is required');
const url = 'http://127.0.0.1:3000/api/internal/weekly-summaries';
const headers = { 'X-API-Key': apiKey, 'X-Signature': createHmac('sha256', apiKey).update('').digest('hex') };
async function request(method) {
  const response = await fetch(url, { method, headers, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Weekly summary ${method} failed: HTTP ${response.status}`);
  return response.json();
}

const initial = await request('POST');
const ids = new Set(initial.reports.map(report => report.notificationId));
console.log(`Weekly summary automation completed; verifying ${ids.size} report delivery receipt(s).`);
for (let attempt = 0; attempt < 60; attempt++) {
  const { reports } = await request('GET');
  const expected = reports.filter(report => ids.has(report.notificationId));
  const pending = expected.filter(report => report.status !== 'sent' && report.status !== 'cancelled');
  if (expected.length === ids.size && !pending.length) {
    console.log(JSON.stringify({ verified: expected.map(({ notificationId, periodEnd, sentAt, status }) => ({ notificationId, periodEnd, sentAt, status })) }));
    console.log('All weekly summary emails have recorded SMTP acceptance or cancellation by preference.');
    process.exit(0);
  }
  if (attempt === 59) {
    console.error(JSON.stringify({ pending }));
    throw new Error('Summary emails have not all been accepted by SMTP within five minutes; queued tasks will keep retrying.');
  }
  await delay(5000);
}
