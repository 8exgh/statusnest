import { createHmac } from 'crypto';
import fetch from 'node-fetch';

interface Task {
  domainId: string;
  domain: string;
  userId: string;
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