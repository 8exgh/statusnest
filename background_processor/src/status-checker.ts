import fetch from 'node-fetch';

export interface CheckResult {
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs: number;
}

async function attemptCheck(url: string, timeoutMs: number = 5000): Promise<{
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs: number;
}> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD for faster response
      redirect: 'manual', // Don't follow redirects automatically
      signal: controller.signal,
      headers: {
        'User-Agent': 'StatusNest/1.0'
      }
    });
    
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;
    
    // Consider 2xx and 3xx as online
    const isOnline = response.status >= 200 && response.status < 400;
    
    return {
      status: isOnline ? 'online' : 'offline',
      responseCode: response.status,
      responseTimeMs
    };
  } catch (error: any) {
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;
    
    // Only log non-timeout errors
    if (error.name !== 'AbortError') {
      console.log(`Error checking ${url}:`, error.code || error.message);
    }
    
    return {
      status: 'offline',
      responseCode: undefined,
      responseTimeMs
    };
  }
}

export async function checkDomainStatus(domain: string): Promise<CheckResult> {
  // Clean up domain (remove protocol if provided)
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  
  // Try HTTPS first (most common)
  const httpsResult = await attemptCheck(`https://${cleanDomain}`, 5000);
  
  if (httpsResult.status === 'online') {
    console.log(`${cleanDomain}: ${httpsResult.status} (HTTPS: ${httpsResult.responseTimeMs}ms)`);
    return httpsResult;
  }
  
  // If HTTPS fails, try HTTP as fallback
  const httpResult = await attemptCheck(`http://${cleanDomain}`, 3000);
  
  if (httpResult.status === 'online') {
    console.log(`${cleanDomain}: ${httpResult.status} (HTTP: ${httpResult.responseTimeMs}ms)`);
    return httpResult;
  }
  
  // Both failed, return the faster failure (usually HTTPS)
  const result = httpsResult.responseTimeMs <= httpResult.responseTimeMs ? httpsResult : httpResult;
  console.log(`${cleanDomain}: offline (${result.responseTimeMs}ms)`);
  
  return result;
}