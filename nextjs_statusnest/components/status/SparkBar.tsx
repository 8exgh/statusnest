import type { SparkRun } from '@/lib/public-monitors/queries';
import HatchPattern from './HatchPattern';
import { STATUS_COLORS } from './palette';

interface SparkBarProps {
  /** Runs of consecutive checks sharing a status, oldest first. */
  spark: SparkRun[];
  /** Total checks behind the runs (0 renders the "no checks" placeholder). */
  checks: number;
  /** Unique per bar on the page — SVG pattern ids must not collide. */
  id: string;
  /** Used in the accessible summary, e.g. "GitHub". */
  subject: string;
  height?: number;
}

const WIDTH = 300;
const GAP = 2;

/**
 * A site card's 24-hour history as a single compact bar: one segment per run of
 * consecutive checks that shared a status, width proportional to the run.
 *
 * Deliberately not one mark per check — at 100 sites per page that is the
 * difference between a ~20 KB index and a ~2 MB one. The per-check strip with
 * hover detail lives on the site's own page.
 */
export default function SparkBar({ spark, checks, id, subject, height = 10 }: SparkBarProps) {
  const hatchId = `${id}-h`;
  const hasOffline = spark.some((run) => run.status === 'offline');
  const offline = spark.reduce((sum, run) => (run.status === 'offline' ? sum + run.weight : sum), 0);

  if (checks === 0 || spark.length === 0) {
    return (
      <div
        className="h-2.5 w-full rounded-full bg-gray-200"
        role="img"
        aria-label={`${subject}: no checks in the last 24 hours yet.`}
        title="No checks in the last 24 hours yet"
      />
    );
  }

  const total = spark.reduce((sum, run) => sum + run.weight, 0);
  const gaps = GAP * Math.max(0, spark.length - 1);
  const usable = Math.max(1, WIDTH - gaps);
  const summary = `${subject}: ${checks} checks in the last 24 hours, ${checks - offline} online, ${offline} unavailable.`;

  let x = 0;
  const segments = spark.map((run, i) => {
    const width = Math.max(2, (run.weight / total) * usable);
    const segment = { key: i, x, width, status: run.status };
    x += width + GAP;
    return segment;
  });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={summary}
      className="block"
    >
      {hasOffline && <HatchPattern id={hatchId} />}
      {segments.map((segment) => (
        <rect
          key={segment.key}
          x={segment.x}
          y={0}
          width={segment.width}
          height={height}
          rx={2}
          fill={segment.status === 'online' ? STATUS_COLORS.online : `url(#${hatchId})`}
        />
      ))}
    </svg>
  );
}
