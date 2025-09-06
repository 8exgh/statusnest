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
- CQRS with Event Sourcing architecture
- Separate write and read models
- Individual SQLite databases per user

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

### background_processor/.env
- `API_KEY`: Must match `BACKGROUND_PROCESSOR_API_KEY` above
- `STATUSNEST_API_URL`: URL of the Next.js application

## Database Structure

- **System Database**: User authentication and sessions
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