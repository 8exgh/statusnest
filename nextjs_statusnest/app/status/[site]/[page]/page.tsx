import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { loadPageDetail, loadSite, requestNow } from '@/lib/public-monitors/page-data';
import { blockedExplanation, cadenceFor, formatMs, relativeTime, staleExplanation, statusWord, subjectName, verifyState } from '@/lib/public-monitors/format';
import { absoluteUrl } from '@/lib/site-url';
import { publicMetadata, statusDescription, statusHref } from '@/lib/seo';
import StatusHero from '@/components/status/StatusHero';
import UptimeTiles from '@/components/status/UptimeTiles';
import CheckStrip from '@/components/status/CheckStrip';
import DailyUptimeBars from '@/components/status/DailyUptimeBars';
import ResponseTimeChart from '@/components/status/ResponseTimeChart';
import IncidentList from '@/components/status/IncidentList';
import Methodology from '@/components/status/Methodology';
import Faq, { type FaqItem } from '@/components/status/Faq';
import Section from '@/components/status/Section';
import JsonLd from '@/components/status/JsonLd';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ site: string; page: string }> };


export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site: siteSlug, page: pageSlug } = await params;
  const site = loadSite(siteSlug);
  const page = site?.pages.find((p) => p.slug === pageSlug);
  if (!site || !page) return { title: 'Page not found — StatusNest', robots: { index: false } };
  if (page.position === 0) permanentRedirect(statusHref(site.slug));
  const name = subjectName(site.name, page.name);
  return publicMetadata(`Is ${name} Down? Status & Uptime | StatusNest`,
    statusDescription(name), statusHref(site.slug, page), Boolean(page.lastCheckedAt));
}

export default async function PageStatusPage({ params }: Params) {
  const { site: siteSlug, page: pageSlug } = await params;
  const knownPage = loadSite(siteSlug)?.pages.find(p => p.slug === pageSlug);
  if (knownPage?.position === 0) permanentRedirect(statusHref(siteSlug));
  const now = requestNow();
  const data = loadPageDetail(siteSlug, pageSlug, now.getTime());
  if (!data) notFound();
  const { site, page, uptime, checks24h, daily90, incidents30d, latest } = data;
  const latestBlocked = Boolean(latest?.blocked);
  const state = verifyState(page.status, latestBlocked, page.lastCheckedAt, now, site.tier);
  const name = subjectName(site.name, page.name);
  const url = absoluteUrl(`/status/${site.slug}/${page.slug}`);
  const siblings = site.pages.filter((p) => p.id !== page.id);

  const faq: FaqItem[] = [
    {
      question: `Is ${name} down right now?`,
      answer: state === 'stale'
        ? staleExplanation(name, page.lastCheckedAt, now)
        : latestBlocked
        ? `We could not verify ${name} at our last visit ${relativeTime(page.lastCheckedAt, now)}: it served a bot check to our browser instead of the page. That usually means it is up but refusing automated visitors, so we do not record it as an outage. The last check we could complete found it ${statusWord(page.status)}.`
        :
        state === 'unknown'
          ? `${name} has not been checked yet. Its current availability is unknown until a check completes.`
          : `As of our last check ${relativeTime(page.lastCheckedAt, now)}, ${page.url} was ${statusWord(page.status)}${page.responseCode ? ` (HTTP ${page.responseCode}, loaded in ${formatMs(page.responseTimeMs)})` : ''}. We load it in a real Chromium browser rather than a script.`,
    },
    {
      question: `How often is ${name} checked?`,
      answer: `${cadenceFor(site.tier).replace(/^every/, 'Every')}, together with the other ${site.name} pages we track. Each visit is scheduled at random inside that window.`,
    },
    {
      question: 'What does "couldn’t verify" mean?',
      answer:
        'Some sites show a bot check (a "Just a moment…" or "Access denied" page) to automated browsers instead of the real page. We record that as "couldn’t verify" rather than an outage — it usually means the site is up and refusing automated visitors — and it counts toward no uptime figure.',
    },
    {
      question: 'What does "unavailable" mean?',
      answer:
        'The page did not load in our browser: the server returned an error (HTTP 4xx or 5xx), the page timed out after 30 seconds, or the address could not be resolved or connected to. Bot challenges are recorded separately and are not counted as outages.',
    },
    {
      question: 'Can StatusNest monitor my website?',
      answer: 'Yes. Create a free account and add your domain. StatusNest checks it about every five minutes and alerts you when a check detects an outage. Add a phone number for calls and SMS; email is the fallback.',
      render: (
        <>
          Yes.{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Create a free account
          </Link>{' '}
          and add your domain. StatusNest checks it about every five minutes and alerts you when a check detects an outage. Add a phone number for calls and SMS; email is the fallback.
        </>
      ),
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Status', item: absoluteUrl('/status') },
        { '@type': 'ListItem', position: 2, name: site.name, item: absoluteUrl(`/status/${site.slug}`) },
        { '@type': 'ListItem', position: 3, name: page.name, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Is ${name} down right now?`,
      description: statusDescription(name),
      url,
      dateModified: (page.lastCheckedAt ?? page.updatedAt).toISOString(),
      isPartOf: { '@type': 'WebSite', name: 'StatusNest', url: absoluteUrl('/') },
      about: { '@type': 'WebPage', name: page.name, url: page.url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <StatusHero
        crumbs={[{ name: 'Status', href: '/status' }, { name: site.name, href: `/status/${site.slug}` }, { name: page.name }]}
        heading={`Is ${name} down?`}
        subjectName={name}
        status={state}
        lastCheckedAt={page.lastCheckedAt}
        now={now}
        detail={state !== 'stale' && !latestBlocked && page.status !== 'unknown' ? <>{page.responseCode ? `HTTP ${page.responseCode}` : 'no response'} · loaded in {formatMs(page.responseTimeMs)}</> : undefined}
        note={state === 'stale' ? staleExplanation(name, page.lastCheckedAt, now) : latestBlocked ? blockedExplanation(name, page.status, page.status === 'online' ? page.lastOnlineAt : page.lastOfflineAt, now) : undefined}
        externalUrl={page.url}
      />

      <Section title={`${name} uptime`}>
        <UptimeTiles uptime={uptime} />
      </Section>

      <Section title="Last 24 hours">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <CheckStrip checks={checks24h} id="strip-24h" subject={name} />
        </div>
      </Section>

      <Section title="Last 90 days">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DailyUptimeBars days={daily90} id="daily-90" subject={name} />
        </div>
      </Section>

      <Section title="Page load time, last 24 hours">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ResponseTimeChart checks={checks24h} id="rt-24h" subject={name} now={now} />
        </div>
      </Section>

      <Section title="Recent incidents">
        <IncidentList incidents={incidents30d} now={now} emptyLabel={`No outages were detected in the recorded ${name} checks for the last 30 days. Gaps in monitoring are not proof of uptime.`} />
      </Section>

      {siblings.length > 0 && (
        <Section title={`Other ${site.name} pages`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li>
              <Link href={`/status/${site.slug}`} className="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-800 hover:bg-gray-100">
                ← {site.name} overview
              </Link>
            </li>
            {siblings.map((p) => (
              <li key={p.id}>
                <Link href={statusHref(site.slug, p)} className="inline-block rounded-full border border-gray-300 bg-white px-3 py-1 text-gray-800 hover:bg-gray-100">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`How StatusNest checks ${name}`}>
        <Methodology siteName={site.name} pages={[page]} siteSlug={site.slug} tier={site.tier} />
      </Section>

      <Section title="Frequently asked questions">
        <Faq items={faq} />
      </Section>
    </>
  );
}
