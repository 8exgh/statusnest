import Link from 'next/link';
import Image from 'next/image';
import { PublicMonitorQueries } from '@/lib/public-monitors/queries';
import SiteCard from '@/components/status/SiteCard';

// Reads the live public-monitor read model on every request.
export const dynamic = 'force-dynamic';

export default function Home() {
  const now = new Date();
  const overviews = new PublicMonitorQueries().getSitesOverview(now);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
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
            StatusNest
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Monitor your domains with real-time status updates
          </p>
          <div className="space-x-4">
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
        </div>
        
        {overviews.length > 0 && (
          <section className="mt-20" aria-labelledby="top-sites-heading">
            <div className="text-center">
              <h2 id="top-sites-heading" className="text-3xl font-bold text-gray-900">
                Live status of the world’s top websites
              </h2>
              <p className="mt-2 text-gray-600">
                Checked from a real Chromium browser every 5–20 minutes — is it down, or is it just you?
              </p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {overviews.map((overview) => (
                <SiteCard key={overview.site.id} overview={overview} now={now} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href="/status" className="font-medium text-blue-600 hover:text-blue-500">
                See all status pages →
              </Link>
            </div>
          </section>
        )}

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Real-time Monitoring</h3>
            <p className="text-gray-600">Check domain status every 5 minutes with instant updates</p>
          </div>
          
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Event Sourcing</h3>
            <p className="text-gray-600">Built with CQRS and Event Sourcing for reliability</p>
          </div>
          
          <div className="text-center">
            <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">Secure & Private</h3>
            <p className="text-gray-600">Your data is isolated and protected with enterprise security</p>
          </div>
        </div>
      </div>
    </div>
  );
}
