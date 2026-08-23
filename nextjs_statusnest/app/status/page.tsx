import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import { absoluteUrl } from '@/lib/site-url';
import SiteCard from '@/components/status/SiteCard';
import JsonLd from '@/components/status/JsonLd';

export const dynamic = 'force-dynamic';

const TITLE = 'Is It Down? Live Status of the World’s Top Websites — StatusNest';
const DESCRIPTION =
  'Live up/down status and uptime history for Google, YouTube, Wikipedia, GitHub, Discord, Steam, Netflix, Spotify, Microsoft and Apple, checked from a real Chromium browser every 5–20 minutes.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/status') },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl('/status'), type: 'website', siteName: 'StatusNest' },
};

export default function StatusIndexPage() {
  const now = new Date();
  const overviews = new PublicMonitorQueries().getSitesOverview(now);
  const up = overviews.filter((o) => o.site.status === 'online').length;
  const down = overviews.filter((o) => o.site.status === 'offline').length;

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
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Live status of the world’s top websites</h1>
        <p className="mt-3 max-w-3xl text-gray-700">
          Each site below is loaded in a <strong>real Chromium browser</strong> on a virtual display — not a script — roughly every
          15 minutes, on a randomised 5–20 minute schedule. The status shown is from the most recent visit; click a site for its
          uptime history, response times and every page we track.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Right now: <strong className="text-gray-900">{up} up</strong>
          {down > 0 && (
            <>
              , <strong className="text-gray-900">{down} unavailable</strong>
            </>
          )}
          {overviews.length - up - down > 0 && <>, {overviews.length - up - down} not checked yet</>}.
        </p>
      </header>

      {overviews.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600">No public monitors are configured yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {overviews.map((overview) => (
            <SiteCard key={overview.site.id} overview={overview} now={now} detailed />
          ))}
        </div>
      )}

      <section className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Monitor your own website the same way</h2>
        <p className="mt-1 text-sm text-gray-700">
          StatusNest checks your domains every 5 minutes and can phone, text and email you the moment one goes offline.
        </p>
        <Link href="/register" className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Create a free account
        </Link>
      </section>
    </>
  );
}
