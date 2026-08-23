import type { PublicPageCheck } from '@/types';
import { formatDateTimeUTC, formatMs, formatTimeUTC } from '@/lib/public-monitors/format';
import ChartLegend from './ChartLegend';
import BlockedPattern from './BlockedPattern';
import HatchPattern from './HatchPattern';
import { STATUS_COLORS } from './palette';

interface ResponseTimeChartProps {
  /** Checks in chronological order, ideally the last 24 hours. */
  checks: PublicPageCheck[];
  id: string;
  subject: string;
  now: Date;
  hours?: number;
}

const WIDTH = 880;
const HEIGHT = 200;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 };
const HOUR_MS = 60 * 60 * 1000;

function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * Page load time for every online check in the window as a single 2px line,
 * with unavailable checks drawn as hatched red marks on the baseline so an
 * outage is visible in the same picture. Checks that hit a bot challenge are
 * marked separately in dotted slate — they are not outages and their timings
 * measure the challenge page, so they stay off the line.
 */
export default function ResponseTimeChart({ checks, id, subject, now, hours = 24 }: ResponseTimeChartProps) {
  const hatchId = `${id}-hatch`;
  const blockedId = `${id}-blocked`;
  const end = now.getTime();
  const start = end - hours * HOUR_MS;
  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const inWindow = checks.filter((c) => c.checkedAt.getTime() >= start && c.checkedAt.getTime() <= end);
  const online = inWindow.filter((c) => !c.blocked && c.status === 'online' && typeof c.responseTimeMs === 'number');
  const offline = inWindow.filter((c) => !c.blocked && c.status === 'offline');
  const blocked = inWindow.filter((c) => c.blocked);
  const maxMs = niceMax(Math.max(0, ...online.map((c) => c.responseTimeMs as number)) * 1.1);

  const x = (t: number) => MARGIN.left + ((t - start) / (end - start)) * plotW;
  const y = (ms: number) => MARGIN.top + plotH - (Math.min(ms, maxMs) / maxMs) * plotH;

  const points = online.map((c) => ({ c, px: x(c.checkedAt.getTime()), py: y(c.responseTimeMs as number) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const area =
    points.length > 1
      ? `${path} L${points[points.length - 1].px.toFixed(1)},${(MARGIN.top + plotH).toFixed(1)} L${points[0].px.toFixed(1)},${(MARGIN.top + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxMs);
  const xTicks: Date[] = [];
  const firstHour = new Date(start);
  firstHour.setUTCMinutes(0, 0, 0);
  const tickEvery = hours >= 24 ? 6 : hours >= 12 ? 3 : 1;
  for (let t = firstHour.getTime() + HOUR_MS; t <= end; t += HOUR_MS) {
    const d = new Date(t);
    if (d.getUTCHours() % tickEvery === 0) xTicks.push(d);
  }

  const avg = online.length ? Math.round(online.reduce((s, c) => s + (c.responseTimeMs as number), 0) / online.length) : null;
  const summary =
    online.length > 0
      ? `${subject}: page load time over the last ${hours} hours, ${online.length} measurements averaging ${formatMs(avg)}${offline.length ? `, ${offline.length} unavailable checks` : ''}${blocked.length ? `, ${blocked.length} checks that could not be verified` : ''}.`
      : `${subject}: no load-time measurements in the last ${hours} hours.`;

  const last = points[points.length - 1];
  const hitWidth = points.length > 1 ? Math.max(6, plotW / points.length) : 12;

  return (
    <figure className="m-0">
      {/* Scales with the container but never below 640px, so tick labels stay legible on phones (the wrapper scrolls, the page does not). */}
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" role="img" aria-label={summary} className="block min-w-[640px]">
        <title>{summary}</title>
        <HatchPattern id={hatchId} />
        <BlockedPattern id={blockedId} />
        {yTicks.map((ms) => (
          <g key={ms}>
            <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(ms)} y2={y(ms)} stroke={STATUS_COLORS.grid} strokeWidth={1} />
            <text x={MARGIN.left - 8} y={y(ms) + 4} fontSize="11" fill={STATUS_COLORS.text} textAnchor="end">
              {formatMs(ms)}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d.getTime()} x={x(d.getTime())} y={HEIGHT - 8} fontSize="11" fill={STATUS_COLORS.text} textAnchor="middle">
            {formatTimeUTC(d)}
          </text>
        ))}
        <line
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={MARGIN.top + plotH + 0.5}
          y2={MARGIN.top + plotH + 0.5}
          stroke={STATUS_COLORS.axis}
          strokeWidth={1}
        />
        {area && <path d={area} fill={STATUS_COLORS.series} fillOpacity={0.08} />}
        {points.length > 1 && (
          <path d={path} fill="none" stroke={STATUS_COLORS.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {points.map((p) => (
          <rect
            key={p.c.id}
            x={p.px - hitWidth / 2}
            y={MARGIN.top}
            width={hitWidth}
            height={plotH}
            fill="transparent"
          >
            <title>{`${formatDateTimeUTC(p.c.checkedAt)} — ${formatMs(p.c.responseTimeMs)}${p.c.responseCode ? ` · HTTP ${p.c.responseCode}` : ''}`}</title>
          </rect>
        ))}
        {offline.map((c) => (
          <rect
            key={c.id}
            x={x(c.checkedAt.getTime()) - 4}
            y={MARGIN.top + plotH - 10}
            width={8}
            height={10}
            rx={1.5}
            fill={`url(#${hatchId})`}
            stroke={STATUS_COLORS.offline}
            strokeWidth={1}
          >
            <title>{`${formatDateTimeUTC(c.checkedAt)} — Unavailable${c.responseCode ? ` · HTTP ${c.responseCode}` : c.error ? ` · ${c.error}` : ''}`}</title>
          </rect>
        ))}
        {blocked.map((c) => (
          <rect
            key={`b-${c.id}`}
            x={x(c.checkedAt.getTime()) - 4}
            y={MARGIN.top + plotH - 10}
            width={8}
            height={10}
            rx={1.5}
            fill={`url(#${blockedId})`}
            stroke={STATUS_COLORS.blocked}
            strokeWidth={1}
          >
            <title>{`${formatDateTimeUTC(c.checkedAt)} — Couldn’t verify: bot check${c.responseCode ? ` · HTTP ${c.responseCode}` : ''}. Not counted as an outage.`}</title>
          </rect>
        ))}
        {last && (
          <circle cx={last.px} cy={last.py} r={4} fill={STATUS_COLORS.series} stroke="#ffffff" strokeWidth={2}>
            <title>{`Latest: ${formatDateTimeUTC(last.c.checkedAt)} — ${formatMs(last.c.responseTimeMs)}`}</title>
          </circle>
        )}
        {points.length === 1 && (
          <text x={last.px} y={last.py - 10} fontSize="11" fill={STATUS_COLORS.textStrong} textAnchor="middle">
            {formatMs(last.c.responseTimeMs)}
          </text>
        )}
        {points.length === 0 && (
          <text x={MARGIN.left + plotW / 2} y={MARGIN.top + plotH / 2} fontSize="12" fill={STATUS_COLORS.textStrong} textAnchor="middle">
            No load-time measurements in the last {hours} hours
          </text>
        )}
      </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ChartLegend
          id={id}
          items={[
            { kind: 'series', label: avg !== null ? `Page load time (avg ${formatMs(avg)})` : 'Page load time' },
            { kind: 'offline', label: 'Unavailable check' },
            ...(blocked.length > 0 ? ([{ kind: 'blocked', label: 'Couldn’t verify (bot check)' }] as const) : []),
          ]}
        />
        <span className="text-xs text-gray-500">Times in UTC · hover for details</span>
      </figcaption>
    </figure>
  );
}
