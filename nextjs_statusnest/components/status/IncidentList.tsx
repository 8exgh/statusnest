import Link from 'next/link';
import type { Incident } from '@/lib/public-monitors/queries';
import { formatDateTimeUTC, formatDuration, relativeTime } from '@/lib/public-monitors/format';

export interface IncidentRow extends Incident {
  pageName: string;
  pageHref?: string;
}

export default function IncidentList({ incidents, now, emptyLabel }: { incidents: IncidentRow[]; now: Date; emptyLabel: string }) {
  if (incidents.length === 0) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-gray-800">
        <span aria-hidden="true" className="mr-1.5 font-bold" style={{ color: '#059669' }}>
          ✓
        </span>
        {emptyLabel}
      </p>
    );
  }
  return (
    <ol className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {incidents.map((inc) => (
        <li key={`${inc.pageId}-${inc.startedAt.toISOString()}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <div>
            <span className="font-medium text-gray-900">
              {inc.pageHref ? (
                <Link href={inc.pageHref} className="hover:underline">
                  {inc.pageName}
                </Link>
              ) : (
                inc.pageName
              )}
            </span>
            <span className="text-gray-600"> unavailable {inc.endedAt ? `for ${formatDuration(inc.durationMs)}` : `since ${relativeTime(inc.startedAt, now)} (ongoing)`}</span>
            {inc.reason && <span className="text-gray-500"> · {inc.reason}</span>}
          </div>
          <time dateTime={inc.startedAt.toISOString()} className="text-xs text-gray-500">
            {formatDateTimeUTC(inc.startedAt)} · {inc.checks} check{inc.checks === 1 ? '' : 's'}
          </time>
        </li>
      ))}
    </ol>
  );
}
