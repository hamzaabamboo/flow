# Tech Stack & Architecture

## 🏗️ Project Overview

**HamFlow** is a personalized productivity hub SPA (Single Page Application) built for speed and developer experience.

## 🎯 Core Technologies

### Frontend
- **React 19**: Latest React with concurrent features
- **Vike**: File-based routing and SSR framework
- **PandaCSS**: Zero-runtime CSS-in-JS styling
- **Park UI**: Pre-built accessible components
- **Ark UI**: Headless UI primitives
- **React Query (Tanstack Query)**: Server state management

### Backend
- **ElysiaJS**: Fast, type-safe API framework
- **Bun**: JavaScript runtime and toolkit
- **Drizzle ORM**: Type-safe database toolkit
- **PostgreSQL**: Primary database
- **WebSockets**: Real-time communication

### Development Tools
- **TypeScript**: End-to-end type safety
- **Vite**: Build tool and dev server
- **Biome**: Fast linter and formatter
- **pnpm/bun**: Package management

## 🔗 External Documentation

### Core Frameworks
- **ElysiaJS**: https://elysiajs.com/llms-full.txt
- **Drizzle ORM**: https://orm.drizzle.team/llms-full.txt
- **PandaCSS**: https://panda-css.com/llms-full.txt
- **Vike**: https://vike.dev/

### UI Libraries
- **Park UI**: https://park-ui.com/
- **Ark UI**: https://ark-ui.com/llms-react.txt
- **React Query**: https://tanstack.com/query/latest

### Runtime & Tools
- **Bun**: https://bun.sh/docs
- **PostgreSQL**: https://www.postgresql.org/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

## 🏛️ Architecture Patterns

### API Design
- RESTful endpoints with ElysiaJS
- Type-safe contracts with Eden Treaty
- WebSocket support for real-time features
- JWT-based authentication

### State Management
- Server state: React Query
- Client state: React Context + hooks
- Form state: React Hook Form
- Global auth: ElysiaJS context propagation

### Database Strategy
- Drizzle ORM for type safety
- PostgreSQL for ACID compliance
- Migrations in `drizzle/` directory
- Connection pooling via Drizzle

### Styling Approach
- PandaCSS for zero-runtime styles
- Park UI for consistent components
- Design tokens for theming
- Responsive-first design

## 🔄 Data Flow

```
User Action → React Component → React Query → Eden Treaty → ElysiaJS API
                                                  ↓
Browser ← React Re-render ← React Query Cache ← Database (PostgreSQL)
```

## 🚀 Performance Optimizations

1. **SSR with Vike**: Initial page loads are server-rendered
2. **Bun Runtime**: Faster than Node.js for server operations
3. **React 19**: Concurrent features and automatic batching
4. **PandaCSS**: Zero runtime overhead for styles
5. **Edge Caching**: Static assets served from CDN
6. **Database Indexing**: Optimized queries with proper indices

## 🔒 Security Measures

1. **JWT Authentication**: Secure token-based auth
2. **CORS Configuration**: Proper origin validation
3. **Input Validation**: Zod schemas for all inputs
4. **SQL Injection Prevention**: Parameterized queries via Drizzle
5. **XSS Protection**: React's automatic escaping
6. **HTTPS Only**: Enforced in production

## 📦 Key Dependencies

```json
{
  "frontend": {
    "react": "^19.0.0",
    "vike": "^0.4.0",
    "@tanstack/react-query": "^5.0.0",
    "@ark-ui/react": "^4.0.0"
  },
  "backend": {
    "elysia": "^1.0.0",
    "drizzle-orm": "^0.30.0",
    "@elysiajs/jwt": "^1.0.0",
    "@elysiajs/cors": "^1.0.0"
  },
  "development": {
    "typescript": "^5.5.0",
    "vite": "^5.0.0",
    "@biomejs/biome": "^1.0.0"
  }
}
```

---

# 🏗️ Architecture Deep Dive

## 1. Real-Time Update Strategy

### WebSocket Authentication Architecture

**Challenge**: WebSocket connections require JavaScript-accessible tokens, but httpOnly cookies (our primary auth mechanism) cannot be read by client-side JavaScript.

**Solution - Dual-Cookie Pattern**:

```typescript
// src/server/auth/withAuth.ts
cookie.ws_token.set({
  value: token,
  httpOnly: false,  // Allow JavaScript access for WebSocket
  secure: false,     // Use true in production
  sameSite: 'lax',
  maxAge: 30 * 86400,
  path: '/'
});

// Keep main auth cookie secure
cookie.auth.set({
  value: token,
  httpOnly: true,   // Protect from XSS
  secure: true,
  sameSite: 'lax',
  maxAge: 30 * 86400,
  path: '/'
});
```

**Client-Side Integration**:
```typescript
// src/hooks/useWebSocket.ts
const token = getCookie('ws_token');
const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
```

**Authentication Flow**:
1. Client reads `ws_token` cookie (non-httpOnly)
2. Passes as query parameter: `/ws?token=...`
3. Server decodes JWT, extracts `userId`
4. Subscribes connection to `user:${userId}` channel
5. Broadcasts reach only authenticated users on their specific channel

**Security Considerations**:
- Main `auth` cookie remains httpOnly for API security
- Separate `ws_token` only for WebSocket authentication
- Both tokens contain same JWT payload
- XSS can only steal WebSocket access, not API access

### Cross-Tab Synchronization with Calculation-Based Timers

**Problem**: Multiple browser tabs showed timer drift (42 seconds apart) when each tab ran independent countdown timers.

**Failed Approach - Countdown Method**:
```typescript
// ❌ Each tab independently counts down - causes drift
setInterval(() => {
  setLocalTimeLeft(prev => prev - 1);
}, 1000);
```

**Solution - Calculation-Based Method**:
```typescript
// ✅ Use server startTime as authoritative reference
interface ActivePomodoroState {
  timeLeft: number;        // Initial duration
  startTime?: string;      // ISO timestamp when timer started
}

// Timer calculation loop (in useEffect)
if (serverState.startTime) {
  const tick = () => {
    const startTime = new Date(serverState.startTime!).getTime();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const newTimeLeft = Math.max(0, serverState.timeLeft - elapsed);

    setLocalTimeLeft(newTimeLeft);
    intervalRef.current = setTimeout(tick, 1000);
  };
  tick();

  return () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
  };
}
```

**Benefits**:
- All tabs calculate from same `startTime` reference
- Perfect synchronization regardless of when tab was opened
- No drift accumulation over time
- Tolerant to network delays
- Only sync on state changes (start/pause/complete), not every second

**Performance**: 1-second intervals are sufficient. 100ms updates cause unnecessary re-renders.

### React Query + WebSocket Integration

**Pattern**: Use both systems for their strengths, not as replacements.

```typescript
// After WebSocket message received
switch (message.type) {
  case 'task_created':
    queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
    break;
  case 'reminder':
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    if (globalToast) {
      globalToast(`⏰ ${message.data.message}`, { type: 'info' });
    }
    break;
}
```

**Division of Responsibilities**:
- **WebSocket**: Notify of changes, cross-tab sync events
- **React Query**: Fetch data, manage cache, optimistic updates
- **Always invalidate on WebSocket events**: Ensures UI updates even if message missed

**Query Key Design**:
```typescript
// ❌ WRONG - Date objects cause shallow comparison issues
queryKey: ['habits', selectedDate, currentSpace]

// ✅ CORRECT - Stable string representation
queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), currentSpace]
```

**Key Insight**: React Query's shallow comparison doesn't recognize Date object changes. Always format dates to stable strings in queryKey.

### Global Toast Pattern for WebSocket Notifications

```typescript
// In useWebSocket.ts
let globalToast: ((message: string, options?) => void) | null = null;
export function setGlobalToast(toast) { globalToast = toast; }

// In ToasterProvider component
setGlobalToast((message, options) => {
  toaster.create({ description: message, ...options });
});

// In WebSocket message handler
case 'reminder':
  if (globalToast && data?.message) {
    globalToast(`⏰ ${data.message}`, { type: 'info' });
  }
  break;
```

**Why**: Browser notifications require permission and might be missed. In-app toasts are more reliable and user-friendly.

---

## 2. Database Design Philosophy

### Schema-Migration Sync is CRITICAL

**Production Incident**: Added `link` field to development schema but never applied migration to production. Code queried non-existent column, causing 500 errors.

**Lessons Learned**:
1. **NEVER add fields to schema without migration** - Schema and database must stay in sync
2. **Development ≠ Production** - Local schema changes don't automatically apply to production
3. **Deployment Checklist**: Always verify migrations are applied before deploying code that depends on new fields

**Migration Workflow**:
```bash
bun run db:generate  # Create migration from schema changes
bun run db:push      # Apply migrations to database
```

### JSONB vs Foreign Keys Decision Matrix

**Use JSONB for**:
- Simple arrays (labels, tags)
- Embedded objects that don't need querying
- Metadata that changes shape frequently

```typescript
// Habits metadata - JSONB
export const habits = pgTable('habits', {
  metadata: jsonb('metadata').$type<{
    category?: string;
    color?: string;
    icon?: string;
  }>()
});

// Labels on tasks - JSONB array
labels: text('labels').array().default([])
```

**Use Foreign Keys for**:
- Relationships that need querying
- Data with referential integrity requirements
- One-to-many or many-to-many relations

```typescript
// Subtasks - Foreign key relation
export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  completed: boolean('completed').default(false).notNull()
});
```

### Drizzle ORM Patterns

**Update Pattern for Relations**:
```typescript
// Relations require delete + insert, not direct update
await db.delete(subtasks).where(eq(subtasks.taskId, id));
await db.insert(subtasks).values(newSubtasks.map(st => ({
  taskId: id,
  title: st.title,
  completed: st.completed
})));
```

**Why**: Drizzle doesn't support updating array of relations in place. Must replace entire set.

**Self-Referencing Foreign Keys**:
```typescript
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id),
});
```

**Key**: Use `(): AnyPgColumn` return type to satisfy TypeScript circular reference.

**JSONB Field Selection**:
```typescript
// ❌ WRONG - Loses JSONB fields in type inference
const habits = await db.select({ id: habitsTable.id })
  .from(habitsTable);

// ✅ CORRECT - Preserves all fields including JSONB
const habits = await db.select()
  .from(habitsTable)
  .where(eq(habitsTable.userId, userId));
```

### API Token Security Design

**Pattern**: Store hashed tokens, return raw token only once on creation.

```typescript
export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  token: text('token').notNull().unique(),  // SHA-256 hashed
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
```

**Key Features**:
- Cascade delete when user deleted
- Track last usage for security monitoring
- Optional expiration for temporary access
- Unique constraint on hashed token
- Raw token never stored or retrievable

### Server-Side Expansion Pattern

**Philosophy**: Keep data normalized in database, expand relationships on read as needed.

```typescript
// Client requests expanded data
const url = `/api/habits?date=${format(date, 'yyyy-MM-dd')}&expand=links`;

// Server expands on demand
.get('/', async ({ query, db, user }) => {
  const { expand } = query;

  const habits = await db.select().from(habitsTable);

  if (expand?.includes('links')) {
    // Fetch and attach related data
    for (const habit of habits) {
      habit.relatedTasks = await db.select()
        .from(tasks)
        .where(eq(tasks.habitId, habit.id));
    }
  }

  return habits;
})
```

**Benefits**:
- Database stays normalized
- Flexible API - only expand what's needed
- Better performance - avoid N+1 queries
- Clear API contract via query parameters

---

## 3. API Design Patterns

### ElysiaJS Authentication Middleware

**Critical**: `withAuth` is a function that returns a plugin, must be invoked.

```typescript
// ❌ WRONG - doesn't work, returns 404
export const statsRoutes = new Elysia({ prefix: '/stats' }).use(withAuth);

// ✅ CORRECT - withAuth() returns plugin
export const statsRoutes = new Elysia({ prefix: '/stats' }).use(withAuth());
```

**Context Propagation**:
```typescript
// ✅ CORRECT - Context available in all child routes
.derive({ as: 'global' }, async ({ cookie, jwt, db }) => {
  return { user };
})
```

**Without `as: 'global'`**, derived properties only available in same Elysia instance, not child routers.

### Route Organization - Middleware Order Matters

**Pattern**: Public routes BEFORE `.use(withAuth())`, authenticated routes AFTER.

```typescript
// ✅ CORRECT
export const calendarRoutes = new Elysia({ prefix: '/calendar' })
  .decorate('db', db)

  // Public routes first (no auth required)
  .get('/ical/:userId/:token', async ({ params, db, set }) => {
    // Custom token-based auth inside handler
    const expectedToken = createHash('sha256')
      .update(`${userId}-${process.env.CALENDAR_SECRET}`)
      .digest('hex');
    if (token !== expectedToken) {
      set.status = 401;
      return 'Unauthorized';
    }
    return generateICal();
  })

  // Apply auth middleware AFTER public routes
  .use(withAuth())

  // Authenticated routes
  .get('/feed-url', ({ user }) => { /* ... */ })
  .get('/events', async ({ query, db, user }) => { /* ... */ });
```

**Key Principle**: Middleware applied with `.use()` affects all routes defined **AFTER** it. Public routes must come before `.use(withAuth())`.

### Multi-Auth Pattern: Bearer Tokens + JWT Cookies

**Single middleware handles both API tokens and browser sessions**:

```typescript
// src/server/auth/withAuth.ts
export const withAuth = () => new Elysia()
  .derive({ as: 'global' }, async ({ request, cookie, jwt, db }) => {

    // 1. Check for Bearer token (API clients, Raycast)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const rawToken = authHeader.substring(7);
      const hashedToken = await hashToken(rawToken);

      const [apiToken] = await db.select()
        .from(apiTokens)
        .where(eq(apiTokens.token, hashedToken));

      if (apiToken && (!apiToken.expiresAt || apiToken.expiresAt > new Date())) {
        // Update last used timestamp
        await db.update(apiTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiTokens.id, apiToken.id));

        const [user] = await db.select().from(users)
          .where(eq(users.id, apiToken.userId));

        return { user };
      }
    }

    // 2. Fall back to JWT cookie authentication
    const token = cookie.auth.value;
    if (!token) throw new Error('Unauthorized');

    const payload = await jwt.verify(token);
    // ... verify and return user
  });
```

**Why This Pattern**:
- External integrations (Raycast) use Bearer tokens
- Browser sessions use httpOnly cookies (more secure)
- Single auth middleware handles both
- Automatic tracking of API token usage

### Modular Route Architecture

**Before**: 1269-line apiRoutes.ts file
**After**: 10 separate route files ~150-200 lines each

```typescript
// src/server/routes/tasks.ts
export const tasksRoutes = new Elysia({ prefix: '/tasks' })
  .use(withAuth())
  .get('/', handler)
  .post('/', handler)
  .patch('/:id', handler)
  .delete('/:id', handler);

// src/server/index.ts
import { tasksRoutes } from './routes/tasks';
import { habitsRoutes } from './routes/habits';

const app = new Elysia()
  .use(tasksRoutes)
  .use(habitsRoutes);
```

**Benefits**:
- Each route file ~150-200 lines (maintainable)
- Related endpoints grouped together
- Easy to find and modify specific features
- Better code organization and imports

### Optional Field Validation Pattern

**Problem**: Duplicating tasks sent `null` for optional fields, but Zod schema expected `string | undefined`.

**Solution**: Conditionally build payload to omit undefined fields.

```typescript
const payload: Record<string, unknown> = {
  columnId: task.columnId,
  title: `${task.title} (Copy)`,
  labels: task.labels || []
};

// Only add optional fields if they have values
if (task.description) payload.description = task.description;
if (task.priority) payload.priority = task.priority;
if (task.dueDate) payload.dueDate = task.dueDate;

const response = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify(payload)
});
```

**Key Insight**: When working with optional fields, prefer **omitting the field entirely** over sending `null`, especially with Zod schemas that expect `string | undefined` rather than `string | null`.

### API Token Creation Flow

**Security Best Practice**: Return raw token only once, store hashed version.

```typescript
// src/server/routes/api-tokens.ts
.post('/', async ({ body, db, user }) => {
  const rawToken = generateApiToken(); // 64 hex characters
  const hashedToken = await hashToken(rawToken); // SHA-256

  const [newToken] = await db.insert(apiTokens).values({
    userId: user.id,
    name: body.name,
    token: hashedToken,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
  }).returning();

  // Return raw token ONLY ONCE - can't be retrieved again
  return { ...newToken, token: rawToken };
})
```

**Why**: Raw tokens never stored. Users must save token immediately - cannot retrieve later (like GitHub tokens).

### Elysia Redirect Pattern

**Problem**: `set.redirect = url` doesn't work in Elysia.

**Solution**: Use explicit status code and Location header.

```typescript
set.status = 302;
set.headers['Location'] = authUrl;
return;
```

### OIDC/OAuth Integration

**Keycloak Path Structure**:
```typescript
const authUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/auth`;
const tokenUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/token`;
const userInfoUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/userinfo`;
const logoutUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/logout`;
```

**Important**: Keycloak uses `/protocol/openid-connect/*` paths. Different OIDC providers have different path structures.

---

## 4. Performance & Memory Management

### AudioContext Memory Leak Prevention

**Critical Bug**: Creating new AudioContext on every sound play caused memory leak (~5-10MB per hour).

**Solution - Singleton Pattern**:

```typescript
// ✅ Reuse singleton instance
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('AudioContext not supported');
        return null;
      }
      audioContext = new AudioContextClass();
    }

    // Resume if suspended (required on mobile)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch((err) =>
        console.error('Failed to resume:', err)
      );
    }

    return audioContext;
  } catch (error) {
    console.error('Failed to create AudioContext:', error);
    return null;
  }
}
```

**Key Points**:
- Single AudioContext reused across all sound plays
- Graceful fallback if not supported (mobile compatibility)
- Auto-resume for mobile (contexts start suspended)
- Proper error handling prevents "illegal constructor" crashes

### useEffect Infinite Loop Prevention

**Problem**: Mutation in useEffect dependencies caused infinite re-renders.

```typescript
// ❌ INFINITE LOOP - Mutation is new object on every render
useEffect(() => {
  updateStateMutation.mutate(/* ... */);
}, [serverState, localTimeLeft, handleComplete, updateStateMutation]);
```

**Solution - Use Ref Pattern**:
```typescript
// ✅ Stable reference with ref
const updateStateMutationRef = useRef(updateStateMutation);
useEffect(() => {
  updateStateMutationRef.current = updateStateMutation;
}, [updateStateMutation]);

useEffect(() => {
  // Use .current to access latest mutation
  updateStateMutationRef.current.mutate(/* ... */);
}, [serverState, localTimeLeft, handleComplete]); // No mutation in deps
```

**Principle**: React Query mutations are new objects on every render. Use refs to maintain stable references.

### Timer Interval Performance

**Update Frequency**:
- ✅ 1000ms (1 second) - Sufficient for countdown displays
- ❌ 100ms - Causes unnecessary re-renders and performance issues

**Pattern - setTimeout over setInterval**:
```typescript
// Calculation-based timer with 1-second intervals
const tick = () => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const newTimeLeft = Math.max(0, initialTime - elapsed);
  setLocalTimeLeft(newTimeLeft);

  // Schedule next tick in 1 second
  intervalRef.current = setTimeout(tick, 1000);
};
```

**Why setTimeout**: Easier to clean up, prevents overlap if processing takes longer than interval.

**Cleanup Pattern**:
```typescript
useEffect(() => {
  if (!serverState.startTime) return;

  const tick = () => {
    // ... calculation
    intervalRef.current = setTimeout(tick, 1000);
  };
  tick();

  // Cleanup on unmount or dependency change
  return () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
  };
}, [serverState]);
```

### React Query Refetch Strategy

**Optimization - No Polling with WebSocket**:

```typescript
// ❌ EXCESSIVE - Polling every 5 seconds
useQuery({
  queryKey: ['pomodoro'],
  refetchInterval: 5000  // Unnecessary with WebSocket
});

// ✅ OPTIMIZED - Only refetch on focus/mount
useQuery({
  queryKey: ['pomodoro'],
  // No refetchInterval
  // WebSocket handles real-time updates
  // React Query handles focus/mount refetch
});
```

**Pattern**:
1. Use local timer for UI countdown
2. WebSocket for state changes (start/pause/complete)
3. React Query invalidation only on WebSocket events
4. No polling needed

### Avoiding Experimental React APIs

**Problem**: Used `useEffectEvent` (experimental) which can cause issues in production builds.

```typescript
// ❌ EXPERIMENTAL API (UNSTABLE!)
import { useEffectEvent } from 'react';
const handleEvent = useEffectEvent(/* ... */);

// ✅ STABLE - Use refs instead
const handleEventRef = useRef(handleEvent);
useEffect(() => {
  handleEventRef.current = handleEvent;
}, [handleEvent]);
```

**Why**: Experimental APIs can break in production builds, cause compatibility issues, and may change before stabilization.

### Testing for Memory Leaks

**Process**:
1. Open Chrome DevTools → Performance
2. Start recording, use feature for ~5 minutes
3. Take heap snapshot before and after
4. Compare memory usage - should not grow continuously
5. Check for detached DOM nodes and retained objects

---

## 🎯 Summary of Key Architectural Decisions

### Real-Time Strategy
- **Dual-cookie pattern** for WebSocket auth (httpOnly for API, non-httpOnly for WS)
- **Calculation-based timers** with server startTime for perfect multi-tab sync
- **WebSocket + React Query** working together (not replacing each other)
- Always invalidate queries even with WebSocket (redundancy is good)

### Database Design
- **JSONB for simple data** (labels, metadata), **foreign keys for relationships** (subtasks)
- Schema-migration sync is critical - never deploy without migrating
- Store normalized, expand on read (server-side expansion pattern)
- Track API token usage with `lastUsedAt` for security monitoring

### API Patterns
- **Multi-auth middleware** (Bearer tokens + JWT cookies in single handler)
- **Route order matters** in Elysia (public before `.use(withAuth())`)
- **Omit undefined fields** in payloads instead of sending `null`
- **Modular routes** (~150-200 lines per file) for maintainability

### Performance
- **Singleton pattern** for AudioContext prevents memory leaks
- **Refs for stable references** to mutations in useEffect dependencies
- **1-second timer intervals** sufficient, 100ms causes unnecessary renders
- **Avoid experimental APIs** - stick to stable React patterns
- **No polling when WebSocket available** - use invalidation on events only