import Link from 'next/link';
import type { PublicSiteOverview } from '@/lib/public-monitors/queries';
import { formatUptime, relativeTime, relativeTimeShort, subjectName } from '@/lib/public-monitors/format';
import StatusPill from './StatusPill';
import CheckStrip from './CheckStrip';

/** Compact site card for the home page; `detailed` adds uptime windows and the 24h strip for the index. */
export default function SiteCard({ overview, now, detailed = false }: { overview: PublicSiteOverview; now: Date; detailed?: boolean }) {
  const { site, primary, uptime, recentChecks } = overview;
  const href = `/status/${site.slug}`;
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-gray-900">
            <Link href={href} className="hover:underline">
              {site.name}
            </Link>
          </h3>
          <p className="text-xs text-gray-500">
            Checked {relativeTimeShort(primary?.lastCheckedAt, now)}
            {detailed && (
              <>
                {' · '}
                <a href={site.url} rel="nofollow noopener" target="_blank" className="hover:underline">
                  {site.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </>
            )}
          </p>
        </div>
        <StatusPill status={site.status} size="sm" />
      </div>
      {detailed ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['24h', uptime.last24h.uptime],
                ['7 days', uptime.last7d.uptime],
                ['30 days', uptime.last30d.uptime],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-gray-50 px-2 py-1.5">
                <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-gray-900">{formatUptime(value)}</dd>
              </div>
            ))}
          </dl>
          <CheckStrip checks={recentChecks} id={`strip-${site.slug}`} subject={subjectName(site.name, primary?.name)} legend={false} height={20} maxBars={48} />
          <Link href={href} className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Is {site.name} down? Full status →
          </Link>
        </>
      ) : (
        <p className="text-sm text-gray-600">
          <span className="font-semibold tabular-nums text-gray-900">{formatUptime(uptime.last24h.uptime)}</span> uptime, last 24 h
        </p>
      )}
    </article>
  );
}
