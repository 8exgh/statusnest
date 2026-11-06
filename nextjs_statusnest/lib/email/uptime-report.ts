export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Checks normally run every five minutes. Do not invent uptime or downtime
// across a stopped worker: after two missed intervals, coverage is unknown.
export const CHECK_COVERAGE_MS = 10 * 60 * 1000;

export type ObservationKind = 'registered' | 'activated' | 'deactivated' | 'online' | 'offline';
export interface Observation { at: string; sequence: number; kind: ObservationKind }
export interface Outage {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  carriedIn: boolean;
  ending: 'recovered' | 'monitoring paused' | 'coverage lost' | 'ongoing at report end';
}
export interface DomainUptime {
  domainId: string;
  domain: string;
  onlineMs: number;
  offlineMs: number;
  unknownMs: number;
  pausedMs: number;
  onlinePercentage: number | null;
  coveragePercentage: number | null;
  outages: Outage[];
}
export interface UptimeReport {
  periodStart: string;
  periodEnd: string;
  sourceSequence: number;
  domains: DomainUptime[];
}

/** Pure view calculation; boundaries are [start, end), timestamps are UTC. */
export function summarizeDomain(domainId: string, domain: string, createdAt: string,
  observations: Observation[], periodStart: string, periodEnd: string): DomainUptime {
  const start = Math.max(Date.parse(periodStart), Date.parse(createdAt));
  const end = Date.parse(periodEnd);
  const points = observations.filter(p => Date.parse(p.at) < end)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.sequence - b.sequence);
  const result: DomainUptime = { domainId, domain, onlineMs: 0, offlineMs: 0,
    unknownMs: 0, pausedMs: 0, onlinePercentage: null, coveragePercentage: null, outages: [] };
  let active = false;
  let status: 'online' | 'offline' | null = null;
  let validUntil = 0;
  let outage: Outage | undefined;
  const close = (ending: Outage['ending']) => {
    if (outage) { outage.ending = ending; outage = undefined; }
  };
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const at = Date.parse(point.at);
    if (at > validUntil) close('coverage lost');
    if (point.kind === 'registered' || point.kind === 'activated') {
      close('coverage lost'); active = true; status = null; validUntil = 0;
    } else if (point.kind === 'deactivated') {
      close('monitoring paused'); active = false; status = null; validUntil = 0;
    } else if (active) {
      if (point.kind === 'online') close('recovered');
      status = point.kind; validUntil = at + CHECK_COVERAGE_MS;
    }
    const from = Math.max(start, at);
    const to = Math.min(end, index + 1 < points.length ? Date.parse(points[index + 1].at) : end);
    if (to <= from) continue;
    if (!active) { result.pausedMs += to - from; continue; }
    const coveredTo = Math.min(to, validUntil);
    const covered = status ? Math.max(0, coveredTo - from) : 0;
    result.unknownMs += to - from - covered;
    if (status === 'online') result.onlineMs += covered;
    if (status === 'offline' && covered > 0) {
      result.offlineMs += covered;
      if (!outage) {
        outage = { startedAt: new Date(from).toISOString(), endedAt: new Date(coveredTo).toISOString(),
          durationMs: 0, carriedIn: at < start, ending: 'ongoing at report end' };
        result.outages.push(outage);
      }
      outage.endedAt = new Date(coveredTo).toISOString();
      outage.durationMs += covered;
    }
    if (to > validUntil) close('coverage lost');
  }
  const known = result.onlineMs + result.offlineMs;
  const monitored = known + result.unknownMs;
  result.onlinePercentage = known ? result.onlineMs / known * 100 : null;
  result.coveragePercentage = monitored ? known / monitored * 100 : null;
  return result;
}

export function duration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function renderUptimeReport(report: UptimeReport, dashboardUrl: string): string {
  const percentage = (value: number | null) => value === null ? 'N/A' : `${value.toFixed(2)}%`;
  const online = report.domains.reduce((total, d) => total + d.onlineMs, 0);
  const offline = report.domains.reduce((total, d) => total + d.offlineMs, 0);
  const unknown = report.domains.reduce((total, d) => total + d.unknownMs, 0);
  const outages = report.domains.reduce((total, d) => total + d.outages.length, 0);
  return [
    'Your StatusNest weekly report', '',
    `Period (UTC): ${report.periodStart} to ${report.periodEnd} (end exclusive)`, '',
    `Overall online: ${percentage(online + offline ? online / (online + offline) * 100 : null)}`,
    `Monitoring coverage: ${percentage(online + offline + unknown ? (online + offline) / (online + offline + unknown) * 100 : null)}`,
    `Detected outage episodes: ${outages}`, '',
    ...(!report.domains.length ? ['No websites were monitored in this period. Add one to start receiving uptime data.', ''] : []),
    ...report.domains.flatMap(d => [
      d.domain,
      `  Online: ${percentage(d.onlinePercentage)} | Coverage: ${percentage(d.coveragePercentage)}`,
      `  Observed downtime: ${duration(d.offlineMs)} | No data: ${duration(d.unknownMs)} | Paused: ${duration(d.pausedMs)}`,
      `  Detected outage episodes: ${d.outages.length}`,
      ...d.outages.map(o => `  - ${o.startedAt} to ${o.endedAt}: ${duration(o.durationMs)}; ${o.ending}${o.carriedIn ? '; already offline at period start' : ''}`), ''
    ]),
    'Online percentage is time online divided by observed online + offline time. Overall figures are weighted by observed time across your websites.',
    'Each check covers at most 10 minutes, ending sooner when another check arrives. Gaps are unknown, never assumed online or offline. Paused time and time before a website was added are excluded.',
    'Outage times are estimates from checks. An episode ends at recovery, a pause, or lost coverage; a later offline observation after a gap starts a new episode.', '',
    `Manage your websites: ${dashboardUrl}`
  ].join('\n');
}
