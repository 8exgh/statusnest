import Link from 'next/link';
import type { PublicPage } from '@/types';
import type { UptimeWindow } from '@/lib/public-monitors/queries';
import { formatMs, formatUptime, relativeTime } from '@/lib/public-monitors/format';
import StatusPill from './StatusPill';

export interface PageRow {
  page: PublicPage;
  href: string;
  uptime24h: UptimeWindow;
}

export default function PagesTable({ rows, now }: { rows: PageRow[]; now: Date }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="px-4 py-2">Page</th>
            <th scope="col" className="px-4 py-2">Status</th>
            <th scope="col" className="px-4 py-2">HTTP</th>
            <th scope="col" className="px-4 py-2">Load time</th>
            <th scope="col" className="px-4 py-2">Uptime 24 h</th>
            <th scope="col" className="px-4 py-2">Last checked</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ page, href, uptime24h }) => (
            <tr key={page.id}>
              <td className="px-4 py-2">
                <Link href={href} className="font-medium text-blue-600 hover:underline">
                  {page.name}
                </Link>
                <div className="truncate text-xs text-gray-500">{page.url}</div>
              </td>
              <td className="px-4 py-2">
                <StatusPill status={page.status} size="sm" />
              </td>
              <td className="px-4 py-2 tabular-nums text-gray-700">{page.responseCode ?? '—'}</td>
              <td className="px-4 py-2 tabular-nums text-gray-700">{formatMs(page.responseTimeMs)}</td>
              <td className="px-4 py-2 tabular-nums text-gray-700">{formatUptime(uptime24h.uptime)}</td>
              <td className="px-4 py-2 text-gray-700">{relativeTime(page.lastCheckedAt, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
