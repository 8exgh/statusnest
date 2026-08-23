# StatusNest MVP

A domain monitoring service built with CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns.

## Architecture

- **nextjs_statusnest**: Main Next.js application with CQRS/Event Sourcing backend
- **background_processor**: Node.js application for asynchronous domain checking

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
- Domain monitoring with 5-minute interval checks
- Real-time status updates (1-second polling)
- **Offline alerts**: a phone call + SMS (or email) the moment a domain goes offline (via AlertTray)
- CQRS with Event Sourcing architecture
- Separate write and read models
- Individual SQLite databases per user

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