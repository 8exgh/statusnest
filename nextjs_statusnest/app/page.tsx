import Link from 'next/link';
import Image from 'next/image';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import SiteCard from '@/components/status/SiteCard';
import JsonLd from '@/components/status/JsonLd';
import { HOME_TITLE, HOME_DESCRIPTION, publicMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site-url';

export const metadata = publicMetadata(HOME_TITLE, HOME_DESCRIPTION, '/');

// Reads the live public-monitor read model on every request.
export const dynamic = 'force-dynamic';

export default function Home() {
  const now = new Date();
  const all = new PublicMonitorQueries().getSitesOverview(now);
  // Only the headline sites here; the full hundred live on /status.
  const overviews = all.filter((o) => o.site.tier === 'primary');
  const others = all.length - overviews.length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <JsonLd data={[
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': absoluteUrl('/#website'),
          name: 'StatusNest', url: absoluteUrl('/'), description: HOME_DESCRIPTION, inLanguage: 'en', publisher: { '@id': absoluteUrl('/#organization') } },
        { '@context': 'https://schema.org', '@type': 'Organization', '@id': absoluteUrl('/#organization'),
          name: 'StatusNest', url: absoluteUrl('/'), logo: absoluteUrl('/status_nest_logo.jpeg') }
      ]} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="mb-6">
            <Image
              src="/status_nest_logo.jpeg"
              alt="StatusNest Logo"
              width={120}
              height={120}
              className="mx-auto rounded-xl shadow-lg"
              priority
            />
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
            Website uptime monitoring<br className="hidden sm:block" /> and outage alerts
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Check your websites every five minutes, get alerts when a check detects an outage, and review uptime in a weekly email.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
          <p className="mt-5 text-sm text-gray-600"><Link href="/how-it-works" className="text-blue-600 hover:underline">How uptime checks, alerts and weekly reports work</Link></p>
        </div>
        
        {overviews.length > 0 && (
          <section className="mt-20" aria-labelledby="top-sites-heading">
            <div className="text-center">
              <h2 id="top-sites-heading" className="text-3xl font-bold text-gray-900">
                Is a popular website down?
              </h2>
              <p className="mt-2 text-gray-600">
                Browse independent browser checks, recent outages and uptime history. Each result shows when it was last checked.
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {overviews.map((overview) => (
                <SiteCard key={overview.site.id} overview={overview} now={now} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href="/status" className="font-medium text-blue-600 hover:text-blue-500">
                {others > 0 ? `and ${others} more — see all status pages →` : 'See all status pages →'}
              </Link>
            </div>
          </section>
        )}

        <section className="mt-20" aria-labelledby="monitoring-features">
          <h2 id="monitoring-features" className="mb-8 text-center text-3xl font-bold text-gray-900">Monitor, get alerted, and review uptime</h2>
          <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Five-minute website checks</h3>
            <p className="text-gray-600">Add a domain to track whether its web server responds. See the latest result and response time on your dashboard.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Outage alerts by phone or email</h3>
            <p className="text-gray-600">Add your phone number for critical calls and SMS through AlertTray. Without a number, alerts go to your email.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v16h16M8 16v-5m4 5V7m4 9v-7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Weekly uptime and outage reports</h3>
            <p className="text-gray-600">Review online percentages, detected outages and monitoring coverage. Turn weekly emails on or off in your Profile.</p>
          </div>
          </div>
        </section>
        <section className="mt-16 rounded-xl border border-blue-100 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">Is it the website, or your connection?</h2>
          <p className="mt-3 text-gray-700">A successful check means the page responded from our monitoring server. It may still fail on another network or behind a sign-in screen. Start with the latest check time, then compare another connection and the service’s own status information.</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-blue-600">
            <Link href="/status" className="font-medium hover:underline">Browse website status pages</Link>
            <Link href="/how-it-works#troubleshooting" className="font-medium hover:underline">Troubleshoot a website that won’t load</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
