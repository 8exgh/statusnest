import fetch from 'node-fetch';

export interface CheckResult {
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs: number;
}

/**
 * A site is offline only when it gave no usable response for a whole window,
 * not because one request failed. Fast failures (connection reset, DNS
 * hiccup, a CDN's 502/522/530 while the origin restarts) are retried until
 * the window runs out, so an offline result always means "nothing for N
 * seconds" and every offline alert is backed by at least that long.
 */
export interface CheckOptions {
  httpsWindowMs: number;
  httpWindowMs: number;
  retryDelayMs: number;
}

const DEFAULT_OPTIONS: CheckOptions = {
  httpsWindowMs: 5000,
  httpWindowMs: 3000,
  retryDelayMs: 500
};

interface Attempt {
  ok: boolean;
  responseCode?: number;
  error?: string;
  responseTimeMs: number;
}

/**
 * Any HTTP answer below 500 means the server is up and answering: 2xx/3xx, and
 * also 4xx (a HEAD rejected with 405, a 403 to our user agent, a 401 behind a
 * login). 5xx and no response at all count as a failed attempt.
 */
function isUp(responseCode: number): boolean {
  return responseCode >= 200 && responseCode < 500;
}

async function attemptCheck(url: string, timeoutMs: number): Promise<Attempt> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD for faster response
      redirect: 'manual', // Don't follow redirects automatically
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'StatusNest/1.0'
      }
    });

    return {
      ok: isUp(response.status),
      responseCode: response.status,
      responseTimeMs: Date.now() - startTime
    };
  } catch (error: any) {
    const timedOut = error.name === 'AbortError' || error.name === 'TimeoutError';
    return { ok: false, error: timedOut ? 'timeout' : error.code || error.message, responseTimeMs: Date.now() - startTime };
  }
}

/**
 * Keep trying `url` until it answers (online, with that answer's own response
 * time) or `windowMs` has passed (offline, with the time actually waited and
 * the last status code seen, if any).
 */
export async function checkUrlWithin(
  url: string,
  windowMs: number,
  retryDelayMs: number = DEFAULT_OPTIONS.retryDelayMs
): Promise<CheckResult & { attempts: number; lastError?: string }> {
  const startTime = Date.now();
  const deadline = startTime + windowMs;
  let attempts = 0;
  let lastResponseCode: number | undefined;
  let lastError: string | undefined;

  while (true) {
    attempts++;
    const attempt = await attemptCheck(url, Math.max(1, deadline - Date.now()));
    if (attempt.ok) {
      return { status: 'online', responseCode: attempt.responseCode, responseTimeMs: attempt.responseTimeMs, attempts };
    }
    lastResponseCode = attempt.responseCode ?? lastResponseCode;
    lastError = attempt.error ?? (attempt.responseCode ? `HTTP ${attempt.responseCode}` : lastError);

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(retryDelayMs, remaining)));
    if (Date.now() >= deadline) break;
  }

  return { status: 'offline', responseCode: lastResponseCode, responseTimeMs: Date.now() - startTime, attempts, lastError };
}

export async function checkDomainStatus(domain: string, options: Partial<CheckOptions> = {}): Promise<CheckResult> {
  const { httpsWindowMs, httpWindowMs, retryDelayMs } = { ...DEFAULT_OPTIONS, ...options };
  // Clean up domain (remove protocol if provided)
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  const startTime = Date.now();

  // Try HTTPS first (most common)
  const https = await checkUrlWithin(`https://${cleanDomain}`, httpsWindowMs, retryDelayMs);

  if (https.status === 'online') {
    console.log(`${cleanDomain}: online (HTTPS: ${https.responseTimeMs}ms)`);
    return { status: 'online', responseCode: https.responseCode, responseTimeMs: https.responseTimeMs };
  }

  // If HTTPS fails, try HTTP as fallback
  const http = await checkUrlWithin(`http://${cleanDomain}`, httpWindowMs, retryDelayMs);

  if (http.status === 'online') {
    console.log(`${cleanDomain}: online (HTTP: ${http.responseTimeMs}ms)`);
    return { status: 'online', responseCode: http.responseCode, responseTimeMs: http.responseTimeMs };
  }

  // Both failed for their whole window. Report the time actually waited and
  // the HTTPS status code if the server sent one (it is the canonical URL).
  const result: CheckResult = {
    status: 'offline',
    responseCode: https.responseCode ?? http.responseCode,
    responseTimeMs: Date.now() - startTime
  };
  console.log(`${cleanDomain}: offline (${result.responseTimeMs}ms, HTTPS ${https.attempts}x ${https.lastError}, HTTP ${http.attempts}x ${http.lastError})`);

  return result;
}
