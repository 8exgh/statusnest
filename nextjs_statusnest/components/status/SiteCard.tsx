import Link from 'next/link';
import type { PublicSiteOverview } from '@/lib/public-monitors/queries';
import { formatUptime, relativeTimeShort, verifyState } from '@/lib/public-monitors/format';
import StatusPill from './StatusPill';
import SparkBar from './SparkBar';

interface SiteCardProps {
  overview: PublicSiteOverview;
  now: Date;
  /** Index cards add the uptime windows and the compact 24-hour bar. */
  detailed?: boolean;
}

/**
 * One site on the status index (`detailed`) or the home page (compact).
 *
 * Kept deliberately small: the index renders 100 of these, so anything
 * per-check belongs on the site's own page, not here.
 */
export default function SiteCard({ overview, now, detailed = false }: SiteCardProps) {
  const { site, primary, uptime, spark, spark24hChecks, latestBlocked } = overview;
  const href = `/status/${site.slug}`;
  const state = verifyState(site.status, latestBlocked);
  return (
    <article className="flex h-full flex-col gap-2.5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">
            <Link href={href} className="hover:underline">
              {site.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-gray-500">Checked {relativeTimeShort(primary?.lastCheckedAt, now)}</p>
        </div>
        <StatusPill status={state} size="sm" />
      </div>

      {detailed ? (
        <>
          {/* One line rather than three tiles: at 100 cards the element count
              is what drives page weight, and this scans just as well. */}
          <p className="text-xs tabular-nums text-gray-500">
            <span className="font-semibold text-gray-900">{formatUptime(uptime.last24h.uptime)}</span> 24h ·{' '}
            {formatUptime(uptime.last7d.uptime)} 7d · {formatUptime(uptime.last30d.uptime)} 30d
          </p>
          <SparkBar spark={spark} checks={spark24hChecks} id={`sp-${site.slug}`} subject={site.name} />
          <Link href={href} className="mt-auto text-xs font-medium text-blue-600 hover:text-blue-500">
            Is {site.name} down? →
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
