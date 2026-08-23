/**
 * Check cadence for the public monitors.
 *
 * Delays are drawn from a triangular distribution so checks never fall into a
 * fixed pattern — kinder to the sites we visit, and a more honest sample for
 * uptime. Two tiers keep the headline sites fresh without the crawl traffic of
 * a hundred sites on a 15-minute cadence (each visit loads every page of a
 * site in a real browser, so bandwidth scales with site count × frequency):
 *
 *   primary  — 5–20 min, mode 15 (mean ~13): the best-known sites
 *   standard — 20–60 min, mode 40 (mean ~40): everything else
 *
 * Move a site between tiers with one word in `sites.ts`.
 */

export const CHECK_TIERS = {
  primary: { minMinutes: 5, modeMinutes: 15, maxMinutes: 20 },
  standard: { minMinutes: 20, modeMinutes: 40, maxMinutes: 60 },
} as const;

export type CheckTier = keyof typeof CHECK_TIERS;

export const DEFAULT_CHECK_TIER: CheckTier = 'standard';

export function isCheckTier(value: unknown): value is CheckTier {
  return typeof value === 'string' && value in CHECK_TIERS;
}

export function asCheckTier(value: unknown): CheckTier {
  return isCheckTier(value) ? value : DEFAULT_CHECK_TIER;
}

/** Triangular(min, mode, max) sample, in minutes. `random` is injectable for tests. */
export function sampleCheckDelayMinutes(
  tier: CheckTier = DEFAULT_CHECK_TIER,
  random: () => number = Math.random
): number {
  const { minMinutes: min, modeMinutes: mode, maxMinutes: max } = CHECK_TIERS[tier];
  const u = random();
  const split = (mode - min) / (max - min);
  if (u < split) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function scheduleNextPublicCheck(
  from: Date,
  tier: CheckTier = DEFAULT_CHECK_TIER,
  random: () => number = Math.random
): Date {
  const minutes = sampleCheckDelayMinutes(tier, random);
  return new Date(from.getTime() + Math.round(minutes * 60 * 1000));
}

/** Human description of a tier's cadence, for the status pages. */
export function describeCadence(tier: CheckTier): string {
  const { minMinutes, maxMinutes } = CHECK_TIERS[tier];
  return `every ${minMinutes}–${maxMinutes} minutes`;
}

/** A claimed site whose checker never reported back is handed out again after this long. */
export const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

/** Check history kept for the graphs. */
export const CHECK_RETENTION_DAYS = 90;
