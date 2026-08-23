# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StatusNest is a domain monitoring service built with CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns. The system consists of three applications:
- **nextjs_statusnest**: Next.js application with integrated backend, plus the public SEO status pages
- **background_processor**: Node.js application for asynchronous domain status checking (users' domains; plain HTTP HEAD)
- **browser_checker**: Node.js + Playwright service that loads the public "top sites" in a real, headed Chromium on a virtual display (Xvfb) inside Docker

## Project Structure

```
statusnest/
├── nextjs_statusnest/     # Main Next.js application (+ /status SEO pages)
├── background_processor/  # Background domain checker for users' domains
└── browser_checker/       # Chromium-on-Xvfb checker for the public monitors
```

## Development Commands

### nextjs_statusnest
```bash
# Setup (from nextjs_statusnest directory)
npm install
npm run dev     # Start development server on port 3000

# Build and production
npm run build
npm run start

# Type checking and linting (if configured)
npm run typecheck
npm run lint
```

### background_processor
```bash
# Setup (from background_processor directory)
npm install
npm run dev     # Start background processor with tsx watch
npm run build   # Compile TypeScript
npm run start   # Run compiled JavaScript
```

### browser_checker
```bash
# Setup (from browser_checker directory)
npm install
npx playwright install chromium      # local only; the Docker image already has it
BROWSER_HEADLESS=1 npm run dev       # local: headless (no X display needed)
docker build -t browser-checker-statusnest . && \
  docker run --rm --network host --shm-size=1g -e STATUSNEST_API_URL=http://localhost:3000 -e API_KEY=<key> browser-checker-statusnest
```

## Architecture

### CQRS & Event Sourcing Implementation
- **Write Model**: Individual SQLite databases per user in `nextjs_statusnest/data/users/{userId}/write.db`
- **Read Model**: Centralized SQLite database at `nextjs_statusnest/data/read_model/read.db`
- **System Database**: Authentication and sessions at `nextjs_statusnest/data/system/system.db`
- **Event Store**: Append-only event log with pre-condition assertions
- **Projection Engine**: 1-second interval processor that updates read model from write models

### Core Components

#### Event Types
- `UserRegisteredEvent`: User account creation
- `ContactDetailsUpdatedEvent`: Phone number / alert email changed (User aggregate)
- `DomainRegisteredEvent`: New domain monitoring setup
- `DomainStatusCheckedEvent`: Domain check result
- `DomainCheckScheduledEvent`: Next check scheduling
- `DomainActivatedEvent` / `DomainDeactivatedEvent`: Monitoring paused/resumed
- `DomainOfflineAlertSentEvent` / `DomainOfflineAlertFailedEvent`: Outcome of the AlertTray offline alert

#### API Structure
- `/api/auth/*`: Authentication endpoints (register, login, logout)
- `/api/domains/*`: Domain management (register, status, toggle)
- `/api/contact`: Current user's phone number / alert email (`GET`, `PUT`; session auth) — edited on `/profile`
- `/api/internal/*`: Secured endpoints for background_processor (tasks, status-update)

### Offline Alerts (via AlertTray)
When a domain transitions to `offline` (from `online` or `unknown` — never repeated while it stays offline), the owner is alerted through [AlertTray](https://alerttray.com) at severity `critical`, its highest level, which AlertTray delivers as a **phone call + SMS** to the user's phone number and falls back to **email** when no phone number is set.
- Trigger: `app/api/internal/status-update/route.ts` compares the read-model status before the check with the new one (`shouldAlertOffline`) and calls `alertDomainOffline`.
- `lib/alerts/offline-alerts.ts`: transition rule, alert wording (plain text — AlertTray reads it out on the call), and recording of `DomainOfflineAlertSentEvent` / `DomainOfflineAlertFailedEvent`. Delivery problems never fail the status update.
- `lib/alerts/alerttray-client.ts`: `POST {ALERTTRAY_API_URL}/api/notifications/push` with `X-API-Key`. The request carries `recipients: { phoneNumber, email }` so AlertTray reaches the StatusNest user rather than the AlertTray account holder (AlertTray feature added for this integration).
- `lib/infrastructure/users/contact-details.ts`: phone number (E.164) and alert email stored on the `users` row in system.db; `getAlertRecipients` falls back to the account email so there is always an email channel.
- Read model: `domain_monitors.last_alert_at / last_alert_channels / last_alert_error` (idempotent `ensureColumn` migrations) — shown on the dashboard.
- Without `ALERTTRAY_API_KEY` the alert is logged and recorded as failed (`DomainOfflineAlertFailedEvent`), nothing is sent.

### Security
- HMAC signatures for internal API communication using shared `BACKGROUND_PROCESSOR_API_KEY`
- Session-based authentication for users
- Bcrypt password hashing (min 10 rounds)
- User data isolation through separate databases
- Outbound AlertTray calls authenticate with `ALERTTRAY_API_KEY` (an AlertTray `atk_…` key)

## Key Implementation Details

### Database Schema Locations
- User events table: Single `events` table with indexes on aggregate_id, created_at, and sequence_number
- Read model: `domain_monitors` table with status tracking (plus `last_alert_*` columns) and `projection_checkpoints` for sync tracking
- System: `users` (incl. `phone_number`, `notification_email`) and `sessions` tables for authentication

### Background Processing Flow
1. Background processor polls `/api/internal/tasks` every 5 seconds
2. Retrieves domains where `next_check_at <= now`
3. Performs HTTP GET with 10-second timeout
4. Reports status via `/api/internal/status-update`
5. System writes events and schedules next check (+5 minutes)
6. If the domain just went offline, the system pushes a `critical` alert to AlertTray (call + SMS, email fallback) and records the outcome

### Frontend Polling
- Dashboard polls `/api/domains/status` every 1 second for real-time updates
- Data served from read model for performance

### Public Monitors (SEO status pages)
**100 popular, bot-tolerant sites × 3 pages each (300 pages)** are checked from a **real, headed Chromium on Xvfb** and published at server-rendered, indexable URLs. They are system-owned, separate from users' domain monitors, and **never routed to AlertTray** (an unavailable public site is marketing data, not an alert).
- Config: `nextjs_statusnest/lib/public-monitors/sites.ts` (`PUBLIC_SITES`) is the source of truth. `ensurePublicSites()` (`seed.ts`, run from `initializeApp`) registers new sites/pages, re-registers changed ones and deactivates removed ones — edit the file, restart, done. Aggregate ids are deterministic (`github`, `github/explore`).
- Every site has a **`category`** (one of the 13 in `PUBLIC_CATEGORIES`, used to group `/status`) and a **`tier`**.
- **Cadence tiers** (`schedule.ts`), triangular jitter so checks never fall into a fixed pattern:
  - `tier: 'primary'` — 5–20 min, mode 15 (mean ~13). The 10 headline sites.
  - `tier: 'standard'` (default) — 20–60 min, mode 40. The other 90.
  - Why: each visit loads every page of a site in a real browser, so traffic scales with sites × frequency. Tiered ≈ 540 page loads/hour; putting all 100 on `primary` would be 1,350/hour (~10× the original 10-site load). Promote a site by adding `tier: 'primary'` to it.
- Events live in the system-owned stream `data/users/public-monitors/write.db` (`PUBLIC_MONITORS_USER_ID`): `PublicSiteRegisteredEvent`, `PublicPageRegisteredEvent`, `PublicSite/PageDeactivatedEvent`, `PublicPageCheckedEvent` (one per page per visit), `PublicSiteCheckScheduledEvent`.
- Read model: `public_sites` (headline status = primary page, `category`, `tier`, `next_check_at`, `claimed_at`), `public_pages`, `public_page_checks` (history for the graphs, 90-day retention swept on each schedule event).
- Internal API for the checker (HMAC, same key as the background processor): `GET /api/internal/public-tasks` hands out up to 10 due sites and **claims** them (`claimed_at`, 10-minute expiry) so two checkers never visit the same site; `POST /api/internal/public-check-result` records one visit `{ siteId, checkedAt, tier, checker, results[] }` and schedules the next from that site's tier.
- **Vetting new sites**: `browser_checker`'s `verify-sites` tool visits a candidate list in the same real browser and reports which sites bot-block, so the list is chosen from evidence rather than guesswork. Do that before adding to `PUBLIC_SITES`.
- `browser_checker/`: visits each page of a site sequentially in a fresh browser context, `online` = HTTP 2xx/3xx and no bot challenge; 403/429/503 or challenge markers ("Just a moment", "Access Denied", captcha…) → `blocked: true`.
- **A bot challenge is not an outage.** Cloudflare-fronted sites (OpenAI, Canva, Perplexity, Crunchyroll…) intermittently challenge our browser while being perfectly up, so a `blocked` check is treated as *"could not verify"*, never as downtime:
  - the projection records the check but **leaves the page's last known status alone** (only `last_checked_at` advances),
  - `getUptime` / `getDailyUptime` / `getSitesOverview` exclude `blocked = 1` rows, and `getIncidents` skips them, so a challenge affects no uptime figure and opens no incident,
  - the status pages render it as a distinct "couldn't verify" state, not a red outage.
  Sites are vetted with `verify-sites` before they go in the list, but intermittent challenges are expected in production — that is what this handling is for.
- Pages (all `force-dynamic`, SSR, inline-SVG charts, JSON-LD): `/status` (grouped by category), `/status/{site}`, `/status/{site}/{page}`; `sitemap.xml` (~405 URLs) / `robots.txt`; the 10 headline sites on `/`. Status colours are the validated pair green `#059669` / red `#dc2626` with hatching + labels so state is never colour-alone.
- `initializeApp()` is skipped during `next build` (`NEXT_PHASE=phase-production-build`) so builds never touch `data/`.

## Environment Variables

### nextjs_statusnest/.env.local
```
DATABASE_PATH=./data
SESSION_SECRET=<random-32-char-string>
BACKGROUND_PROCESSOR_API_KEY=<random-32-char-string>

# Offline alerts via AlertTray (phone call + SMS + email)
ALERTTRAY_API_URL=https://alerttray.com      # or a local AlertTray, e.g. http://localhost:3001
ALERTTRAY_API_KEY=atk_<key from the AlertTray dashboard>
```

Production values are injected by the devops repo workflow (`devops/.github/workflows/deploy-statusnest_nextjs.yml`) as `-e` flags; `ALERTTRAY_API_URL` / `ALERTTRAY_API_KEY` must be added there (secret `STATUSNEST_ALERTTRAY_API_KEY`).

### background_processor/.env
```
STATUSNEST_API_URL=http://localhost:3000
API_KEY=<same-as-BACKGROUND_PROCESSOR_API_KEY>
```

### browser_checker/.env
```
STATUSNEST_API_URL=http://localhost:3000
API_KEY=<same-as-BACKGROUND_PROCESSOR_API_KEY>
# POLL_INTERVAL_MS=30000
# NAVIGATION_TIMEOUT_MS=30000
# BROWSER_HEADLESS=1        # local dev without a display; the container uses Xvfb
```

`NEXT_PUBLIC_SITE_URL` (default `https://statusnest.com`) is the base for canonical URLs, the sitemap and JSON-LD.

## Testing

Run tests with appropriate commands based on the test framework configured:
```bash
npm test        # Run all tests
npm test:unit   # Unit tests only
npm test:e2e    # End-to-end tests
```

## Dependencies

### nextjs_statusnest
- Next.js 14+, React 18+
- better-sqlite3 for database operations
- bcrypt for password hashing
- Tailwind CSS for styling
- TypeScript throughout

### background_processor
- node-fetch for HTTP requests
- dotenv for environment variables
- tsx for TypeScript execution in development

### browser_checker
- playwright (Chromium) — Docker image `mcr.microsoft.com/playwright:<version>-noble` provides the browser, its libraries and `xvfb-run`
- dotenv, tsx