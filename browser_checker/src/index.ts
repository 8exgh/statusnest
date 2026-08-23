import * as dotenv from 'dotenv';
import { ApiClient } from './api-client';
import { BrowserChecker } from './checker';

dotenv.config();

/**
 * Browser checker: polls StatusNest for public-monitor sites that are due,
 * visits each of their pages in a real Chromium and reports what it saw.
 * Scheduling (the 5–20 minute jitter) lives on the server; this process just
 * does what it is handed. The server claims a site for 10 minutes when it
 * hands it out and gives out at most 3 sites per poll, so every visit must
 * finish comfortably inside that window.
 */

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 30_000;

class BrowserCheckerService {
  private readonly api = new ApiClient();
  private readonly checker = new BrowserChecker();
  private running = true;
  private idle: Promise<void> = Promise.resolve();

  async start(): Promise<void> {
    console.log('Browser checker started');
    console.log(`API URL: ${this.api.url}`);
    console.log(`Poll interval: ${POLL_INTERVAL_MS}ms, display: ${this.checker.display}`);

    // Warm the browser up so the first poll does not pay the launch cost.
    await this.checker.getBrowser().catch(error => console.error('Initial Chromium launch failed:', error));

    while (this.running) {
      try {
        this.idle = this.processDueSites();
        await this.idle;
      } catch (error) {
        console.error('Error in poll loop:', error);
      }
      if (this.running) {
        await sleep(POLL_INTERVAL_MS);
      }
    }
  }

  private async processDueSites(): Promise<void> {
    const tasks = await this.api.getPublicTasks();
    if (tasks.length === 0) {
      return;
    }
    console.log(`Visiting ${tasks.length} site(s): ${tasks.map(t => t.slug).join(', ')}`);

    for (const task of tasks) {
      if (!this.running) return;
      try {
        const visit = await this.checker.visitSite(task);
        if (visit.results.length === 0) {
          console.warn(`⚠️  ${task.slug}: no page results, nothing to report`);
          continue;
        }
        const recorded = await this.api.reportSiteCheck({
          siteId: task.siteId,
          checkedAt: visit.checkedAt,
          checker: visit.checker,
          results: visit.results,
        });
        console.log(`✓ ${task.slug} reported (${recorded} pages)`);
      } catch (error) {
        console.error(`✗ ${task.slug}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    console.log('\nShutting down: waiting for the current site visit to finish...');
    await Promise.race([this.idle, sleep(20_000)]);
    await this.checker.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const service = new BrowserCheckerService();

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}`);
    service.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await service.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
