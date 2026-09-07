import * as dotenv from 'dotenv';
import { ApiClient } from './api-client';
import { checkDomainStatus } from './status-checker';
import { EmailProcessor } from './email-processor';
import { createEmailSender } from './email-sender';

dotenv.config();

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

class BackgroundProcessor {
  private checkInterval = 5000;
  private apiClient: ApiClient;
  
  constructor() {
    this.apiClient = new ApiClient();
  }
  
  async start(): Promise<void> {
    console.log('Background processor started');
    console.log(`API URL: ${process.env.STATUSNEST_API_URL || 'http://localhost:3000'}`);
    console.log(`Check interval: ${this.checkInterval}ms`);
    
    const sender = createEmailSender();
    if (!sender) console.warn('Email delivery disabled: set GMAIL_USER and GMAIL_APP_PASSWORD. Email tasks remain queued.');
    const emailProcessor = sender ? new EmailProcessor(this.apiClient, sender) : null;
    await Promise.all([
      this.runLoop(() => this.processPendingChecks()),
      ...(emailProcessor ? [this.runLoop(() => emailProcessor.process())] : [])
    ]);
  }

  private async runLoop(processTasks: () => Promise<void>): Promise<void> {
    while (true) {
      try {
        await processTasks();
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
      
      await this.sleep(this.checkInterval);
    }
  }
  
  private async processPendingChecks(): Promise<void> {
    const tasks = await this.apiClient.getPendingTasks();
    
    if (tasks.length === 0) {
      return;
    }
    
    console.log(`Processing ${tasks.length} domain checks...`);
    
    const promises = tasks.map(task => this.checkAndUpdateDomain(task));
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (failed > 0) {
      console.log(`Completed ${successful} checks, ${failed} failed`);
    }
  }
  
  private async checkAndUpdateDomain(task: any): Promise<void> {
    assert(task.domain, "Domain is required");
    assert(task.domainId, "Domain ID is required");
    
    const result = await checkDomainStatus(task.domain);
    
    await this.apiClient.updateDomainStatus({
      domainId: task.domainId,
      domain: task.domain,
      status: result.status,
      responseCode: result.responseCode,
      responseTimeMs: result.responseTimeMs,
      checkedAt: new Date()
    });
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const processor = new BackgroundProcessor();
  
  process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
  });
  
  try {
    await processor.start();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
