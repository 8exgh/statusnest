import { createHmac } from 'crypto';
import fetch from 'node-fetch';

interface Task {
  domainId: string;
  domain: string;
  userId: string;
}

export interface EmailTask {
  notificationId: string;
  userId: string;
  to: string;
  subject: string;
  text: string;
}

export interface EmailTaskResult {
  notificationId: string;
  userId: string;
  attemptId: string;
  action: 'sent' | 'failed';
  error?: string;
}

interface StatusUpdate {
  domainId: string;
  domain: string;
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs?: number;
  checkedAt: Date;
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.STATUSNEST_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_KEY || '';
    
    assert(this.apiKey, "API_KEY environment variable is required");
  }
  
  private createSignature(body: string): string {
    return createHmac('sha256', this.apiKey)
      .update(body)
      .digest('hex');
  }

  async getPendingEmails(): Promise<EmailTask[]> {
    const response = await fetch(`${this.baseUrl}/api/internal/email-tasks`, {
      headers: { 'X-API-Key': this.apiKey, 'X-Signature': this.createSignature('') },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Email task query failed: ${response.status}`);
    const data = await response.json() as { tasks: EmailTask[] };
    if (!Array.isArray(data.tasks)) throw new Error('Invalid email task response');
    return data.tasks;
  }

  async claimEmail(task: EmailTask, attemptId: string): Promise<boolean> {
    return this.emailCommand({ action: 'claim', notificationId: task.notificationId, userId: task.userId, attemptId });
  }

  async recordEmailResult(result: EmailTaskResult): Promise<boolean> {
    return this.emailCommand(result);
  }

  private async emailCommand(command: object): Promise<boolean> {
    const body = JSON.stringify(command);
    const response = await fetch(`${this.baseUrl}/api/internal/email-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Signature': this.createSignature(body)
      },
      body,
      signal: AbortSignal.timeout(15_000)
    });
    if (response.status === 409) return false;
    if (!response.ok) throw new Error(`Email task command failed: ${response.status}`);
    const result = await response.json() as { success?: boolean };
    if (result.success !== true) throw new Error('Email command was not acknowledged');
    return true;
  }
  
  async getPendingTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/tasks`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Signature': this.createSignature('')
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get tasks: ${response.statusText}`);
      }
      
      const data = await response.json() as { tasks: Task[] };
      return data.tasks || [];
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }
  
  async updateDomainStatus(update: StatusUpdate): Promise<void> {
    const body = JSON.stringify(update);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/status-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Signature': this.createSignature(body)
        },
        body
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating domain status:', error);
      throw error;
    }
  }
}
