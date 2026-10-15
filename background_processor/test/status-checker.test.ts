import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { checkUrlWithin } from '../src/status-checker';

async function serve(respond: (request: number) => number | 'hang'): Promise<{ url: string; server: Server; requests: () => number }> {
  let requests = 0;
  const server = createServer((_req, res) => {
    const outcome = respond(++requests);
    if (outcome === 'hang') return;
    res.writeHead(outcome).end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, server, requests: () => requests };
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise(resolve => server.close(() => resolve()));
}

test('a fast 502 blip is retried instead of reported offline', async () => {
  const site = await serve(n => n <= 2 ? 502 : 200);
  try {
    const result = await checkUrlWithin(site.url, 3000, 50);
    assert.equal(result.status, 'online');
    assert.equal(result.responseCode, 200);
    assert.equal(result.attempts, 3);
    assert.ok(result.responseTimeMs < 1000, `response time is the successful request's own, got ${result.responseTimeMs}ms`);
  } finally {
    await close(site.server);
  }
});

test('a persistent 5xx is offline only after the whole window, keeping the status code', async () => {
  const site = await serve(() => 502);
  try {
    const result = await checkUrlWithin(site.url, 600, 50);
    assert.equal(result.status, 'offline');
    assert.equal(result.responseCode, 502);
    assert.ok(result.responseTimeMs >= 600, `waited the full window, got ${result.responseTimeMs}ms`);
    assert.ok(site.requests() > 1);
  } finally {
    await close(site.server);
  }
});

test('connection refused is offline only after the whole window', async () => {
  const site = await serve(() => 200);
  await close(site.server);
  const result = await checkUrlWithin(site.url, 400, 50);
  assert.equal(result.status, 'offline');
  assert.equal(result.responseCode, undefined);
  assert.ok(result.responseTimeMs >= 400, `waited the full window, got ${result.responseTimeMs}ms`);
  assert.ok(result.attempts > 1);
});

test('no response within the window is offline after exactly one long attempt', async () => {
  const site = await serve(() => 'hang');
  try {
    const result = await checkUrlWithin(site.url, 300, 50);
    assert.equal(result.status, 'offline');
    assert.equal(result.attempts, 1);
    assert.ok(result.responseTimeMs >= 300 && result.responseTimeMs < 1000, `got ${result.responseTimeMs}ms`);
  } finally {
    await close(site.server);
  }
});

test('a 4xx answer means the server is up', async () => {
  for (const code of [401, 403, 404, 405]) {
    const site = await serve(() => code);
    try {
      const result = await checkUrlWithin(site.url, 1000, 50);
      assert.equal(result.status, 'online', `HTTP ${code}`);
      assert.equal(result.attempts, 1);
    } finally {
      await close(site.server);
    }
  }
});
