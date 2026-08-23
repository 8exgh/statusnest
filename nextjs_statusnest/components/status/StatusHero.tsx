import Link from 'next/link';
import type { PublicMonitorStatus } from '@/types';
import { relativeTime, statusLabel } from '@/lib/public-monitors/format';
import StatusPill from './StatusPill';

interface Crumb {
  name: string;
  href?: string;
}

interface StatusHeroProps {
  crumbs: Crumb[];
  heading: string;
  /** Name used in the badge label, e.g. "GitHub" → "GitHub is up". */
  subjectName: string;
  status: PublicMonitorStatus;
  lastCheckedAt?: Date;
  now: Date;
  /** Extra line under the badge (e.g. HTTP code and load time). */
  detail?: React.ReactNode;
  /** Outbound link to the monitored site/page. */
  externalUrl?: string;
}

export default function StatusHero({ crumbs, heading, subjectName, status, lastCheckedAt, now, detail, externalUrl }: StatusHeroProps) {
  return (
    <header className="mb-8">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, i) => (
            <li key={`${crumb.name}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">›</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-gray-900 hover:underline">
                  {crumb.name}
                </Link>
              ) : (
                <span className="text-gray-700">{crumb.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{heading}</h1>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <StatusPill status={status} label={statusLabel(status, subjectName)} size="lg" />
        <div className="text-sm text-gray-600">
          <p>
            Last checked <strong className="font-medium text-gray-900">{relativeTime(lastCheckedAt, now)}</strong> from a real Chromium browser
            {lastCheckedAt && (
              <>
                {' '}
                (<time dateTime={lastCheckedAt.toISOString()}>{lastCheckedAt.toUTCString().replace(' GMT', ' UTC')}</time>)
              </>
            )}
            .
          </p>
          {detail && <p className="mt-0.5">{detail}</p>}
          {externalUrl && (
            <p className="mt-0.5">
              <a href={externalUrl} rel="nofollow noopener" target="_blank" className="text-blue-600 hover:underline">
                {externalUrl}
              </a>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
