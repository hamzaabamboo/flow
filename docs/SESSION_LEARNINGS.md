# SESSION LEARNINGS

> **IMPORTANT**: Add new learnings after each development session. This helps prevent repeating mistakes and builds institutional knowledge.

## 2025-10-01 - Major Refactoring Session

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