import type { DailyUptime } from '@/lib/public-monitors/queries';
import { formatDayUTC, formatUptime } from '@/lib/public-monitors/format';
import ChartLegend from './ChartLegend';
import BlockedPattern from './BlockedPattern';
import HatchPattern from './HatchPattern';
import { STATUS_COLORS } from './palette';

interface DailyUptimeBarsProps {
  days: DailyUptime[];
  id: string;
  subject: string;
}

const WIDTH = 880;
const HEIGHT = 48;
const GAP = 2;
const MIN_VISIBLE = 4;

/**
 * One bar per UTC day. Full-height green = every check online; a red hatched
 * bar whose height is the day's uptime = at least one unavailable check; a
 * dotted slate stub = the only checks that day hit a bot challenge, so there
 * is no uptime to report; a short gray stub = no checks at all.
 */
export default function DailyUptimeBars({ days, id, subject }: DailyUptimeBarsProps) {
  const hatchId = `${id}-hatch`;
  const blockedId = `${id}-blocked`;
  const n = Math.max(1, days.length);
  const slot = WIDTH / n;
  const barWidth = Math.max(3, slot - GAP);
  const withData = days.filter((d) => d.checks > 0);
  const perfect = withData.filter((d) => d.uptime === 1).length;
  const summary = `${subject}: daily uptime for the last ${days.length} days — ${perfect} of ${withData.length} days with data were fully up.`;

  const labelCount = Math.min(5, days.length);
  const axisLabels = Array.from({ length: labelCount }, (_, i) => {
    const index = Math.round((i * (days.length - 1)) / Math.max(1, labelCount - 1));
    return index === days.length - 1 ? 'Today' : formatDayUTC(days[index].date);
  });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT + 1}`}
        width="100%"
        height={HEIGHT + 1}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        className="block"
      >
        <title>{summary}</title>
        <HatchPattern id={hatchId} />
        <BlockedPattern id={blockedId} />
        <line x1={0} y1={HEIGHT + 0.5} x2={WIDTH} y2={HEIGHT + 0.5} stroke={STATUS_COLORS.grid} strokeWidth={1} />
        {days.map((day, i) => {
          const x = i * slot;
          let fill: string;
          let h: number;
          let tip: string;
          const couldntVerify = day.blocked > 0 ? `, ${day.blocked} couldn’t be verified` : '';
          if (day.checks === 0 && day.blocked > 0) {
            // Every check that day hit a bot challenge: no uptime either way,
            // and emphatically not an outage.
            fill = `url(#${blockedId})`;
            h = MIN_VISIBLE * 2;
            tip = `${formatDayUTC(day.date, true)} — couldn’t verify (${day.blocked} bot check${day.blocked === 1 ? '' : 's'}, no uptime recorded)`;
          } else if (day.checks === 0) {
            fill = STATUS_COLORS.none;
            h = MIN_VISIBLE;
            tip = `${formatDayUTC(day.date, true)} — no checks`;
          } else if (day.uptime === 1) {
            fill = STATUS_COLORS.online;
            h = HEIGHT;
            tip = `${formatDayUTC(day.date, true)} — 100% up (${day.online}/${day.checks} checks${couldntVerify})`;
          } else {
            fill = `url(#${hatchId})`;
            h = Math.max(MIN_VISIBLE, Math.round((day.uptime ?? 0) * HEIGHT));
            tip = `${formatDayUTC(day.date, true)} — ${formatUptime(day.uptime)} up (${day.online}/${day.checks} checks, ${day.offline} unavailable${couldntVerify})`;
          }
          return (
            <rect key={day.date} x={x} y={HEIGHT - h} width={barWidth} height={h} rx={1.5} fill={fill}>
              <title>{tip}</title>
            </rect>
          );
        })}
      </svg>
      {axisLabels.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] leading-none text-gray-500" aria-hidden="true">
          {axisLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      )}
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ChartLegend
          id={id}
          items={[
            { kind: 'online', label: 'All checks online' },
            { kind: 'offline', label: 'Some checks unavailable (bar height = uptime)' },
            ...(days.some((d) => d.blocked > 0) ? ([{ kind: 'blocked', label: 'Couldn’t verify (bot check)' }] as const) : []),
            { kind: 'none', label: 'No data' },
          ]}
        />
        <span className="text-xs text-gray-500">One bar per UTC day · hover for details</span>
      </figcaption>
    </figure>
  );
}
