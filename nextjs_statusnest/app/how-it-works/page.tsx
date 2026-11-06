import Link from 'next/link';
import StatusLayout from '@/app/status/layout';
import JsonLd from '@/components/status/JsonLd';
import { publicMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site-url';

const title = 'How Website Uptime Monitoring Works | StatusNest';
const description = 'Learn how StatusNest checks website availability, measures uptime, handles bot challenges, sends outage alerts and reports gaps in monitoring.';
export const metadata = publicMetadata(title, description, '/how-it-works');

export default function HowItWorks() {
  return <StatusLayout>
    <JsonLd data={[
      { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description,
        url: absoluteUrl('/how-it-works'), isPartOf: { '@type': 'WebSite', name: 'StatusNest', url: absoluteUrl('/') } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'How it works', item: absoluteUrl('/how-it-works') }
      ] }
    ]} />
    <article className="max-w-3xl space-y-10 text-gray-700 leading-relaxed">
      <header>
        <p className="mb-3 text-sm"><Link href="/" className="text-blue-600 hover:underline">StatusNest</Link> / How it works</p>
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">How StatusNest monitors website uptime</h1>
        <p className="mt-4">StatusNest records whether a website responds from our monitoring server. You can monitor your own domains with alerts and weekly reports, or browse independent checks of popular websites. The two types of monitoring use different checks.</p>
      </header>

      <section aria-labelledby="your-websites">
        <h2 id="your-websites" className="text-2xl font-bold text-gray-900">Monitoring your own websites</h2>
        <p className="mt-3">Add a domain to your dashboard and StatusNest checks it about every five minutes with an HTTP HEAD request. It tries HTTPS first, then HTTP if needed. A response below HTTP 500 counts as the server being reachable, including a sign-in or permission response such as HTTP 401 or 403.</p>
        <p className="mt-3">Connection failures and server errors are retried within a short check window before a domain is marked offline. These checks establish server reachability; they do not log in, submit forms, verify checkout flows, or prove that every feature on a site works.</p>
        <p className="mt-3">When a domain changes to offline, StatusNest sends a critical alert through AlertTray. A phone number on your Profile enables calls and SMS; email is the fallback when no number is set. An outage alert is sent on the transition, rather than on every failed check.</p>
        <Link href="/register" className="mt-4 inline-block font-medium text-blue-600 hover:underline">Start monitoring your website →</Link>
      </section>

      <section aria-labelledby="public-checks">
        <h2 id="public-checks" className="text-2xl font-bold text-gray-900">How public website status pages work</h2>
        <p className="mt-3">Our <Link href="/status" className="text-blue-600 hover:underline">public status pages</Link> use Chromium to open selected pages of popular websites. Headline sites are scheduled every 5–20 minutes; other sites every 20–60 minutes. Scheduling varies within those windows.</p>
        <p className="mt-3">A successful or redirected response with a real page counts as online. A server error, a navigation timeout, or a connection failure can count as unavailable. Bot challenges and access-blocking pages are marked “couldn’t verify” and excluded from uptime calculations and incidents.</p>
        <p className="mt-3">Every result includes its check time. After two maximum scheduling windows without a check—40 minutes for headline sites or two hours for other sites—the current status is marked “check overdue.” Historical observations remain visible. A missing check does not establish uptime or downtime.</p>
        <p className="mt-3">These are independent observations, not the monitored companies’ official service reports. A public homepage responding does not prove that its API, sign-in, payments, or every region is working. Public status checks do not trigger alerts to StatusNest accounts.</p>
      </section>

      <section aria-labelledby="uptime-calculation">
        <h2 id="uptime-calculation" className="text-2xl font-bold text-gray-900">How online percentages are calculated</h2>
        <div className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <p><strong className="text-gray-900">Public status pages:</strong> online checks divided by completed, non-blocked checks. For example, 99 online checks out of 100 completed checks gives 99% observed uptime. This is a sample of checks, not a measurement of every second between visits. History is retained for 90 days.</p>
          <p><strong className="text-gray-900">Your weekly email:</strong> observed online time divided by observed online plus offline time. A check covers at most ten minutes, ending sooner at the next check or a monitoring pause. The report lists unknown time and monitoring coverage separately. Overall online percentage is weighted by observed time across your domains.</p>
        </div>
        <p className="mt-3">No observations means no data, never 100% uptime. A report can show 100% online during its observed time while still having gaps in coverage. Check both figures before drawing a conclusion. Outage start times, recoveries and durations are estimates based on checks.</p>
      </section>

      <section aria-labelledby="weekly-reports">
        <h2 id="weekly-reports" className="text-2xl font-bold text-gray-900">Weekly reports and email preferences</h2>
        <p className="mt-3">New accounts receive a welcome email and their first report after one week. Weekly reports show the previous seven days of online percentages, detected outages, pauses and missing observations. They go to your account email.</p>
        <p className="mt-3">Use the unsubscribe link in any weekly report or the weekly email switch in <Link href="/profile" className="text-blue-600 hover:underline">your Profile</Link>. Re-enabling starts a fresh weekly cycle. Turning weekly email off keeps website monitoring and immediate outage alerts active.</p>
      </section>

      <section aria-labelledby="troubleshooting">
        <h2 id="troubleshooting" className="text-2xl font-bold text-gray-900">A website won’t load. What should you check?</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-6">
          <li><strong>Read the latest check time.</strong> An old result or a bot challenge cannot confirm the site’s current status.</li>
          <li><strong>Check the page you actually need.</strong> The homepage may work while another page or feature fails. Compare the separately monitored pages where available.</li>
          <li><strong>Try another browser or connection.</strong> A private browsing window or mobile data can help distinguish a local browser, network or DNS problem from a wider outage.</li>
          <li><strong>Look for the service’s official update.</strong> The provider can explain maintenance, regional incidents and failures behind a login that our public checks cannot see.</li>
          <li><strong>If you own the site, review its logs and hosting status.</strong> Check recent deployments and server errors alongside StatusNest’s observed response code and time.</li>
        </ol>
      </section>

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-xl font-bold text-gray-900">See the latest recorded checks</h2>
        <p className="mt-2">Explore <Link href="/status/github" className="text-blue-600 hover:underline">GitHub status</Link>, <Link href="/status/discord" className="text-blue-600 hover:underline">Discord status</Link>, or <Link href="/status" className="text-blue-600 hover:underline">all monitored websites</Link>. To receive alerts for your own domain, <Link href="/register" className="text-blue-600 hover:underline">create an account</Link>.</p>
      </section>
    </article>
  </StatusLayout>;
}
