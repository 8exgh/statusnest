# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StatusNest is a domain monitoring service built with CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns. The system consists of two main applications:
- **nextjs_statusnest**: Next.js application with integrated backend
- **background_processor**: Node.js application for asynchronous domain status checking

## Project Structure

The repository should contain two root-level applications:
```
statusnest/
├── nextjs_statusnest/     # Main Next.js application
└── background_processor/  # Background domain checker
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