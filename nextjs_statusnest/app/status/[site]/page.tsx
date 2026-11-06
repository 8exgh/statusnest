import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadSite, loadSiteDetail, requestNow } from '@/lib/public-monitors/page-data';
import { blockedExplanation, cadenceFor, formatMs, relativeTime, staleExplanation, statusWord, subjectName, verifyState } from '@/lib/public-monitors/format';
import { absoluteUrl } from '@/lib/site-url';
import { publicMetadata, statusDescription, statusHref } from '@/lib/seo';
import StatusHero from '@/components/status/StatusHero';
import UptimeTiles from '@/components/status/UptimeTiles';
import CheckStrip from '@/components/status/CheckStrip';
import DailyUptimeBars from '@/components/status/DailyUptimeBars';
import ResponseTimeChart from '@/components/status/ResponseTimeChart';
import PagesTable from '@/components/status/PagesTable';
import IncidentList from '@/components/status/IncidentList';
import Methodology from '@/components/status/Methodology';
import Faq, { type FaqItem } from '@/components/status/Faq';
import Section from '@/components/status/Section';
import JsonLd from '@/components/status/JsonLd';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site: slug } = await params;
  const site = loadSite(slug);
  if (!site) return { title: 'Site not found — StatusNest', robots: { index: false } };
  return publicMetadata(`Is ${site.name} Down? Status & Uptime | StatusNest`,
    statusDescription(site.name), statusHref(site.slug), Boolean(site.pages[0]?.lastCheckedAt));
}

export default async function SiteStatusPage({ params }: Params) {
  const { site: slug } = await params;
  const now = requestNow();
  const data = loadSiteDetail(slug, now.getTime());
  if (!data) notFound();
  const { site, primary, uptime, checks24h, daily90, incidents30d, pageUptime24h, latestByPage } = data;
  const url = absoluteUrl(`/status/${site.slug}`);
  const pageCount = site.pages.length;
  // A bot challenge tells us nothing about whether the site is up, so it gets
  // its own state rather than being reported as an outage.
  const latestBlocked = Boolean(primary && latestByPage.get(primary.id)?.blocked);
  const checkedAt = primary?.lastCheckedAt;
  const state = verifyState(site.status, latestBlocked, checkedAt, now, site.tier);

  const faq: FaqItem[] = [
    {
      question: `Is ${site.name} down right now?`,
      answer: state === 'stale'
        ? staleExplanation(site.name, checkedAt, now)
        : latestBlocked
        ? `We could not verify ${site.name} at our last visit ${relativeTime(primary?.lastCheckedAt ?? site.lastCheckedAt, now)}: it served a bot check to our browser instead of the page. That usually means the site is up but is refusing automated visitors, so we do not record it as an outage. The last check we could complete found it ${statusWord(site.status)}.`
        : state === 'unknown'
          ? `${site.name} has not been checked yet. Its current availability is unknown until a check completes.`
          : `As of our last check ${relativeTime(checkedAt, now)}, ${subjectName(site.name, primary?.name)} was ${statusWord(site.status)} from our monitoring server. This is an independent observation; availability may differ by network, region or sign-in state.`,
    },
    {
      question: `How often is ${site.name} checked?`,
      answer: `${cadenceFor(site.tier).replace(/^every/, 'Every')}. Each visit is scheduled at random inside that window, so the checks never fall into a predictable pattern. We check ${pageCount} ${site.name} page${pageCount === 1 ? '' : 's'}: ${site.pages.map((p) => p.name).join(', ')}.`,
    },
    {
      question: 'What does "unavailable" mean?',
      answer:
        'The page did not load in our browser: the server returned an error (HTTP 4xx or 5xx), the page timed out after 30 seconds, or the address could not be resolved or connected to.',
    },
    {
      question: 'What does "couldn’t verify" mean?',
      answer:
        'Some sites show a bot check (a "Just a moment…" or "Access denied" page) to automated browsers instead of the real page. When that happens we record the visit as "couldn’t verify" rather than an outage, because it is not evidence that the site is down — it usually means the site is up and refusing automated visitors. These checks count toward no uptime figure and open no incident.',
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
        { '@type': 'ListItem', position: 2, name: site.name, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `Is ${site.name} down right now?`,
      description: statusDescription(site.name),
      url,
      dateModified: (primary?.lastCheckedAt ?? site.updatedAt).toISOString(),
      isPartOf: { '@type': 'WebSite', name: 'StatusNest', url: absoluteUrl('/') },
      about: { '@type': 'WebSite', name: site.name, url: site.url },
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
        crumbs={[{ name: 'Status', href: '/status' }, { name: site.name }]}
        heading={`Is ${site.name} down right now?`}
        subjectName={site.name}
        status={state}
        lastCheckedAt={primary?.lastCheckedAt ?? site.lastCheckedAt}
        now={now}
        detail={
          state !== 'stale' && !latestBlocked && primary && primary.status !== 'unknown' ? (
            <>
              {primary.name}: {primary.responseCode ? `HTTP ${primary.responseCode}` : 'no response'} · loaded in {formatMs(primary.responseTimeMs)}
            </>
          ) : undefined
        }
        note={state === 'stale' ? staleExplanation(site.name, checkedAt, now) : latestBlocked ? blockedExplanation(site.name, site.status, site.status === 'online' ? primary?.lastOnlineAt : primary?.lastOfflineAt, now) : undefined}
        externalUrl={site.url}
      />

      <p className="mb-8 max-w-3xl text-gray-700">{site.description} This independent status page follows the public pages listed below and is not an official status report from {site.name}.</p>

      <Section title={`${site.name} uptime`}>
        <UptimeTiles uptime={uptime} />
        {primary && pageCount > 1 && <p className="mt-2 text-xs text-gray-500">Uptime and charts are for the primary page, {primary.name}; every page is listed below.</p>}
      </Section>

      <Section title="Last 24 hours">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <CheckStrip checks={checks24h} id="strip-24h" subject={subjectName(site.name, primary?.name)} />
        </div>
      </Section>

      <Section title="Last 90 days">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <DailyUptimeBars days={daily90} id="daily-90" subject={subjectName(site.name, primary?.name)} />
        </div>
      </Section>

      <Section title="Page load time, last 24 hours">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <ResponseTimeChart checks={checks24h} id="rt-24h" subject={subjectName(site.name, primary?.name)} now={now} />
        </div>
      </Section>

      <Section title={`${site.name} pages we monitor`}>
        <PagesTable
          now={now}
          tier={site.tier}
          rows={site.pages.map((page) => ({
            page,
            href: statusHref(site.slug, page),
            uptime24h: pageUptime24h.get(page.id) ?? { uptime: null, checks: 0, online: 0, offline: 0 },
            latestBlocked: Boolean(latestByPage.get(page.id)?.blocked),
          }))}
        />
      </Section>

      <Section title="Recent incidents">
        <IncidentList incidents={incidents30d} now={now} emptyLabel={`No outages were detected in the recorded ${site.name} checks for the last 30 days. Gaps in monitoring are not proof of uptime.`} />
      </Section>

      <Section title={`How StatusNest checks ${site.name}`}>
        <Methodology siteName={site.name} pages={site.pages} siteSlug={site.slug} tier={site.tier} />
      </Section>

      <Section title="Frequently asked questions">
        <Faq items={faq} />
      </Section>
    </>
  );
}
