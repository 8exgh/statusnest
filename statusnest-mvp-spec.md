# StatusNest MVP Technical Specification

## Executive Summary

StatusNest is a domain monitoring service built with CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns. Users can register domains to monitor their online/offline status with automatic 5-minute interval checks.

## System Architecture Overview

### High-Level Components

1. **nextjs_statusnest** (Root folder)
   - Next.js application with integrated backend
   - CQRS implementation with Event Sourcing
   - Secure API endpoints
   - Frontend UI with Tailwind CSS
   - TypeScript throughout

2. **background_processor** (Root folder)
   - Node.js application
   - Asynchronous domain status checker
   - Communicates with nextjs_statusnest via secure APIs

### Database Architecture

#### 1. User Write Model Databases (SQLite)
- **Creation**: One database per user account
- **Structure**: Single `events` table only
- **Location**: `nextjs_statusnest/data/users/{userId}/write.db`
- **Schema**:
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aggregate_id TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_version INTEGER NOT NULL,
    event_data JSON NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sequence_number INTEGER NOT NULL
);
CREATE INDEX idx_aggregate ON events(aggregate_id, aggregate_type);
CREATE INDEX idx_created_at ON events(created_at);
CREATE INDEX idx_sequence ON events(sequence_number);
```

#### 2. System Database (SQLite)
- **Location**: `nextjs_statusnest/data/system/system.db`
- **Purpose**: User sessions and authentication
- **Schema**:
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_session_token ON sessions(token_hash);
CREATE INDEX idx_session_expiry ON sessions(expires_at);
```

#### 3. Read Model Database (SQLite)
- **Location**: `nextjs_statusnest/data/read_model/read.db`
- **Purpose**: Projected state from all write models
- **Schema**:
```sql
CREATE TABLE domain_monitors (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('online', 'offline', 'unknown')),
    last_checked_at TIMESTAMP,
    next_check_at TIMESTAMP,
    response_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX idx_domain ON domain_monitors(domain);
CREATE INDEX idx_user ON domain_monitors(user_id);
CREATE INDEX idx_next_check ON domain_monitors(next_check_at);

CREATE TABLE projection_checkpoints (
    user_id TEXT PRIMARY KEY,
    last_processed_sequence INTEGER NOT NULL,
    last_processed_at TIMESTAMP
);
```

## Detailed Component Specifications

### A. nextjs_statusnest Application

#### 1. Project Structure
```
nextjs_statusnest/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── register/route.ts
│   │   │   ├── domains/
│   │   │   │   ├── register/route.ts
│   │   │   │   └── status/route.ts
│   │   │   ├── internal/
│   │   │   │   ├── tasks/route.ts
│   │   │   │   └── status-update/route.ts
│   │   │   └── middleware.ts
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── cqrs/
│   │   │   ├── command-bus.ts
│   │   │   ├── event-store.ts
│   │   │   ├── projection-engine.ts
│   │   │   └── query-bus.ts
│   │   ├── domain/
│   │   │   ├── events/
│   │   │   ├── commands/
│   │   │   └── aggregates/
│   │   ├── infrastructure/
│   │   │   ├── database/
│   │   │   ├── security/
│   │   │   └── monitoring/
│   │   └── utils/
│   ├── components/
│   └── types/
├── data/
├── package.json
└── tsconfig.json
```

#### 2. Core CQRS Implementation

**Event Store Implementation**:
```typescript
interface Event {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  eventData: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  sequenceNumber: number;
}

class EventStore {
  async appendEvents(userId: string, events: Event[]): Promise<void> {
    // Pre-condition assertions
    assert(userId, "User ID is required");
    assert(events.length > 0, "At least one event required");
    
    // Write to user's write model database
    // Use transactions for atomicity
  }
  
  async getEvents(userId: string, fromSequence: number): Promise<Event[]> {
    // Retrieve events from user's database
  }
}
```

**Command Bus**:
```typescript
interface Command {
  userId: string;
  aggregateId: string;
  type: string;
  payload: Record<string, any>;
}

class CommandBus {
  async dispatch(command: Command): Promise<void> {
    // Validate command
    // Route to appropriate handler
    // Generate events
    // Store events
  }
}
```

**Projection Engine**:
```typescript
class ProjectionEngine {
  private checkInterval = 1000; // 1 second
  
  async start(): Promise<void> {
    setInterval(async () => {
      await this.processProjections();
    }, this.checkInterval);
  }
  
  private async processProjections(): Promise<void> {
    // Get all user databases
    // Check for new events
    // Project to read model
    // Update checkpoints
  }
}
```

#### 3. Domain Events

```typescript
// User Events
interface UserRegisteredEvent {
  userId: string;
  email: string;
  timestamp: Date;
}

// Domain Monitoring Events
interface DomainRegisteredEvent {
  domainId: string;
  userId: string;
  domain: string;
  timestamp: Date;
}

interface DomainStatusCheckedEvent {
  domainId: string;
  domain: string;
  status: 'online' | 'offline';
  responseCode?: number;
  responseTimeMs?: number;
  timestamp: Date;
}

interface DomainCheckScheduledEvent {
  domainId: string;
  domain: string;
  scheduledFor: Date;
  timestamp: Date;
}
```

#### 4. API Endpoints

**Authentication APIs**:
- `POST /api/auth/register` - Create account, user database, initial events
- `POST /api/auth/login` - Create session
- `POST /api/auth/logout` - Invalidate session

**Domain Management APIs**:
- `POST /api/domains/register` - Register domain for monitoring
- `GET /api/domains/status` - Get current status (from read model)

**Internal APIs (Secured for background_processor)**:
- `GET /api/internal/tasks` - Get domains pending checks
- `POST /api/internal/status-update` - Update domain status

#### 5. Security Implementation

```typescript
// API Key for background_processor
const API_KEY = process.env.BACKGROUND_PROCESSOR_API_KEY;

// Middleware for internal APIs
export async function validateInternalRequest(req: Request): Promise<boolean> {
  const apiKey = req.headers.get('X-API-Key');
  const signature = req.headers.get('X-Signature');
  
  // Validate API key
  if (apiKey !== API_KEY) return false;
  
  // Validate HMAC signature of request body
  const body = await req.text();
  const expectedSignature = createHmac('sha256', API_KEY)
    .update(body)
    .digest('hex');
    
  return signature === expectedSignature;
}

// User session validation
export async function validateUserSession(token: string): Promise<User | null> {
  // Check session in system database
  // Validate expiry
  // Return user or null
}
```

#### 6. Frontend Implementation

**Dashboard Component**:
```tsx
// src/app/dashboard/page.tsx
export default function Dashboard() {
  const [domains, setDomains] = useState<Domain[]>([]);
  
  // Poll every 1 second for updates
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch('/api/domains/status');
      const data = await response.json();
      setDomains(data.domains);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Domain Status</h1>
      <DomainList domains={domains} />
      <AddDomainForm />
    </div>
  );
}
```

### B. background_processor Application

#### 1. Project Structure
```
background_processor/
├── src/
│   ├── index.ts
│   ├── status-checker.ts
│   ├── api-client.ts
│   └── utils/
├── package.json
└── tsconfig.json
```

#### 2. Main Process Loop

```typescript
// src/index.ts
class BackgroundProcessor {
  private checkInterval = 5000; // Check for tasks every 5 seconds
  private apiClient: ApiClient;
  
  async start(): Promise<void> {
    console.log('Background processor started');
    
    while (true) {
      try {
        await this.processPendingChecks();
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
      
      await this.sleep(this.checkInterval);
    }
  }
  
  private async processPendingChecks(): Promise<void> {
    // Get pending tasks from nextjs_statusnest
    const tasks = await this.apiClient.getPendingTasks();
    
    // Process each task asynchronously
    const promises = tasks.map(task => this.checkDomainStatus(task));
    await Promise.allSettled(promises);
  }
  
  private async checkDomainStatus(task: Task): Promise<void> {
    assert(task.domain, "Domain is required");
    assert(task.domainId, "Domain ID is required");
    
    const startTime = Date.now();
    let status: 'online' | 'offline' = 'offline';
    let responseCode: number | undefined;
    
    try {
      const response = await fetch(`http://${task.domain}`, {
        method: 'GET',
        timeout: 10000, // 10 second timeout
        redirect: 'follow'
      });
      
      responseCode = response.status;
      status = response.ok ? 'online' : 'offline';
    } catch (error) {
      // Domain is offline or unreachable
      status = 'offline';
    }
    
    const responseTimeMs = Date.now() - startTime;
    
    // Report back to nextjs_statusnest
    await this.apiClient.updateDomainStatus({
      domainId: task.domainId,
      domain: task.domain,
      status,
      responseCode,
      responseTimeMs,
      checkedAt: new Date()
    });
  }
}
```

#### 3. Secure API Client

```typescript
// src/api-client.ts
class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.STATUSNEST_API_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_KEY!;
    
    assert(this.apiKey, "API_KEY environment variable is required");
  }
  
  private createSignature(body: string): string {
    return createHmac('sha256', this.apiKey)
      .update(body)
      .digest('hex');
  }
  
  async getPendingTasks(): Promise<Task[]> {
    const response = await fetch(`${this.baseUrl}/api/internal/tasks`, {
      headers: {
        'X-API-Key': this.apiKey,
        'X-Signature': this.createSignature('')
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get tasks: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async updateDomainStatus(update: StatusUpdate): Promise<void> {
    const body = JSON.stringify(update);
    const response = await fetch(`${this.baseUrl}/api/internal/status-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Signature': this.createSignature(body)
      },
      body
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.statusText}`);
    }
  }
}
```

## Event Flow Examples

### User Registration Flow
1. User submits registration form
2. System validates input
3. System creates user in system database
4. System creates new user write model database
5. System writes `UserRegisteredEvent` to user's event store
6. System creates session
7. Projection engine picks up event and updates read model

### Domain Registration Flow
1. User submits domain to monitor
2. System validates domain format and user session
3. System writes `DomainRegisteredEvent` to user's event store
4. System writes `DomainCheckScheduledEvent` with immediate timestamp
5. Projection engine updates read model with new domain (status: unknown)
6. UI polling shows new domain with "unknown" status

### Domain Check Flow
1. Background processor queries for pending checks
2. System queries read model for domains where `next_check_at <= now`
3. Background processor initiates HTTP GET request
4. Background processor receives response (or timeout)
5. Background processor calls status update API
6. System writes `DomainStatusCheckedEvent` to relevant user databases
7. System writes `DomainCheckScheduledEvent` for next check (current + 5 minutes)
8. Projection engine updates read model
9. UI polling shows updated status

## Security Considerations

### Authentication & Authorization
- Bcrypt for password hashing (min 10 rounds)
- Secure session tokens (cryptographically random)
- Session expiry (24 hours default)
- HTTPS only in production

### API Security
- HMAC signatures for internal API calls
- Rate limiting on public endpoints
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

### Data Isolation
- Each user has separate write model database
- File system permissions restrict database access
- User can only query their own data via read model

### Environment Variables
```env
# nextjs_statusnest/.env.local
DATABASE_PATH=./data
SESSION_SECRET=<random-32-char-string>
BACKGROUND_PROCESSOR_API_KEY=<random-32-char-string>

# background_processor/.env
STATUSNEST_API_URL=http://localhost:3000
API_KEY=<same-as-BACKGROUND_PROCESSOR_API_KEY>
```

## Dependencies

### nextjs_statusnest
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "better-sqlite3": "^9.0.0",
    "bcrypt": "^5.1.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/bcrypt": "^5.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### background_processor
```json
{
  "dependencies": {
    "node-fetch": "^3.3.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

## Implementation Priorities (MVP)

### Phase 1: Core Infrastructure
1. Set up Next.js project with TypeScript
2. Implement SQLite database layer
3. Create basic CQRS event store
4. Implement user authentication

### Phase 2: Domain Logic
1. Domain registration commands
2. Event projections to read model
3. Basic UI with Tailwind

### Phase 3: Background Processing
1. Set up background_processor
2. Implement secure API communication
3. Domain status checking logic

### Phase 4: Complete Integration
1. Full event flow testing
2. UI real-time updates
3. Error handling and logging

## Testing Strategy

### Unit Tests
- Event store operations
- Command handlers
- Projection logic
- Domain validation

### Integration Tests
- End-to-end event flows
- API endpoint security
- Database operations

### System Tests
- Multi-user scenarios
- Background processor reliability
- Projection consistency

## Monitoring & Logging

### Application Logs
- Event processing
- API requests
- Background processor activities
- Error tracking

### Metrics to Track
- Domain check success/failure rates
- Response times
- Projection lag
- System resource usage

## Error Handling

### Pre-condition Assertions
```typescript
function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}
```

### Graceful Degradation
- Continue processing other domains if one fails
- Retry failed checks with exponential backoff
- Log errors without crashing the system

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields
- Connection pooling for SQLite
- Batch event processing

### Polling Optimization
- Client-side caching
- Conditional updates (only if changed)
- WebSocket consideration for future

## Future Enhancements (Post-MVP)

1. Multiple check intervals (not just 5 minutes)
2. Email/SMS notifications
3. Historical status graphs
4. Custom HTTP headers for checks
5. Multiple check locations
6. WebSocket for real-time updates
7. Domain SSL certificate monitoring
8. Response time SLA monitoring