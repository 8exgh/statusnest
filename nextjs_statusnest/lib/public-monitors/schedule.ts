/**
 * Check cadence for the public monitors: roughly every 15 minutes, jittered so
 * the checks never fall into a fixed pattern (kinder to the sites, and a more
 * honest sample for uptime). Delays are drawn from a triangular distribution
 * between 5 and 20 minutes with its mode at 15, so the mean is ~13 minutes.
 */

export const CHECK_DELAY_MIN_MINUTES = 5;
export const CHECK_DELAY_MODE_MINUTES = 15;
export const CHECK_DELAY_MAX_MINUTES = 20;

/** Triangular(min, mode, max) sample, in minutes. `random` is injectable for tests. */
export function sampleCheckDelayMinutes(random: () => number = Math.random): number {
  const min = CHECK_DELAY_MIN_MINUTES;
  const mode = CHECK_DELAY_MODE_MINUTES;
  const max = CHECK_DELAY_MAX_MINUTES;
  const u = random();
  const split = (mode - min) / (max - min);
  if (u < split) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function scheduleNextPublicCheck(from: Date, random: () => number = Math.random): Date {
  const minutes = sampleCheckDelayMinutes(random);
  return new Date(from.getTime() + Math.round(minutes * 60 * 1000));
}

/** A claimed site whose checker never reported back is handed out again after this long. */
export const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

/** Check history kept for the graphs. */
export const CHECK_RETENTION_DAYS = 90;
