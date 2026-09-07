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

## Offline Alerts

When a monitored domain stops responding, StatusNest raises a highest-priority (`critical`) notification through
[AlertTray](https://alerttray.com). AlertTray delivers it as a **phone call + SMS** to the phone number on the
user's profile, or as an **email** when no phone number is set (AlertTray's routing policy for `critical`;
to always include email as well, add `'email'` to `critical` in AlertTray's `routing-policy.ts`). The alert
fires once per outage (on the transition to offline), and the dashboard shows when it was sent and on which channels.

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
