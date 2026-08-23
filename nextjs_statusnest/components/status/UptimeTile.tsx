import type { UptimeWindow } from '@/lib/public-monitors/queries';
import { formatUptime } from '@/lib/public-monitors/format';

/** Headline number for one uptime window; "—" when there were no checks. */
export default function UptimeTile({ label, window }: { label: string; window: UptimeWindow }) {
  const hasData = window.checks > 0;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums text-gray-900">{formatUptime(window.uptime)}</div>
      <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-xs text-gray-500">
        {hasData ? `${window.online} of ${window.checks} checks up` : 'no checks yet'}
      </div>
    </div>
  );
}
