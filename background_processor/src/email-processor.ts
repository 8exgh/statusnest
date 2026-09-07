import { randomUUID } from 'crypto';
import type { ApiClient, EmailTask, EmailTaskResult } from './api-client';
import { emailFailureReason, type EmailSender } from './email-sender';

type EmailApi = Pick<ApiClient, 'getPendingEmails' | 'claimEmail' | 'recordEmailResult'>;

export class EmailProcessor {
  private pendingResults = new Map<string, EmailTaskResult>();

  constructor(private api: EmailApi, private sender: EmailSender) {}

  async process(): Promise<void> {
    // Retain successful SMTP outcomes across API outages so we retry the receipt,
    // without sending the message again in this process.
    for (const result of this.pendingResults.values()) await this.report(result);
    const tasks = await this.api.getPendingEmails();
    const results = await Promise.allSettled(tasks.map(task => this.deliver(task)));
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed) console.error(`${failed} email task(s) could not be processed; will retry`);
  }

  private async deliver(task: EmailTask): Promise<void> {
    if (this.pendingResults.has(task.notificationId)) return;
    const attemptId = randomUUID();
    if (!await this.api.claimEmail(task, attemptId)) return;
    let result: EmailTaskResult;
    try {
      await this.sender.send(task);
      result = { notificationId: task.notificationId, userId: task.userId, attemptId, action: 'sent' };
    } catch (error) {
      result = { notificationId: task.notificationId, userId: task.userId, attemptId, action: 'failed', error: emailFailureReason(error) };
    }
    this.pendingResults.set(task.notificationId, result);
    await this.report(result);
  }

  private async report(result: EmailTaskResult): Promise<void> {
    try {
      // A 409 means another worker recovered an expired claim; discard this receipt.
      await this.api.recordEmailResult(result);
      this.pendingResults.delete(result.notificationId);
    } catch {
      console.error(`Email result pending acknowledgement: ${result.notificationId}`);
    }
  }
}
