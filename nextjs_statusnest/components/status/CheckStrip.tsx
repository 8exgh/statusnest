import type { PublicPageCheck } from '@/types';
import { formatDateTimeUTC, formatMs, formatTimeUTC } from '@/lib/public-monitors/format';
import ChartLegend from './ChartLegend';
import BlockedPattern from './BlockedPattern';
import HatchPattern from './HatchPattern';
import { STATUS_COLORS } from './palette';

interface CheckStripProps {
  /** Checks in chronological order (oldest first). */
  checks: PublicPageCheck[];
  /** Unique per chart on the page (SVG pattern ids must not collide). */
  id: string;
  /** Shown to assistive tech and as the tooltip context, e.g. "GitHub homepage". */
  subject: string;
  /** Render the legend under the strip. */
  legend?: boolean;
  /** Visual height of the bars. */
  height?: number;
  /**
   * Compact mode: when there are more checks than this, consecutive checks are
   * merged into at most this many buckets (a bucket is unavailable if any of
   * its checks was). Keeps index cards small.
   */
  maxBars?: number;
}

type BarState = 'online' | 'offline' | 'blocked';

interface Bar {
  key: string;
  status: BarState;
  /** First check's time (for axis labels). */
  at: Date;
  tip: string;
}

function stateOf(check: PublicPageCheck): BarState {
  return check.blocked ? 'blocked' : check.status;
}

function toBars(checks: PublicPageCheck[], maxBars?: number): Bar[] {
  if (!maxBars || checks.length <= maxBars) {
    return checks.map((c) => ({ key: String(c.id), status: stateOf(c), at: c.checkedAt, tip: describe(c) }));
  }
  const size = Math.ceil(checks.length / maxBars);
  const bars: Bar[] = [];
  for (let i = 0; i < checks.length; i += size) {
    const group = checks.slice(i, i + size);
    const down = group.filter((c) => stateOf(c) === 'offline').length;
    const blocked = group.filter((c) => stateOf(c) === 'blocked').length;
    const first = group[0];
    const last = group[group.length - 1];
    // A real outage in the bucket outranks a bot challenge, which outranks OK.
    const status: BarState = down > 0 ? 'offline' : blocked > 0 ? 'blocked' : 'online';
    const detail =
      down > 0
        ? `${down} unavailable`
        : blocked > 0
          ? `${blocked} couldn’t be verified`
          : 'all online';
    bars.push({
      key: `${first.id}-${last.id}`,
      status,
      at: first.checkedAt,
      tip: `${formatTimeUTC(first.checkedAt)}–${formatTimeUTC(last.checkedAt)} UTC — ${group.length} check${group.length === 1 ? '' : 's'}, ${detail}`,
    });
  }
  return bars;
}

const WIDTH = 880;
const GAP = 2;
const MIN_BAR = 6;
const PLACEHOLDER_SLOTS = 96;

function describe(check: PublicPageCheck): string {
  const code = check.responseCode ? `HTTP ${check.responseCode}` : check.error ? check.error : 'no response';
  if (check.blocked) {
    return `${formatDateTimeUTC(check.checkedAt)} — Couldn’t verify: the site showed a bot check (${code}). Not counted as an outage.`;
  }
  const state = check.status === 'online' ? 'Online' : 'Unavailable';
  return `${formatDateTimeUTC(check.checkedAt)} — ${state} · ${code} · ${formatMs(check.responseTimeMs)}`;
}

/**
 * One rounded bar per check, oldest on the left. Green = online, red with a
 * diagonal hatch = unavailable, dotted slate = couldn't verify (bot check),
 * light gray = no check in that slot.
 */
export default function CheckStrip({ checks, id, subject, legend = true, height = 36, maxBars }: CheckStripProps) {
  const hatchId = `${id}-hatch`;
  const blockedId = `${id}-blocked`;
  const bars = toBars(checks, maxBars);
  const n = bars.length;
  const slots = n > 0 ? n : PLACEHOLDER_SLOTS;
  const slotWidth = WIDTH / slots;
  const barWidth = Math.max(MIN_BAR, slotWidth - GAP);
  // If bars would overflow (very many checks), the viewBox grows and the SVG scales down.
  const totalWidth = Math.max(WIDTH, slots * (barWidth + GAP));

  const blockedCount = checks.filter((c) => c.blocked).length;
  const online = checks.filter((c) => !c.blocked && c.status === 'online').length;
  const offlineCount = checks.length - online - blockedCount;
  const summary =
    checks.length > 0
      ? `${subject}: ${checks.length} checks in the last 24 hours, ${online} online, ${offlineCount} unavailable${blockedCount ? `, ${blockedCount} could not be verified` : ''}.`
      : `${subject}: no checks in the last 24 hours yet.`;

  // A handful of real check times under the strip (HTML, so the text never
  // distorts when the SVG is stretched to the container width).
  const labelCount = Math.min(5, n);
  const axisLabels =
    !legend || n === 0
      ? []
      : Array.from({ length: labelCount }, (_, i) => formatTimeUTC(bars[Math.round((i * (n - 1)) / Math.max(1, labelCount - 1))].at));

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        className="block"
      >
        <title>{summary}</title>
        <HatchPattern id={hatchId} />
        <BlockedPattern id={blockedId} />
        {n === 0 &&
          Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => (
            <rect
              key={i}
              x={i * (barWidth + GAP)}
              y={0}
              width={barWidth}
              height={height}
              rx={2}
              fill={STATUS_COLORS.none}
              opacity={0.6}
            />
          ))}
        {bars.map((bar, i) => (
          <g key={bar.key}>
            <rect
              x={i * (barWidth + GAP)}
              y={0}
              width={barWidth}
              height={height}
              rx={2}
              fill={
                bar.status === 'online'
                  ? STATUS_COLORS.online
                  : bar.status === 'blocked'
                    ? `url(#${blockedId})`
                    : `url(#${hatchId})`
              }
            >
              <title>{bar.tip}</title>
            </rect>
          </g>
        ))}
        {n === 0 && (
          <text x={totalWidth / 2} y={height / 2 + 4} fontSize="12" fill={STATUS_COLORS.textStrong} textAnchor="middle">
            No checks yet
          </text>
        )}
      </svg>
      {axisLabels.length > 0 && (
        <div className="mt-1 flex justify-between text-[11px] leading-none text-gray-500" aria-hidden="true">
          {axisLabels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      )}
      {legend && (
        <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <ChartLegend
            id={id}
            items={[
              { kind: 'online', label: 'Online' },
              { kind: 'offline', label: 'Unavailable' },
              ...(blockedCount > 0 ? ([{ kind: 'blocked', label: 'Couldn’t verify (bot check)' }] as const) : []),
              { kind: 'none', label: 'No check' },
            ]}
          />
          <span className="text-xs text-gray-500">Oldest → newest · times in UTC · hover a bar for details</span>
        </figcaption>
      )}
    </figure>
  );
}
