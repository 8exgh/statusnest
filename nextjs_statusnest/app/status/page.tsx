import Link from 'next/link';
import { PublicMonitorQueries, type PublicSiteOverview } from '@/lib/public-monitors/queries';
import { PUBLIC_CATEGORIES } from '@/lib/public-monitors/sites';
import { absoluteUrl } from '@/lib/site-url';
import SiteCard from '@/components/status/SiteCard';
import JsonLd from '@/components/status/JsonLd';
import { publicMetadata } from '@/lib/seo';
import { verifyState } from '@/lib/public-monitors/format';

export const dynamic = 'force-dynamic';

const TITLE = 'Website Status & Outage History | StatusNest';
const DESCRIPTION =
  'Browse independent status checks, outages and uptime history for popular websites, including GitHub, Discord, YouTube, Steam and Netflix.';

export const metadata = publicMetadata(TITLE, DESCRIPTION, '/status');

/** Group overviews by category, in PUBLIC_CATEGORIES order; unknown categories fall to the end. */
function groupByCategory(overviews: PublicSiteOverview[]) {
  const groups = new Map<string, PublicSiteOverview[]>();
  for (const overview of overviews) {
    const key = PUBLIC_CATEGORIES.some((c) => c.slug === overview.site.category) ? overview.site.category : 'other';
    const list = groups.get(key);
    if (list) list.push(overview);
    else groups.set(key, [overview]);
  }
  const ordered = PUBLIC_CATEGORIES.filter((c) => groups.has(c.slug)).map((c) => ({
    slug: c.slug as string,
    label: c.label as string,
    blurb: c.blurb as string,
    sites: groups.get(c.slug)!,
  }));
  if (groups.has('other')) {
    ordered.push({ slug: 'other', label: 'Other', blurb: 'Everything else we track.', sites: groups.get('other')! });
  }
  return ordered;
}

export default function StatusIndexPage() {
  const now = new Date();
  const overviews = new PublicMonitorQueries().getSitesOverview(now);
  // A site whose newest check hit a bot challenge is neither "up" nor "down" —
  // we simply could not verify it, so it is counted (and listed) separately.
  const stateOf = (o: PublicSiteOverview) => verifyState(o.site.status, o.latestBlocked, o.primary?.lastCheckedAt, now, o.site.tier);
  const blockedSites = overviews.filter((o) => stateOf(o) === 'blocked');
  const staleSites = overviews.filter((o) => stateOf(o) === 'stale');
  const verifiable = overviews.filter((o) => ['online', 'offline'].includes(stateOf(o)));
  const up = verifiable.filter((o) => o.site.status === 'online').length;
  const downSites = verifiable.filter((o) => o.site.status === 'offline');
  const unchecked = overviews.filter((o) => stateOf(o) === 'unknown').length;
  const groups = groupByCategory(overviews);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    description: DESCRIPTION,
    url: absoluteUrl('/status'),
    isPartOf: { '@type': 'WebSite', name: 'StatusNest', url: absoluteUrl('/') },
    hasPart: overviews.map((o) => ({
      '@type': 'WebPage',
      name: `Is ${o.site.name} down?`,
      url: absoluteUrl(`/status/${o.site.slug}`),
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Website status and outage history</h1>
        <p className="mt-3 max-w-3xl text-gray-700">
          Each of these {overviews.length} sites is checked from a <strong>real Chromium browser</strong> on our monitoring server.
          These are independent observations, rather than official service reports. The best-known sites are checked every 5–20 minutes and the
          rest every 20–60 minutes, always on a randomised schedule. Click any site for its uptime history, load times and every
          page we track.
        </p>
        <p className="mt-3 text-lg">
          <strong className="text-gray-900">
            {up} recently observed online
          </strong>
          {downSites.length > 0 && <span className="text-gray-700"> · {downSites.length} unavailable</span>}
          {blockedSites.length > 0 && <span className="text-gray-700"> · {blockedSites.length} couldn’t verify</span>}
          {staleSites.length > 0 && <span className="text-gray-700"> · {staleSites.length} checks overdue</span>}
          {unchecked > 0 && <span className="text-gray-700"> · {unchecked} not checked yet</span>}
        </p>
        <p className="mt-3 text-sm text-gray-600">Check the timestamp before relying on a result. Overdue checks and bot challenges do not establish current availability. <Link href="/how-it-works" className="text-blue-600 hover:underline">How monitoring works</Link>.</p>
      </header>

      {downSites.length > 0 && (
        <section className="mb-8 rounded-lg border border-red-200 bg-red-50 p-4" aria-labelledby="unavailable-heading">
          <h2 id="unavailable-heading" className="text-sm font-semibold text-gray-900">
            <span aria-hidden="true" className="mr-1 font-bold text-red-700">
              ✕
            </span>
            Currently unavailable
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {downSites.map((o) => (
              <li key={o.site.id}>
                <Link href={`/status/${o.site.slug}`} className="font-medium text-red-800 hover:underline">
                  {o.site.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blockedSites.length > 0 && (
        <section className="mb-8 rounded-lg border border-slate-300 bg-slate-50 p-4" aria-labelledby="unverified-heading">
          <h2 id="unverified-heading" className="text-sm font-semibold text-gray-900">
            <span aria-hidden="true" className="mr-1 font-bold text-slate-600">
              ?
            </span>
            Couldn’t verify
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            These sites showed a bot check to our browser instead of the page. That usually means they are up but refusing
            automated visitors, so we do not count it as an outage.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {blockedSites.map((o) => (
              <li key={o.site.id}>
                <Link href={`/status/${o.site.slug}`} className="font-medium text-slate-700 hover:underline">
                  {o.site.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overviews.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600">No public monitors are configured yet.</p>
      ) : (
        <>
          <nav aria-label="Categories" className="mb-8 rounded-lg border border-gray-200 bg-white p-3">
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
              {groups.map((group) => (
                <li key={group.slug}>
                  <a href={`#${group.slug}`} className="text-blue-600 hover:underline">
                    {group.label}
                  </a>
                  <span className="ml-1 text-xs text-gray-500">{group.sites.length}</span>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            {groups.map((group) => {
              const groupVerifiable = group.sites.filter((o) => ['online', 'offline'].includes(stateOf(o)));
              const groupUp = groupVerifiable.filter((o) => o.site.status === 'online').length;
              return (
                <section key={group.slug} id={group.slug} className="scroll-mt-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-200 pb-2">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{group.label}</h2>
                      <p className="text-sm text-gray-600">{group.blurb}</p>
                    </div>
                    <p className="text-sm tabular-nums text-gray-600">
                      <strong className="font-semibold text-gray-900">
                        {groupUp} of {groupVerifiable.length}
                      </strong>{' '}
                      up
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.sites.map((overview) => (
                      <SiteCard key={overview.site.id} overview={overview} now={now} detailed />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <section className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Get monitoring and alerts for your own website</h2>
        <p className="mt-1 text-sm text-gray-700">
          StatusNest checks your domains with HTTP requests every five minutes, sends an alert when a check detects an outage,
          and emails a weekly uptime summary. Add a phone number for calls and SMS, or receive email alerts instead.
        </p>
        <Link href="/register" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Create a free account
        </Link>
      </section>
    </>
  );
}
