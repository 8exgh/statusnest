# StatusNest MVP

A domain monitoring service built with CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns.

## Architecture

- **nextjs_statusnest**: Main Next.js application with CQRS/Event Sourcing backend and the public SEO status pages
- **background_processor**: Node.js application for asynchronous domain checking (users' domains)
- **browser_checker**: Playwright + headed Chromium on a virtual display (Xvfb), in Docker, for the public "top sites" monitors

## Quick Start

### 1. Start the Next.js Application

```bash
cd nextjs_statusnest
npm install
npm run dev
```

The application will be available at http://localhost:3000

### 2. Start the Background Processor

In a new terminal:

```bash
cd background_processor
npm install
npm run dev
```

## Features

- User registration and authentication
- Signup and website-added email notifications to `sbennett@8examples.com`
- Welcome emails for new accounts and weekly uptime/outage reports to each account email
- Domain monitoring with 5-minute interval checks
- Real-time status updates (1-second polling)
- **Offline alerts**: a phone call + SMS (or email) the moment a domain goes offline (via AlertTray)
- **Public status pages** for the world's top websites, checked from a real browser (`/status`)
- CQRS with Event Sourcing architecture
- Separate write and read models
- Individual SQLite databases per user

## Public Status Pages (SEO)

`/status` publishes live, server-rendered status pages for **100 popular websites** — Google, YouTube, Reddit,
GitHub, Discord, Steam, Netflix, Roblox, OpenAI and 91 more — three pages each, e.g. `/status/github` and
`/status/github/explore`. Sites are grouped into 13 categories (search, social, video, music, gaming, AI,
developer, cloud, tech, news, shopping, finance, learning).

Each site is loaded in a **real, headed Chromium browser on a virtual display** (the `browser_checker`
container), and every page shows green/red check history for the last 24 hours, 90-day daily uptime, response
times and recent incidents. Checks are jittered so they never fall into a fixed pattern:

| Tier | Cadence | Sites |
|---|---|---|
| `primary` | every 5–20 minutes (mode 15) | the 10 headline sites |
| `standard` | every 20–60 minutes (mode 40) | the other 90 |

Each visit loads every page of a site in a real browser, so traffic scales with sites × frequency — the tiers
keep 100 sites at about 540 page loads an hour. Promote any site by adding `tier: 'primary'` to it in
`nextjs_statusnest/lib/public-monitors/sites.ts`, which is the source of truth for the whole list.

These monitors are independent of user accounts and never trigger AlertTray; they exist for the status pages
(and the search traffic they attract). Before adding a site, vet it with the `verify-sites` tool in
`browser_checker` — it visits candidates in the same real browser and reports which ones serve a bot challenge.

```bash
cd browser_checker
npm install
docker build -t browser-checker-statusnest .
docker run --rm --network host --shm-size=1g \
  -e STATUSNEST_API_URL=http://localhost:3000 -e API_KEY=<BACKGROUND_PROCESSOR_API_KEY> \
  browser-checker-statusnest
```

## Search visibility and monitoring documentation

The homepage describes website monitoring, outage alerts and weekly reports. Public pages have canonical
URLs, distinct metadata, Open Graph/Twitter previews and structured data. The [monitoring guide](https://statusnest.com/how-it-works)
explains how public browser checks differ from account HTTP checks, how uptime is calculated, and what
monitoring gaps and bot challenges mean.

Primary-page paths such as `/status/github/home` permanently redirect to `/status/github`. Internal links
and the sitemap use that same canonical URL; secondary pages such as `/status/github/explore` stay distinct.
The sitemap includes only checked monitoring pages, plus the homepage, status directory, guide and crawler
information. It omits login, registration and account screens. Those screens carry `noindex` metadata and
remain crawlable so search engines can read it. Private deployments publish an empty sitemap.

Status observations become **check overdue** after two maximum scheduling windows (40 minutes for headline
sites, two hours for standard sites). Old observations remain available as history but do not count as
currently online or offline in the directory. Never-checked pages remain noindex until observations exist.
Search descriptions describe the report rather than embedding a status that could go stale in a search snippet.

Implementation follows Google's guidance on [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), and
[sitemap timestamps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
Search Console query and indexing data were not available for this audit; ranking or traffic improvements
must be measured after recrawling rather than inferred from these technical changes.

## Offline Alerts

When a monitored domain stops responding, StatusNest raises a highest-priority (`critical`) notification through
[AlertTray](https://alerttray.com). AlertTray delivers it as a **phone call + SMS** to the phone number on the
user's profile, or as an **email** when no phone number is set (AlertTray's routing policy for `critical`;
to always include email as well, add `'email'` to `critical` in AlertTray's `routing-policy.ts`). The alert
fires once per outage (on the transition to offline), and the dashboard shows when it was sent and on which channels.

**Quiet hours:** In **Profile → Quiet hours**, enable a weekly schedule, choose a timezone, and add
one or more time ranges with their starting weekdays. During any matching range, alerts use AlertTray's
email-only (`medium`) routing and carry no phone recipient. Email goes to the alert email, falling back
to the account email. Outside those ranges, normal calls/SMS resume. An alert already sent by email
is not called or texted again when quiet hours end.

Ranges include their start and exclude their end. Overnight ranges end on the following day (Monday
22:00–07:00 includes Tuesday morning). Overlaps are combined, and local times follow the selected
timezone's daylight saving changes, including both occurrences of a repeated hour. Equal start/end
times are rejected. Quiet hours default to off; disabling them preserves the saved ranges.

`GET`/`PUT /api/alert-preferences` are session-scoped. `SetAlertQuietHours` records an
`AlertQuietHoursUpdatedEvent` in the user's event store; dispatch reads the latest preference directly
so changes apply immediately without waiting for projections. Routing uses the alert dispatch time,
not a delayed check timestamp. No database schema migration is needed. Regression coverage lives in
`nextjs_statusnest/tests/quiet-hours.test.ts` and uses temporary databases and a mocked AlertTray client.

Setup:
1. Create an AlertTray account, generate an API key on its dashboard and put it in `nextjs_statusnest/.env.local`
   as `ALERTTRAY_API_KEY` (see `.env.example`). Point `ALERTTRAY_API_URL` at a local AlertTray for development.
2. Each StatusNest user adds their phone number (international format, e.g. `+14155552671`) and optionally a
   separate alert email on **Profile** (`/profile`). The dashboard nags until a phone number is set.
3. Calls and texts come from AlertTray's number **+1 587-809-5774** — save it as a contact so critical alerts
   can bypass Do Not Disturb.

Without `ALERTTRAY_API_KEY` nothing is sent; the attempt is logged and shown on the dashboard as a failed alert.

## Signup and website-added emails

New signups and websites added to an account send an email to **sbennett@8examples.com**, including
the account email, account ID, UTC time, and (for a website) its domain and ID.

The registration command appends `EmailNotificationRequestedEvent` in the same event-store transaction
as `UserRegisteredEvent` or `DomainRegisteredEvent`. The projection creates an `email_notifications`
read-model task. The background processor polls `GET /api/internal/email-tasks` every five seconds,
then issues a claim command through the HMAC-authenticated `POST /api/internal/email-tasks` before
sending via Gmail. Domain checks and email processing run in separate polling loops.

Claims and delivery outcomes are events in the user's write database. Claims expire after five minutes;
failed sends retry after one minute, doubling up to one hour. A successful send is never selected again.
Queries are read-only, and claim commands validate the current event stream transactionally so a stale
query or another worker cannot claim active or completed work. Rebuilding projections restores delivery
state and does not create emails for registrations made before this feature was installed.

The worker retains unacknowledged delivery results in memory and retries recording them without sending
again. Delivery is **at least once**: a worker crash after Gmail accepts a message but before the result
is recorded can produce a duplicate. Each notification uses a stable Message-ID, but SMTP does not
guarantee deduplication.

Configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` on the background processor. Without both, it keeps
checking domains and leaves email tasks queued. The sender uses Gmail's TLS SMTP preset and an app
password ([Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail)).

Production runtime settings live in the **devops** repository. Apply
[`deployment/devops-gmail-notifications.patch`](deployment/devops-gmail-notifications.patch) there:

```bash
cd ../devops
git apply ../statusnest/deployment/devops-gmail-notifications.patch
```

The patch passes the existing `GMAIL_8EXAMPLES_USER` and `GMAIL_8EXAMPLES_APP_PASSWORD` GitHub secrets
into the worker container without baking credentials into its image. Deploy the updated Next.js app
and background processor along with that workflow change to activate delivery.

Email tests use temporary databases and mock SMTP; they do not send real messages:

```bash
cd nextjs_statusnest && npm test
cd ../background_processor && npm test
```

## Testing the System

### Welcome and weekly report emails

Successful registration atomically records `UserRegisteredEvent`, the existing admin email request,
an onboarding `EmailNotificationRequestedEvent`, and `WeeklySummaryScheduleStartedEvent`. The welcome
email links to the dashboard and alert profile and explains monitoring and weekly reports. Retrying
registration recording cannot queue another welcome. Historical registration replay does not send welcomes.

Every account receives a report every seven days, anchored to its schedule's UTC timestamp. New accounts
receive their first report one week after registration. Existing accounts receive an immediate report on
the first deployment of this feature, covering the preceding seven days, then every seven days thereafter.
Restarts and later deploys preserve this schedule. After prolonged downtime, only the latest due report is
prepared, avoiding a backlog of obsolete emails. Reports go to the account email; the separate alert email
continues to apply to outage alerts.

**Weekly email controls:** Profile has a **Weekly status emails** switch. Changes append
`WeeklySummaryPreferenceChangedEvent`; the due view excludes disabled accounts, and the preparation
command also checks the event stream so a stale view cannot bypass the preference. Re-enabling starts
a fresh seven-day cycle. Pending weekly emails created before an opt-out are permanently cancelled
when a worker next tries to claim them, even if reports have since been re-enabled. Claims check the
preference under the same write transaction and record `EmailNotificationCancelledEvent`. Messages
already claimed and in flight may finish delivery. Welcome emails and immediate outage alerts are unaffected.

Weekly emails include a signed, purpose-specific unsubscribe link. Opening it submits the unsubscribe
without login or a second click; ordinary HTTP GET previews are read-only. They also carry
`List-Unsubscribe` and `List-Unsubscribe-Post` headers for supporting mail clients, using the
[RFC 8058 POST convention](https://www.rfc-editor.org/rfc/rfc8058). The HMAC uses the existing
`SESSION_SECRET` (required); rotating it invalidates old links. Preferences can always be changed on
Profile after signing in. `/api/email-preferences` requires session authentication; the public
unsubscribe endpoint accepts only signed requests to disable weekly mail.

The startup automation runs immediately and every minute. It reads the `weekly_summary_schedule` todo
view and issues `PrepareWeeklySummary`. This command checks the authoritative schedule stream under a
write transaction and atomically appends `WeeklySummaryPreparedEvent` (the full report snapshot, source
sequence, and next due time) and a deterministic `EmailNotificationRequestedEvent`. The existing Gmail
worker claims and delivers it, then records the outcome. Queries and projections never send mail.

The report uses time-weighted online percentage: online / (online + offline). Each check covers at most
ten minutes, ending sooner at the next check or monitoring pause. The email separately shows monitoring
coverage, unknown time, paused time, and outage start/end/duration estimates. No observations means N/A,
never 100%. Unknown gaps split outage episodes; public SEO monitors are excluded. Reports use half-open
UTC windows and clip outages crossing a window boundary. Overall uptime weights each site's observed time.

`reporting_checkpoints` independently backfills existing domain events in batches, so introducing this
projection does not reset the existing email-delivery checkpoint. Report history and schedules rebuild
from their events; rebuilding does not request new email. SMTP delivery retains the at-least-once caveat
described above.

The devops workflow runs this after its HTTP health check:

```bash
docker exec nextjs-statusnest node scripts/weekly-summary-after-deploy.mjs
```

It calls HMAC-authenticated `POST /api/internal/weekly-summaries` to run the same idempotent automation,
then polls the read-only `GET` endpoint for recorded SMTP acceptance, failing the deployment verification
if reports remain unsent after five minutes. This verifies provider acceptance, not inbox placement.
No new credentials are required. The existing worker must have its Gmail credentials configured.

The event model is specified by these slices (following [Adam Dymitruk's Event Modeling](https://eventmodeling.org/posts/what-is-event-modeling/)
and the [automation/todo pattern](https://eventmodeling.org/posts/event-modeling-cheatsheet/)):

| Trigger / view | Command | Events / resulting view |
| --- | --- | --- |
| Successful signup | RecordUserRegistration | UserRegistered + onboarding EmailNotificationRequested + WeeklySummaryScheduleStarted → email tasks / weekly schedule |
| Existing accounts at rollout | StartWeeklySummaries | WeeklySummaryScheduleStarted → immediate due row (once) |
| Domain registration, checks, pause/resume events | Projection only | Reporting domains and observations → uptime report view |
| Weekly schedule due row → timer robot | PrepareWeeklySummary | WeeklySummaryPrepared + EmailNotificationRequested → next due time / pending email |
| Pending email → delivery robot | ClaimEmailNotification | EmailNotificationClaimed → leased delivery task |
| SMTP response | RecordEmailNotificationSent / Failed | Sent / Failed → completed task or retry due time |
| Profile switch / signed unsubscribe link | SetWeeklySummaryPreference | WeeklySummaryPreferenceChanged → enabled/disabled schedule |
| Pending weekly email after opt-out → delivery robot | ClaimEmailNotification | EmailNotificationCancelled → terminal task excluded from delivery |

Executable given/when/then examples live in `nextjs_statusnest/tests/weekly-summary.test.ts`:
registration retries; outage grouping; boundary carry-in; unknown/paused time; user isolation; historical
backfill; overdue scheduling; competing stale commands; rollout repetition; rebuild after delivery;
unsubscribe signatures; preference replay; account isolation; and cancellation after opt-out/re-enable.

### Manual walkthrough

1. Navigate to http://localhost:3000
2. Click "Get Started" to create an account
3. Log in with your credentials
4. Add domains to monitor (e.g., google.com, github.com)
5. Watch real-time status updates on the dashboard

## Environment Variables

Both applications use `.env` files with default development values. For production:

### nextjs_statusnest/.env.local
- `SESSION_SECRET`: Change to a random 32-character string
- `BACKGROUND_PROCESSOR_API_KEY`: Change to a secure API key
- `ALERTTRAY_API_URL`: AlertTray base URL (defaults to `https://alerttray.com`)
- `ALERTTRAY_API_KEY`: AlertTray API key used to send offline alerts

### background_processor/.env
- `API_KEY`: Must match `BACKGROUND_PROCESSOR_API_KEY` above
- `STATUSNEST_API_URL`: URL of the Next.js application
- `GMAIL_USER`: Google account that sends signup and website-added emails
- `GMAIL_APP_PASSWORD`: App password for that account

## Database Structure

- **System Database**: User authentication, sessions and alert contact details (phone number, alert email)
- **User Write Databases**: Individual event stores per user
- **Read Model Database**: Projected domain monitor states

## Development

The system uses:
- Next.js 14 with App Router
- TypeScript throughout
- Tailwind CSS for styling
- SQLite with better-sqlite3
- Event Sourcing with projection engine
- Secure API communication with HMAC signatures
