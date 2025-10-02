# SESSION LEARNINGS

> **IMPORTANT**: Add new learnings after each development session. This helps prevent repeating mistakes and builds institutional knowledge.

## 2025-10-02 - Habit Links & UI Improvements

### Features Implemented
- **Habit Links**: Added link support to habits (similar to tasks)
  - Database: Added `metadata` JSONB field to habits table
  - API: Updated all habit endpoints (GET, POST, PATCH) to handle links
  - UI: Added link input in habit form, display with ExternalLink icon in cards/agenda

### UX Improvements
- **Dialog Animations**: Fixed TaskDialog flash on close by delaying state reset (200ms)
  - Applied to agenda, tasks, kanban board, and all boards pages
- **Countdown Timer**: Hide countdown for completed tasks or tasks in "Done" column
  - Applied to KanbanColumn and TaskItem components
- **Task Sorting**: Completed tasks now move to bottom in tasks page
- **Habit Checkboxes**: Use Checkbox component's built-in label support for accessibility
- **Clickable Habits**: Made entire habit card clickable in agenda day view sidebar

### Technical Notes
- Checkbox component accepts children for labels - no need for separate label elements
- Dialog animation delay prevents flash of reset state when closing dialogs
- Always check `column.name.toLowerCase() === 'done'` when hiding UI for done tasks

## 2025-10-02 - Timezone Handling Fix

### The Problem: Timezone Inconsistency

**User Feedback**:
- "this cutting timezone ain't it lah, when i updated a task it goes back 7 hr for some fucking reason, PICK ONE AND STICK WITH IT"
- "EVERYTHING IS NOT IN THEIR RIGHT COLUMN LAH"
- "WHEN I OPEN THE TASK DIALOG ON 27 IT SHOWS UP AT 28 2:00"
- "I WANT EVERYTHING ON THE SCREEN TO BE IN LOCAL TIMEZONE AND EVERYTHING BEHIND THE SCENES TO BE IN UTC"
- "EVERYTHING PASSED TO THE SERVER MUST BE IN UNIX IN UTC"

**Root Cause**: Three separate issues causing timezone chaos:
1. Frontend was using `instanceDate` (UTC format) to group tasks by day
2. TaskDialog was not consistently converting between UTC and local
3. Mixed date format handling throughout the codebase

### The Solution: UTC Backend, Local Frontend

**Core Principle**: Server stores UTC, display shows local time, proper conversion both ways.

#### 1. TaskDialog Display (TaskDialog.tsx:484-500)
```typescript
// Convert UTC from server to local for datetime-local input
defaultValue={
  task?.dueDate
    ? (() => {
        // Server sends UTC ISO string, convert to local for display
        const date = new Date(task.dueDate);
        if (isNaN(date.getTime())) return '';
        // Use local timezone methods to format for datetime-local input
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      })()
    : ''
}
```

**Key**: `new Date()` constructor automatically converts UTC to local timezone. Extract components with local methods.

#### 2. TaskDialog Submission (TaskDialog.tsx:147-221)
```typescript
// Convert datetime-local to UTC ISO string before submitting
const dueDateInput = form.querySelector('input[name="dueDate"]') as HTMLInputElement;
if (dueDateInput && dueDateInput.value) {
  // datetime-local value is in local timezone (YYYY-MM-DDTHH:mm)
  const localDate = new Date(dueDateInput.value);
  const utcISOString = localDate.toISOString(); // Convert to UTC

  // Replace with hidden input containing UTC
  const utcInput = document.createElement('input');
  utcInput.type = 'hidden';
  utcInput.name = 'dueDate';
  utcInput.value = utcISOString;
  form.appendChild(utcInput);
}
```

**Key**: `datetime-local` input interprets its value as local time. Use `.toISOString()` to convert to UTC.

#### 3. Agenda Page Submission (+Page.tsx:201-212)
```typescript
if (data.dueDate) {
  const dateStr = data.dueDate as string;
  // If already UTC ISO string (from TaskDialog), keep it
  if (dateStr.includes('Z')) {
    taskData.dueDate = dateStr;
  } else {
    // datetime-local format: YYYY-MM-DDTHH:mm - convert to UTC
    const localDate = new Date(dateStr);
    taskData.dueDate = localDate.toISOString();
  }
}
```

#### 4. Event Grouping Fix (+Page.tsx:272-288)
**The Critical Fix**: Stop using `instanceDate` for display grouping
```typescript
// Group events by LOCAL date, not UTC instanceDate
events?.forEach((event) => {
  // Always use dueDate converted to local timezone for grouping
  // instanceDate is in UTC format and causes timezone issues
  if (!event.dueDate) return;

  // Parse the UTC date and extract local date for grouping
  const eventDate = new Date(event.dueDate);
  const year = eventDate.getFullYear();
  const month = String(eventDate.getMonth() + 1).padStart(2, '0');
  const day = String(eventDate.getDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  if (grouped[dateKey]) {
    grouped[dateKey].push(event);
  }
});
```

**Why This Matters**:
- `instanceDate` is set server-side using `.toISOString().split('T')[0]` which extracts UTC date
- A task at `2025-09-27T17:00:00.000Z` (UTC) is actually `2025-09-28T02:00` in JST (+9)
- Old code: Grouped by `instanceDate: "2025-09-27"` → appeared on Saturday
- New code: Grouped by local date `"2025-09-28"` → appears on Sunday (correct!)

### The instanceDate Dilemma

**What is instanceDate?**
- Used for tracking specific instances of recurring tasks
- Stored as UTC date string (YYYY-MM-DD) in `recurring.ts:77,84,102`
- Purpose: Completion tracking for recurring tasks

**Why Not Fix It Server-Side?**
- `instanceDate` is for **backend logic** (tracking which instance was completed)
- Display grouping should use **local timezone** (what user sees)
- Separation of concerns: backend tracking vs frontend display

### Key Learnings

1. **Date Object Behavior**:
   - `new Date(utcString)` automatically converts to local timezone
   - `.getFullYear()`, `.getMonth()`, `.getDate()` use LOCAL timezone
   - `.getUTCFullYear()`, etc. use UTC timezone
   - `.toISOString()` converts to UTC and formats as ISO string

2. **datetime-local Input**:
   - Value format: `YYYY-MM-DDTHH:mm` (no timezone)
   - Browser interprets as LOCAL timezone
   - Must convert to UTC before sending to server

3. **instanceDate is Not for Display**:
   - Purpose: Backend tracking of recurring task instances
   - Format: UTC date (YYYY-MM-DD)
   - Display grouping: Must use dueDate converted to local

4. **User Expectation**:
   - Everything visible = local timezone
   - Everything stored = UTC
   - No timezone shifting when editing

### Testing Checklist

- [x] Create task with local time - stores as UTC
- [x] Edit task - displays correct local time
- [x] Save edited task - no time shift
- [x] Recurring tasks appear in correct day columns
- [x] Tasks grouped by local date, not UTC date

**Result**: Clean separation of concerns - UTC for storage, local for display, proper conversion at boundaries.

## 2025-10-01 - OIDC Authentication & Route Guards

### OIDC/OAuth Implementation with Keycloak

**Problem**: Simple cookie-based auth not sufficient for production use.

**User Feedback**:
- "how do it set up oauth lah"
- "where is google from???? I am trying to use my custom auth"
- "why are we not logging out via oidc"

**Solution**: Full OIDC integration with Keycloak
```typescript
// Key endpoints for Keycloak
const authUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/auth`;
const tokenUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/token`;
const userInfoUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/userinfo`;
const logoutUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/logout`;
```

**Important**: Keycloak uses `/protocol/openid-connect/*` paths, not just `/*`.

### Elysia Redirects

**Problem**: `set.redirect = url` doesn't work in Elysia.

**Solution**: Use explicit status code and Location header
```typescript
set.status = 302;
set.headers['Location'] = authUrl;
return;
```

### Vike Route Guards Pattern

**User Guidance**: "have a look at server.ts in renderPage, you can pass in user and stuff that will go into the guard"

**Solution**: Pass user data from renderPage to pageContext
```typescript
// server/index.ts - renderPage handler
.get('/*', async ({ request, cookie, jwt }) => {
  // Verify JWT and get user
  let user = null;
  const token = cookie.auth.value;
  if (token) {
    const payload = await jwt.verify(token);
    if (payload) {
      const [dbUser] = await db.select().from(users)
        .where(eq(users.id, payload.userId));
      if (dbUser) {
        user = { id: dbUser.id, email: dbUser.email, name: dbUser.name };
      }
    }
  }

  const pageContextInit = {
    urlOriginal: request.url,
    user,  // Pass to guards
    headers: Object.fromEntries(request.headers.entries())
  };
  const pageContext = await renderPage(pageContextInit);
});

// pages/+guard.ts
export const guard = (pageContext: PageContext) => {
  const { urlPathname, user } = pageContext;

  if (urlPathname === '/login') return;

  if (!user) {
    throw redirect(`/login?returnUrl=${encodeURIComponent(urlPathname)}`);
  }
};
```

**Key Lesson**: Guards run in server environment and can access data from renderPage context - no need to fetch `/api/auth/me`.

### TypeScript Type Extension for Vike

**Problem**: TypeScript doesn't know about custom pageContext properties.

**Solution**: Extend Vike namespace globally
```typescript
// src/vike.d.ts
declare global {
  namespace Vike {
    interface PageContext {
      user?: {
        id: string;
        email: string;
        name: string;
      } | null;
    }
  }
}

export {};
```

### Timezone-Consistent Date Handling

**Problem**: Habits API not respecting selected date due to timezone issues.

**User Feedback**: "THE RESPONSE IS STILL BASED ON WRONG DATE"

**Root Cause**: Using `new Date()` constructor with string causes UTC interpretation vs local timezone.

**Solution**: Treat dates as calendar dates (year-month-day), not timestamps
```typescript
// Client - use local timezone formatting
const dateStr = format(selectedDate, 'yyyy-MM-dd');

// Server - parse as UTC midnight for consistent database comparisons
const checkDate = new Date(`${query.date}T00:00:00.000Z`);
```

**Key Rule**: Calendar dates should be ISO strings without timezone info, then parsed as UTC midnight server-side for consistency.

### OIDC Logout Flow

**Problem**: Just clearing cookie doesn't end session on auth server.

**Solution**: Redirect to OIDC logout endpoint
```typescript
.post('/api/auth/logout', ({ cookie, set }) => {
  const token = cookie.auth.value;
  cookie.auth.remove();

  const logoutUrl = `${OIDC_CONFIG.issuer}/protocol/openid-connect/logout?${
    new URLSearchParams({
      post_logout_redirect_uri: process.env.FRONTEND_URL || 'http://localhost:3000',
      id_token_hint: token
    })
  }`;

  set.status = 302;
  set.headers['Location'] = logoutUrl;
});
```

Client simplifies to just navigate:
```typescript
const logout = async () => {
  queryClient.clear();
  window.location.href = '/api/auth/logout';
};
```

## 2025-10-01 - Major Refactoring Session (earlier)

### Type System Centralization

**Problem**: Interfaces scattered across component files causing maintenance issues.

**User Feedback**:
- "what about type Task in +Page.tsx???"
- "I WANT ALL interface away from Page"
- "especially if it's tied to database entities"

**Solution**:
```typescript
// Created src/shared/types/ directory with modular files:
- board.ts    // Board, Column interfaces
- task.ts     // Task, Subtask interfaces
- user.ts     // User, AuthUser interfaces
- calendar.ts // CalendarEvent, Habit interfaces
```

**Key Rule**: Props interfaces stay in components, data models move to shared types.

### Recurring Task Completion Bug

**Problem**: Couldn't uncheck tasks in week view - recurring tasks creating duplicates.

**Solution**:
1. Created `task_completions` table with (task_id, date) unique constraint
2. Pass `instanceDate` when toggling recurring tasks
3. Match specific instances using date comparison:

```typescript
const completeTask = (taskId: string, dueDate?: string | Date) => {
  const task = events?.find((e) => {
    if (e.id !== taskId) return false;
    if (dueDate && e.instanceDate) {
      // Match specific recurring instance by date
      const eventDateStr = /* normalize to YYYY-MM-DD */
      const targetDateStr = /* normalize to YYYY-MM-DD */
      return eventDateStr === targetDateStr;
    }
    return true;
  });
```

### Agenda Layout Evolution

**Iteration 1**: Individual cards → "use too much space"
**Iteration 2**: Table layout → "too small"
**Iteration 3**: Grid layout → "use the whole width lah"

**Final Solution**:
```typescript
// Full-width CSS Grid
<Box w="full" px="4" py="4">
  <Grid gridTemplateColumns="repeat(7, 1fr)" gap="2">
```

**Lesson**: UX design requires multiple iterations based on user feedback.

### Chrome DevTools Port Discovery

**Critical Error**: Was using port 5173 (Vite default)
**User Correction**: "where the fuck did you get the idea that it's 5173 it's fucking 3000"
**Lesson**: Always verify actual dev server port from logs or package.json

## 2025-09-30 - Recurring Tasks & Habits

### Recurring Pattern Expansion

**Pattern**: Server-side expansion in API, not database storage
```typescript
// Expand recurring tasks in memory
for (let currentDay = startDate; currentDay <= endDate; ) {
  taskEvents.push({ ...task, instanceDate: new Date(currentDay) });
  // Increment based on pattern
  if (pattern === 'daily') currentDay.setDate(currentDay.getDate() + 1);
  // ...
}
```

### Conditional API Behavior

**Pattern**: Use query parameters to determine API logic
```typescript
// Different behavior with/without date parameter
if (query.date) {
  // Filter for agenda view
  conditions.push(eq(habits.active, true));
} else {
  // Show all for management page
}
```

### Space Filtering Strategy

**Always include space in React Query keys**:
```typescript
queryKey: ['habits', selectedDate, currentSpace]
// Pass to API
`/api/habits?date=${date}&space=${currentSpace}`
```

### Visual State vs Text Labels

**User Feedback**: "no need disabled badge"
**Solution**: Use opacity and color changes instead of text labels
```typescript
opacity={disabled ? 0.5 : 1}
color={disabled ? 'fg.subtle' : 'fg.default'}
```

## 2025-09-29 - Route Organization

### Modular Route Architecture

**Before**: 1269-line apiRoutes.ts file
**After**: 10 separate route files ~150-200 lines each

**Pattern**:
```typescript
// Each route file
export const tasksRoutes = new Elysia({ prefix: '/tasks' })
  .use(withAuth())
  .get('/', handler)
```

### ElysiaJS Context Propagation Fix

**Problem**: Auth context not propagating to child instances
**Solution**: Use `{ as: 'global' }` scope
```typescript
.derive({ as: 'global' }, async ({ cookie, jwt, db }) => {
  return { user };
})
```

### Subtasks Foreign Key Pattern

**Important**: Subtasks are relations, not JSONB
```typescript
// Update requires delete + insert
await db.delete(subtasks).where(eq(subtasks.taskId, id));
await db.insert(subtasks).values(newSubtasks);
```

## Common Pitfalls & Solutions

### Park-UI Component Props

| Component | Wrong | Correct |
|-----------|-------|---------|
| TaskDialog | `isOpen` | `open` |
| Badge | `size="xs"` | `size="sm"` |
| Dialog | Basic import | Styled import |

### TypeScript Errors

**Self-referencing foreign keys**:
```typescript
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
parentTaskId: uuid('parent_task_id')
  .references((): AnyPgColumn => tasks.id)
```

### Logger Usage

```typescript
// ✅ CORRECT - Error object first
logger.error(error, 'Message');

// ❌ WRONG
logger.error('Message', error);
```

## Performance Discoveries

### Drizzle ORM JSONB Fields

**Problem**: `.select({ field: table.field })` loses JSONB fields
**Solution**: Use `.select()` without parameters, then map

### React Query Patterns

- Always use `useMutation` for writes
- Include all relevant data in queryKey
- Use onSuccess for cache invalidation
- **`queryKey` and `Date` Objects Issue**:
  - **Problem**: When using `Date` objects directly in `queryKey` (e.g., `['habits', selectedDate, currentSpace]`), `react-query`'s shallow comparison might not trigger a refetch even if the `selectedDate` object instance changes but represents the same date value. This can lead to stale data being displayed in the UI.
  - **Observed Behavior**: After a successful `POST` to update a habit's completion status for a specific date, the subsequent `GET` request for habits sometimes fetches data for an *incorrect or stale date*, even though `invalidateQueries` was called with the correct date from the mutation variables.
  - **Potential Solution/Investigation**: Consider formatting `Date` objects into a stable string representation (e.g., `format(selectedDate, 'yyyy-MM-dd')`) when used in `queryKey` to ensure `react-query` correctly identifies changes and triggers refetches.

### Event Propagation

```typescript
// Prevent checkbox clicks from opening modals
onClick={(e) => e.stopPropagation()}
```

## Architecture Insights

### Database Design
- One-to-many for recurring tasks (task → completions)
- JSONB for simple arrays (labels, tags)
- Foreign keys for relationships (subtasks)

### Real-time Updates
- WebSocket for entity changes
- React Query for cache management
- Optimistic updates for better UX

### Build Pipeline
- PandaCSS codegen → Nodemon → Vite
- HMR with 320ms CSS extraction
- TypeScript strict mode enabled

---

## Quick Reference

### Commands That Work
```bash
bun run dev          # Port 3000
bunx tsc --noEmit    # Type checking
bun run lint:fix     # Fix all issues
bun run db:push      # Apply migrations
```

### File Size Limits
- Components: Max 400 lines
- Route files: ~150-200 lines ideal
- Split when approaching limits

### Testing Checklist
- [ ] Chrome DevTools on port 3000
- [ ] Check Network tab for API calls
- [ ] Verify WebSocket connections
- [ ] Test in both Work/Personal spaces
- [ ] Check responsive design

---

**Remember**: Document new learnings immediately while context is fresh!