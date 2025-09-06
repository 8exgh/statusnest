import fetch from 'node-fetch';

export interface CheckResult {
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs: number;
}

export async function checkDomainStatus(domain: string): Promise<CheckResult> {
  const startTime = Date.now();
  let status: 'online' | 'offline' = 'offline';
  let responseCode: number | undefined;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`http://${domain}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    responseCode = response.status;
    status = response.ok ? 'online' : 'offline';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`Timeout checking ${domain}`);
    } else {
      console.log(`Error checking ${domain}:`, error.message);
    }
    status = 'offline';
  }
  
  const responseTimeMs = Date.now() - startTime;
  
  return {
    status,
    responseCode,
    responseTimeMs
  };
}