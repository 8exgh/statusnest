import Link from 'next/link';
import type { PublicPage } from '@/types';
import { cadenceFor, cadenceSentence } from '@/lib/public-monitors/format';

interface MethodologyProps {
  siteName: string;
  pages: PublicPage[];
  siteSlug: string;
  /** Cadence tier of the site ('primary' | 'standard'), drives the stated frequency. */
  tier: string;
}

export default function Methodology({ siteName, pages, siteSlug, tier }: MethodologyProps) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-700">
      <p>
        {cadenceFor(tier).replace(/^every/, 'Every')} — each visit is scheduled at random inside that window, so checks never fall
        into a predictable pattern — a <strong>real Chromium browser</strong> running on a virtual display (Xvfb) on our
        monitoring server opens {pages.length === 1 ? 'this page' : `each of the ${pages.length} ${siteName} pages we track`}
        {pages.length > 1 && (
          <>
            :{' '}
            {pages.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link href={`/status/${siteSlug}/${p.slug}`} className="text-blue-600 hover:underline">
                  {p.name}
                </Link>
              </span>
            ))}
          </>
        )}
        . It is a full browser, not a script, so it sees what a visitor would see.
      </p>
      <p>
        For every visit we record the HTTP status, how long the document took to load, the final URL after redirects and the page
        title. A page counts as <strong>online</strong> when the server answered with a success or redirect status and a real page
        rendered. It counts as <strong>unavailable</strong> when the server returned an error (HTTP 4xx or 5xx), the page did not
        load within 30 seconds, or the address could not be resolved or connected to.
      </p>
      <p>
        Some sites show a <strong>bot check</strong> — a “Just a moment…” or “Access denied” page — to automated browsers instead
        of the real page. That is not evidence of an outage: it normally means the site is up and simply refusing automated
        visitors. We record those visits as <strong>couldn’t verify</strong>, show them separately in the charts, and leave them
        out of every uptime figure and incident.
      </p>
      <p>
        {cadenceSentence(tier, siteName)}{' '}
        {pages.length > 1 ? `The headline status for ${siteName} follows its primary page (${pages[0]?.name}); every tracked page has its own status page. ` : ''}
        Check history is kept for 90 days. These public checks are informational and are not connected to any alerting — if you
        want to be called or texted when <em>your</em> site goes down,{' '}
        <Link href="/register" className="text-blue-600 hover:underline">
          monitor it with StatusNest
        </Link>
        .
      </p>
    </div>
  );
}
