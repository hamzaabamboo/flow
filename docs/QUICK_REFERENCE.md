# Quick Reference Guide

## 🔥 Critical Reminders

1. **Port is 3000**: Dev server runs on `http://localhost:3000` NOT 5173!
2. **No 'any' Types**: Always use proper TypeScript types
3. **Props Stay, Models Move**: Component props in files, data models in shared/types
4. **Use Styled Components**: Import from `ui/styled/` not `ui/` for complex components
5. **Global Auth Context**: Use `{ as: 'global' }` in derive for auth propagation
6. **Logger Error First**: `logger.error(error, 'message')` not the reverse
7. **Invalidate Queries**: Always `queryClient.invalidateQueries()` after mutations
8. **Mastra Structured Output**: Use `generate` with `structuredOutputs: true`
9. **Timezone Utilities**: Always use `src/shared/utils/timezone.ts` for JST ↔ UTC conversions
10. **UTC Storage**: Store dates in UTC, convert to JST only for display

## 🚀 Common Commands

### Development

```bash
# Start development (PORT 3000, NOT 5173!)
bun run dev

# Check types
bunx tsc --noEmit

# Lint (oxlint + ESLint)
bun run lint

# Fix linting
bun run lint:fix

# Run only oxlint (fast)
bun run lint:oxc

# Run only ESLint (plugins)
bun run lint:eslint

# Build for production
bun run build

# Run tests
bun test
```

### Database

```bash
# ⚠️ NEVER RUN THESE AUTOMATICALLY - ALWAYS ASK USER FIRST
# Generate migrations (USER MUST RUN THIS)
bun run db:generate

# Apply migrations (USER MUST RUN THIS)
bun run db:migrate

# Open database studio
bun run db:studio

# Reset database (caution!)
bun run db:reset
```

**IMPORTANT**: Claude Code should NEVER run `db:generate` or `db:migrate` commands automatically. Always inform the user to run these commands manually after schema changes.

### Debugging

```bash
# Check server logs
tail -f server.log

# Check client bundle
bun run analyze

# Clear cache
rm -rf .vite/ dist/ node_modules/.cache
```

## 📂 Project Structure Quick Lookup

```
hamflow/
├── src/
│   ├── pages/         # Vike pages (file-based routing)
│   ├── components/    # React components
│   ├── server/        # ElysiaJS backend
│   ├── shared/        # Shared types and utilities
│   ├── ui/           # UI components (Park UI)
│   └── lib/          # Library code and utilities
├── drizzle/          # Database schema and migrations
├── docs/             # Documentation
└── public/           # Static assets
```

## 🔗 Quick Links

- **Local Dev**: http://localhost:3000
- **Database Studio**: http://localhost:4983
- **API Docs**: http://localhost:3000/swagger

## ✨ Quick Add

### Usage

- **Keyboard**: `Ctrl + N` to open Quick Add
- **Button**: Click "Quick Add" button in top bar (sparkle icon ✨)
- **Flow**: Type quick input → AI parses → TaskDialog opens with pre-filled fields

### How It Works

1. Type something quick like "deploy staging tomorrow high priority"
2. AI parses and extracts: title, description, dueDate, priority, labels, board/column
3. TaskDialog opens with all fields pre-filled
4. Review, edit any field, add subtasks, set reminders, etc.
5. Create task normally through TaskDialog

### Examples

```
"deploy staging tomorrow high priority"       → Opens TaskDialog: title="deploy staging", dueDate=tomorrow, priority=high
"fix login bug on engineering board"          → Opens TaskDialog on Engineering board, To Do column
"meeting notes for Q4 planning"               → Opens TaskDialog: title="meeting notes for Q4 planning"
"urgent: update docs asap"                    → Opens TaskDialog: priority=urgent
```

**Note**: This is a "cheatcode" to quickly open TaskDialog with AI-parsed fields. You still use the full TaskDialog to finalize the task.

## 🤖 AI Command Parser

### Usage

- **Keyboard**: `Cmd/Ctrl + K` to open command bar
- **Voice**: Click mic button (toggle to cancel)
- **Actions**: create_task, create_inbox_item, create_reminder, complete_task, move_task, list_tasks, start_pomodoro, stop_pomodoro

### Examples

```
"Add task deploy staging server"           → Goes to inbox
"Add task deploy to Engineering board"     → Goes to Engineering → To Do
"Add fix bug to Done column"               → Goes to first board → Done
"Remind me to call dentist in 30 minutes"  → Creates reminder
"Note: meeting ideas for Q4"               → Goes to inbox
"Complete task review PR"                  → Marks task complete
```

### Environment Variables

```bash
# Required for AI command processing
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

### Implementation Notes

- Uses Mastra agent with Gemini 2.5 Flash Lite
- Structured output via Zod schema validation
- Two-stage flow: parse → confirm → execute
- Auto-invalidates React Query cache after execution
- **Board-aware**: AI knows your boards/columns and can add tasks directly to them
- Command history: Navigate with ↑↓ arrows, stored in localStorage (last 20)
- Quick suggestions: Clickable example commands when bar is empty

## 📥 Inbox System

### Workflow

1. Items arrive via command bar, HamBot, or API
2. Click arrow button → modal opens
3. Select destination board/column (2-column grid)
4. Item converts to task, navigates to board

### Batch Operations

- Select multiple items with checkboxes
- "Move to Board" button → modal for destination
- "Delete" button → bulk delete with confirmation

## 🔔 HamBot Integration

### Environment Variables

```bash
# Required for HamBot daily summaries
HAMBOT_API_KEY=your_api_key_here
HAMBOT_API_URL=https://hambot.ham-san.net/webhook/hambot-push
```

### Reminders

- Cron checks every minute for due reminders
- Sends via WebSocket → toast notification (⏰ icon)
- Also tries browser notification if permission granted
- `requireInteraction: true` - stays until dismissed

### Summary Schedule (JST/Asia/Tokyo)

- **Morning Summary**: 10:00 AM (01:00 UTC)
- **Evening Summary**: 10:00 PM (13:00 UTC)

### User Settings

Users can configure in Settings page:

- Enable/disable morning/evening summaries
- Choose spaces (work/personal/both)
- Test summaries via actual HamBot send

### Summary Content

**Morning** (10:00 AM JST):

- Tasks due today
- Upcoming tasks (next 7 days)
- Link to HamFlow instance

**Evening** (10:00 PM JST):

- Completed tasks/habits count
- Unfinished tasks
- Incomplete habits
- Link to HamFlow instance

## 🌍 Timezone Utilities

**Location**: `src/shared/utils/timezone.ts` (works on server & client)

```typescript
import { utcToJst, jstToUtc, nowInJst, getJstDateComponents } from '~/shared/utils/timezone';

// Get current time in JST
const now = nowInJst();

// Convert UTC → JST for display
const jstDate = utcToJst(utcDate);

// Convert JST → UTC for storage
const utcDate = jstToUtc('2025-10-09T09:00:00'); // 09:00 JST → 00:00 UTC

// Extract date components in JST
const { year, month, day, hours, minutes, dayOfWeek } = getJstDateComponents(utcDate);
```

**When to Use**:

- ✅ Storing dates in database (convert JST → UTC)
- ✅ Displaying dates to user (convert UTC → JST)
- ✅ Calendar operations (use `getJstDateComponents`)
- ✅ Habit reminder times (stored as JST string like "09:00")
- ✅ Carryover feature (preserve time in JST)

**Never Do**:

- ❌ Manual timezone math (`hours - 9`)
- ❌ Using `setUTCHours()` for JST times
- ❌ Mixing UTC and JST without conversion

## ⚡ Common Gotchas

1. **Vite HMR Issues**: Restart dev server if hot reload stops working
2. **Type Errors**: Run `bunx tsc --noEmit` before committing
3. **Database Changes**: Always generate AND apply migrations
4. **WebSocket Issues**: Check if port 3000 is already in use
5. **Build Failures**: Clear cache with `rm -rf .vite/ dist/`
6. **Timezone Issues**: Always use timezone utilities, never manual date math

## 🎯 Quick Wins

- Use `logger` from `shared/logger` for consistent logging
- Import components from `ui/styled/` for better TypeScript support
- Use React Query for all data fetching (no manual fetch calls)
- Prefer Drizzle query builder over raw SQL
- Always handle errors with proper error boundaries

---

# 📚 Component & Pattern Reference

## 🎨 Park-UI / Ark UI Component Patterns

### Dialog Component (CRITICAL!)

**Common Mistake**: Dialog.Content has NO default padding!

```tsx
// ✅ CORRECT Pattern
import { Portal } from '@ark-ui/react/portal';
import * as Dialog from '~/components/ui/styled/dialog';

<Dialog.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)}>
  <Dialog.Trigger asChild>
    <Button>Open</Button>
  </Dialog.Trigger>

  <Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content maxW="md">  {/* Set max width: sm, md, lg, xl */}
        <VStack gap="6" p="6">    {/* MUST wrap in VStack with p="6" */}

          {/* Group title and description */}
          <VStack gap="1" alignItems="start">
            <Dialog.Title>Title</Dialog.Title>
            <Dialog.Description>Description</Dialog.Description>
          </VStack>

          {/* Content sections with width="100%" */}
          <Box width="100%">
            <FormLabel htmlFor="field">Field</FormLabel>
            <Input id="field" />
          </Box>

          {/* Actions row */}
          <HStack gap="2" justifyContent="flex-end" width="100%">
            <Dialog.CloseTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.CloseTrigger>
            <Button>Confirm</Button>
          </HStack>
        </VStack>

        {/* Close button (absolute positioned) */}
        <Dialog.CloseTrigger asChild>
          <Button variant="ghost" position="absolute" top="2" right="2">
            <X width="16" height="16" />
          </Button>
        </Dialog.CloseTrigger>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Root>
```

**Key Gotchas**:
- ❌ NO `Dialog.Header`, `Dialog.Body`, `Dialog.Footer` - these don't exist!
- ✅ Dialog.Content has NO default padding - always wrap in `VStack` with `p="6"`
- ✅ Set `maxW` on Dialog.Content (sm, md, lg, xl)
- ✅ Wrap everything in `<Portal>` for proper z-index
- ✅ Use `* as Dialog` from styled, NOT generic Dialog
- ✅ Add `width="100%"` to form sections

**Dialog Sizes**:
- `maxW="sm"` - Confirmations
- `maxW="md"` - Standard forms
- `maxW="lg"` - Larger forms
- `maxW="xl"` - Complex forms

### Other Component Props

```typescript
// TaskDialog
<TaskDialog open={isOpen} />  // NOT isOpen!

// Badge sizes
<Badge size="sm" />  // sm, md, lg (NO xs!)

// FormLabel connection
<FormLabel htmlFor="field-id">Label</FormLabel>
<Input id="field-id" />
```

## 🎨 Panda CSS Semantic Tokens

**NEVER hardcode colors - always use semantic tokens!**

```tsx
// ❌ WRONG
<Box bg="green.50" borderColor="green.500" color="red.900" />

// ✅ CORRECT
<Box
  bg="bg.emphasized"
  borderColor="border.emphasized"
  color="fg.muted"
/>
```

**Token Reference**:

```typescript
// Backgrounds
bg.default     // Primary background
bg.subtle      // Secondary background
bg.muted       // Tertiary background
bg.emphasized  // Highlighted background

// Foreground (text)
fg.default     // Primary text
fg.muted       // Secondary text
fg.subtle      // Tertiary text
fg.emphasized  // Highlighted text

// Borders
border.default    // Primary border
border.muted      // Secondary border
border.subtle     // Tertiary border
border.emphasized // Highlighted border

// Color Palette (use with data attributes)
colorPalette.default  // Use with colorPalette prop
colorPalette.fg       // Foreground on colorPalette background
colorPalette.subtle   // Subtle background
```

**Color Palette Usage**:

```tsx
// ✅ Colored text on normal background
<Text color="red.default">Error text</Text>

// ✅ colorPalette.fg with colorPalette background
<Box colorPalette="red" bg="colorPalette.default" color="colorPalette.fg">
  Text
</Box>

// ❌ WRONG - colorPalette.fg without colorPalette background
<Box bg="bg.muted" color="colorPalette.fg" />
```

## 🔐 API Authentication Patterns

### Bearer Token (API Keys / Raycast)

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiToken}`,
};

const response = await fetch(`${baseUrl}/api/tasks`, {
  method: 'POST',
  headers,
  body: JSON.stringify(data)
});
```

### Cookie-based (Browser)

```typescript
const response = await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies!
  body: JSON.stringify(data)
});
```

### WebSocket Authentication

```typescript
// Client reads non-httpOnly ws_token cookie
const token = getCookie('ws_token');
const wsUrl = `ws://localhost:3000/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
const ws = new WebSocket(wsUrl);
```

**Server Pattern** (dual-cookie for security):

```typescript
// Main auth cookie (httpOnly for API)
cookie.auth.set({
  value: token,
  httpOnly: true,  // Secure from XSS
  secure: true,
  sameSite: 'lax',
  maxAge: 30 * 86400
});

// WebSocket token (accessible to JS)
cookie.ws_token.set({
  value: token,
  httpOnly: false,  // Allow JS access
  secure: false,
  sameSite: 'lax',
  maxAge: 30 * 86400
});
```

## 💾 Database Query Patterns

### Basic CRUD

```typescript
// SELECT
const [item] = await db.select()
  .from(table)
  .where(eq(table.id, id));

// INSERT
const [newItem] = await db.insert(table)
  .values({ ...data })
  .returning();

// UPDATE
await db.update(table)
  .set({ field: value })
  .where(eq(table.id, id));

// DELETE
await db.delete(table)
  .where(eq(table.id, id));
```

### Avoid Await in Loop - Use Promise.all

```typescript
// ❌ WRONG - Sequential execution (slow!)
for (let i = 0; i < ids.length; i++) {
  await db.update(table).set({ order: i }).where(eq(table.id, ids[i]));
}

// ✅ CORRECT - Parallel execution
await Promise.all(
  ids.map((id, i) =>
    db.update(table).set({ order: i }).where(eq(table.id, id))
  )
);
```

### Date Range Queries (JST-aware)

```typescript
import { getJstDateComponents, createJstDate } from '~/shared/utils/timezone';

// Get JST date boundaries
const { year, month, day } = getJstDateComponents(reminderTime);
const startOfDayJst = createJstDate(year, month, day, 0, 0, 0);
const endOfDayJst = createJstDate(year, month, day, 23, 59, 59);

// Query with JST boundaries (dates stored as UTC in DB)
const items = await db.select()
  .from(table)
  .where(
    and(
      eq(table.userId, userId),
      gte(table.date, startOfDayJst),
      lte(table.date, endOfDayJst)
    )
  );
```

### Self-Referencing Foreign Keys

```typescript
import { type AnyPgColumn } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey(),
  parentTaskId: uuid('parent_task_id')
    .references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' })
});
```

## 🔄 React Query Best Practices

### Always Invalidate After Mutations

```typescript
const mutation = useMutation({
  mutationFn: (data) => api.post('/api/tasks', data),
  onSuccess: () => {
    // Always invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['boards'] });
  }
});
```

### Use Stable Keys (Format Date Objects!)

```typescript
// ❌ WRONG - Date object causes stale data
const { data } = useQuery({
  queryKey: ['habits', selectedDate, space]
});

// ✅ CORRECT - Format date to stable string
const { data } = useQuery({
  queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), space]
});
```

**Why**: React Query's shallow comparison doesn't trigger refetch if Date instance changes but represents same date value.

## 🌐 WebSocket Patterns

### Cross-Tab Timer Synchronization

```typescript
// ❌ WRONG - Independent countdown per tab (causes drift!)
setInterval(() => {
  setTimeLeft(prev => prev - 1);
}, 1000);

// ✅ CORRECT - Calculate from server startTime
interface ActiveState {
  timeLeft: number;
  startTime: string; // ISO timestamp
}

// In useEffect
const startTime = new Date(serverState.startTime).getTime();
const elapsed = Math.floor((Date.now() - startTime) / 1000);
const newTimeLeft = Math.max(0, serverState.timeLeft - elapsed);
setLocalTimeLeft(newTimeLeft);
```

**Benefits**: Perfect sync across tabs, no drift, tolerant to network delays.

## 📝 TypeScript Patterns

### Logger Usage (Error First!)

```typescript
// ✅ CORRECT - Error object first
logger.error(error, 'Failed to create task');

// ❌ WRONG
logger.error('Failed to create task', error);
```

### Unused Parameters

```typescript
// Prefix with underscore if declared but unused
function handler({ _unusedParam, usedParam }: Props) {
  return usedParam;
}
```

## ⚡ Performance Patterns

### AudioContext Singleton (Prevent Memory Leaks!)

```typescript
// ❌ WRONG - Creates new AudioContext every time (5-10MB/hour leak!)
function playSound() {
  const audioContext = new AudioContext();
  // ...
}

// ✅ CORRECT - Singleton pattern
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }

  // Resume if suspended (required on mobile)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}
```

### useEffect Dependencies (Avoid Infinite Loops!)

```typescript
// ❌ WRONG - Mutation in dependencies causes infinite loop
useEffect(() => {
  mutation.mutate(data);
}, [mutation]); // mutation is new object on every render!

// ✅ CORRECT - Use ref for mutations
const mutationRef = useRef(mutation);
useEffect(() => {
  mutationRef.current = mutation;
}, [mutation]);

useEffect(() => {
  mutationRef.current.mutate(data);
}, [data]); // Only stable values in dependencies
```

### Timer Intervals

```typescript
// ✅ 1000ms (1 second) - Sufficient for countdowns
// ❌ 100ms - Causes unnecessary re-renders

// Use setTimeout for easier cleanup
const tick = () => {
  // ... calculation
  intervalRef.current = setTimeout(tick, 1000);
};

// Always cleanup
useEffect(() => {
  tick();
  return () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
  };
}, [dependencies]);
```

## 🧪 Testing Quick Reference

### Manual Testing Checklist

```bash
# 1. Type check
bunx tsc --noEmit

# 2. Lint
bun run lint

# 3. Fix linting
bun run lint:fix

# 4. Build
bun run build

# 5. Test in browser
open http://localhost:3000
```

### Test Scenarios

- [ ] Chrome Desktop - memory stable
- [ ] Mobile Safari - no errors
- [ ] Both Work/Personal spaces
- [ ] Light and dark themes
- [ ] Multiple tabs (WebSocket sync)
- [ ] Form validation
- [ ] Console errors check
- [ ] Network tab check

## ⚠️ Common Pitfalls Summary

| Issue | Wrong | Correct |
|-------|-------|---------|
| Dialog padding | `<Dialog.Content>` | `<Dialog.Content><VStack p="6">` |
| Colors | `bg="green.500"` | `bg="bg.emphasized"` |
| Dialog import | `Dialog` | `* as Dialog from styled` |
| Portal | Missing | `<Portal>` wrapper |
| Logger | `logger.error(msg, err)` | `logger.error(err, msg)` |
| Await in loop | `for + await` | `Promise.all()` |
| Date in queryKey | `Date` object | `format(date, 'yyyy-MM-dd')` |
| AudioContext | New every time | Singleton pattern |
| Mutation in deps | `[mutation]` | Use `ref` |
| Timezone math | Manual `-9` | Use utilities |
| Badge sizes | `size="xs"` | `size="sm"` (min) |
| Dialog props | `isOpen` | `open` |
| FormLabel | No `htmlFor` | `htmlFor="field-id"` |
