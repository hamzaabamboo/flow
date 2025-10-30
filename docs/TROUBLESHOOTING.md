# TROUBLESHOOTING GUIDE

> **IMPORTANT**: Add new issues and solutions as you encounter them. Check here FIRST when something breaks.

## 🔴 Critical Issues

### Timezone Issues

**Symptom**: Calendar shows wrong times, tasks appear on wrong days, habit reminders don't fire

**Common Causes**:
1. Mixing UTC and JST without proper conversion
2. Using `setUTCHours()` on dates meant to be JST
3. Missing timezone conversion when storing/retrieving dates

**Solution**: Use timezone utilities from `src/shared/utils/timezone.ts`

```typescript
// ❌ WRONG - Manual timezone math
const date = new Date();
date.setUTCHours(hours - 9, minutes, 0, 0); // Brittle!

// ✅ CORRECT - Use utilities
import { jstToUtc, utcToJst, getJstDateComponents } from '~/shared/utils/timezone';

// Convert JST to UTC for storage
const utcDate = jstToUtc(jstDateString);

// Convert UTC to JST for display
const jstDate = utcToJst(utcDate);

// Get JST components for manipulation
const { year, month, day, hours, minutes } = getJstDateComponents(utcDate);
```

**Key Principles**:
- **Store**: Always UTC in database
- **Display**: Convert to JST for user
- **Input**: Accept JST, convert to UTC before saving
- **Never**: Mix timezones without explicit conversion

### Habit Reminders Not Firing

**Symptom**: Habits have reminder times but no notifications sent

**Root Cause**: Cron job creates reminders, another sends them - check both are running

**Debug Steps**:
```bash
# 1. Check server logs for cron execution
grep "Creating daily habit reminders" server.log

# 2. Verify reminders are created in database
psql $DATABASE_URL -c "SELECT * FROM reminders WHERE sent = false;"

# 3. Check reminder sending cron is running
grep "Checking for reminders" server.log

# 4. Verify HamBot configuration (if using)
echo $HAMBOT_API_KEY
```

**Solution**: Ensure both cron jobs are enabled:
- **Create reminders**: Runs every hour (`0 * * * *`)
- **Send reminders**: Runs every minute (`*/1 * * * *`)

### Duplicate Habit Reminders (30+ Per Habit)

**Symptom**: Multiple duplicate reminders (30+) for a single habit appearing in notification list

**Root Cause**: Two bugs in reminder deduplication logic:

1. **Non-deterministic LIMIT 1**: Query without ORDER BY returns random row - could match wrong day
2. **UTC vs JST Date Boundaries**: Checked UTC ranges instead of JST, missing reminders that crossed date boundary

Example: Habit at 1:00 AM JST on Oct 21 = Oct 20 16:00 UTC. Old code checked Oct 20 00:00-23:59 UTC and missed it.

**Solution**: Use JST date boundaries in WHERE clause

```typescript
// src/server/services/habit-reminder-service.ts
private async reminderExists(
  userId: string,
  habitName: string,
  reminderTime: Date
): Promise<boolean> {
  // Get JST date components
  const { year, month, day } = getJstDateComponents(reminderTime);

  // Calculate JST day boundaries (00:00:00 to 23:59:59 JST)
  const startOfDayJst = createJstDate(year, month, day, 0, 0, 0);
  const endOfDayJst = createJstDate(year, month, day, 23, 59, 59);

  // Find reminder for this habit on this specific JST date
  const [existing] = await db.select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        sql`${reminders.message} LIKE ${'Habit reminder: ' + habitName + '%'}`,
        gte(reminders.reminderTime, startOfDayJst),
        lte(reminders.reminderTime, endOfDayJst)
      )
    )
    .limit(1);

  return !!existing;
}
```

**Key Fix**: Filter by date range in WHERE clause with JST boundaries, not application logic after fetch

### Wrong Dev Server Port

**Symptom**: Can't access the application
**Common Mistake**: Trying `http://localhost:5173` (Vite default)
**Solution**: Use `http://localhost:3000` - HamFlow runs on port 3000!

### TypeScript Build Errors

**Symptom**: `bunx tsc --noEmit` fails
**Common Causes**:

1. Using `any` type
2. Missing type imports
3. Wrong prop names

**Quick Fixes**:

```bash
# Check specific file
bunx tsc --noEmit src/path/to/file.tsx

# See all errors
bunx tsc --noEmit | head -20
```

## 🟡 Component Issues

### Park-UI Component Props

**Problem**: Property does not exist on type

```typescript
// ❌ WRONG
<TaskDialog isOpen={true} />  // Error: Property 'isOpen' does not exist

// ✅ CORRECT
<TaskDialog open={true} />
```

**Common Prop Mistakes**:
| Component | Wrong Prop | Correct Prop |
|-----------|------------|--------------|
| Dialog | `isOpen` | `open` |
| Dialog | `onClose` | `onOpenChange` |
| Badge | `size="xs"` | `size="sm"` |
| Select | `onChange` | `onValueChange` |

### Color System Errors

**Problem**: `colorPalette.fg` not working

```typescript
// ❌ WRONG - No parent colorPalette
<Text color="colorPalette.fg">Text</Text>

// ✅ CORRECT - Has parent colorPalette
<Box colorPalette="blue">
  <Text color="colorPalette.fg">Text</Text>
</Box>

// ✅ ALTERNATIVE - Direct color
<Text color="blue.default">Text</Text>
```

### Missing Styled Components

**Problem**: Component missing features (Root, Trigger, Content exports)

```typescript
// ❌ WRONG - Basic component
import * as Dialog from '../ui/styled/dialog';

// ✅ CORRECT - Styled component
import { Dialog } from '../ui/dialog';
```

## 🟢 API & Backend Issues

### AI Command Date Parsing Stale Timestamps

**Symptom**: User says "end of today" at 1:00 AM but gets previous day's 23:59

**Root Cause**: Current date/time calculated ONCE at server startup, not per request. All requests use stale timestamp.

**Solution**: Calculate JST time per request

```typescript
// src/server/routes/command.ts
async ({ body, db, user }) => {
  // Get current JST time for THIS request (not server startup time)
  const jstNow = nowInJst();
  const { year, month, day, hours, minutes, dayOfWeek } = getJstDateComponents(jstNow);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const currentTimeJst = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+09:00`;

  const timeContext = `
## Current Date and Time
- Current time (JST): ${currentTimeJst}
- Current date: ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}
- Day of week: ${dayNames[dayOfWeek]}

Use this for calculating all relative dates.`;

  // Append to user message
  const result = await commandProcessor.generate([
    { role: 'user', content: command + timeContext }
  ], { ... });
}
```

**Key Learning**: Never calculate timestamps in static code - always compute per request

### Authentication Errors

**Symptom**: "Authentication required" on API calls
**Solutions**:

1. Check cookie is set: `document.cookie`
2. Ensure withAuth() is used in route
3. Verify JWT token is valid

### WebSocket Authentication Not Working

**Symptom**:
- WebSocket connections show as `(anonymous)` in server logs
- Real-time updates (Pomodoro timer) not syncing across tabs
- User-specific broadcasts not reaching clients

**Root Cause**: The `auth` cookie was set with `httpOnly: true`, preventing JavaScript from reading it for WebSocket connections

**Debug Steps**:
```bash
# Check WebSocket connections in server logs
grep "WebSocket" server.log | grep "anonymous"

# Check cookie settings in browser DevTools
document.cookie  # Should see ws_token
```

**Solution**: Create dedicated non-httpOnly cookie for WebSocket auth

```typescript
// src/server/auth/withAuth.ts
cookie.ws_token.set({
  value: token,
  httpOnly: false,  // Allow JavaScript access for WebSocket
  secure: false,    // Development (use true in production)
  sameSite: 'lax',
  maxAge: 30 * 86400,
  path: '/'
});

// src/hooks/useWebSocket.ts
const token = getCookie('ws_token');
const wsUrl = `${protocol}//${window.location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;
```

**Security Note**: Main `auth` cookie remains `httpOnly: true`. Only `ws_token` is accessible to JavaScript.

**WebSocket Auth Flow**:
1. Client reads `ws_token` cookie
2. Passes as query parameter: `/ws?token=...`
3. Server decodes JWT, extracts `userId`
4. Subscribes to `user:${userId}` channel
5. Broadcasts reach only authenticated users

### Context Not Propagating

**Problem**: `user` undefined in route handlers

```typescript
// ❌ WRONG - Context doesn't propagate
.derive(async ({ cookie, jwt, db }) => {
  return { user };
})

// ✅ CORRECT - Global scope
.derive({ as: 'global' }, async ({ cookie, jwt, db }) => {
  return { user };
})
```

### Logger Errors

**Problem**: Logger not working correctly

```typescript
// ❌ WRONG - Arguments reversed
logger.error('Error message', errorObject);

// ✅ CORRECT - Error object first
logger.error(errorObject, 'Error message');
```

## 📦 Database Issues

### Drizzle ORM Problems

**JSONB Fields Missing**:

```typescript
// ❌ WRONG - JSONB fields undefined
const tasks = await db
  .select({
    id: tasks.id,
    labels: tasks.labels // Will be undefined!
  })
  .from(tasks);

// ✅ CORRECT - Select all fields
const allTasks = await db.select().from(tasks);
const formatted = allTasks.map((t) => ({
  id: t.id,
  labels: t.labels || []
}));
```

**Self-referencing Foreign Keys**:

```typescript
// ❌ WRONG - Circular dependency error
parentTaskId: uuid('parent_task_id').references(() => tasks.id);

// ✅ CORRECT - Use AnyPgColumn
import { type AnyPgColumn } from 'drizzle-orm/pg-core';
parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id);
```

### Migration Issues

**Problem**: Migration fails
**Common Solutions**:

```bash
# Reset and reapply
bun run db:generate
bun run db:push

# Check migration SQL
cat drizzle/migrations/*.sql

# If corrupted, restore from backup
cp drizzle/migrations_backup/* drizzle/migrations/
```

## 🎨 UI/UX Issues

### Checkbox Not Responding

**Problem**: Clicking checkbox opens modal instead
**Solution**: Stop event propagation

```typescript
<Checkbox
  onClick={(e) => e.stopPropagation()}
  onCheckedChange={handleChange}
/>
```

### Tasks Too Small in Agenda

**Problem**: Task text hard to read in week view
**Current State**: Partially fixed, needs more adjustment
**Temporary Workaround**: Use day view for better readability

### React Query Cache Not Updating

**Symptom**:
- CommandBar creates items but UI doesn't update until manual refresh
- Stale data displayed after mutations
- Changes not reflected immediately

**Root Cause**: Missing cache invalidation after mutations. React Query doesn't automatically know when to refetch.

**Solution**: Invalidate relevant queries after mutations

```typescript
// After successful command execution
switch (action) {
  case 'create_task':
  case 'create_inbox_item':
    queryClient.invalidateQueries({ queryKey: ['inbox', currentSpace] });
    queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
    break;
  case 'create_reminder':
    queryClient.invalidateQueries({ queryKey: ['reminders'] });
    break;
}

// Or in mutation onSuccess
const mutation = useMutation({
  mutationFn: updateHabit,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['habits'] });
  }
});
```

**Common Pitfall**: Date objects in `queryKey`

```typescript
// ❌ WRONG - Date object in key causes issues
const { data } = useQuery({
  queryKey: ['habits', selectedDate, currentSpace],
  // selectedDate object instance changes but same value = no refetch
});

// ✅ CORRECT - Format Date to stable string
const { data } = useQuery({
  queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), currentSpace],
});
```

**Best Practice**: Always invalidate queries after mutations, even with WebSocket updates (redundancy is good)

### Layout Issues

**Container Too Narrow**:

```typescript
// ❌ LIMITED WIDTH
<Container maxW="8xl">

// ✅ FULL WIDTH
<Box w="full" px="4">
```

**Grid Not Responsive**:

```typescript
// Add responsive breakpoints
<Grid
  gridTemplateColumns={{
    base: "1fr",           // Mobile: 1 column
    md: "repeat(7, 1fr)"   // Desktop: 7 columns
  }}
>
```

## 🚀 Performance Issues

### Pomodoro Timer Memory Leaks

**Symptom**:
- Memory increasing ~5-10MB per hour of timer usage
- Performance degradation over time
- Browser tab becomes sluggish after extended use

**Root Causes**:

1. **AudioContext Memory Leak**: Creating new AudioContext on every sound play - instances NOT garbage collected
2. **useEffect Infinite Loop**: Mutation in dependencies causes infinite re-renders + cascading query invalidations
3. **Mobile AudioContext Errors**: No fallback for unsupported browsers, suspended contexts not resumed

**Solution 1: AudioContext Singleton Pattern**

```typescript
// Reuse single instance across all sound plays
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
      audioContext.resume().catch((err) => console.error('Failed to resume:', err));
    }

    return audioContext;
  } catch (error) {
    console.error('Failed to create AudioContext:', error);
    return null;
  }
}
```

**Solution 2: Fix useEffect Dependencies**

```typescript
// ❌ WRONG - Mutation in dependencies causes infinite loop
useEffect(() => {
  updateStateMutation.mutate(/* ... */);
}, [serverState, updateStateMutation]);  // Mutation changes every render!

// ✅ CORRECT - Use ref for stable reference
const updateStateMutationRef = useRef(updateStateMutation);
updateStateMutationRef.current = updateStateMutation;

useEffect(() => {
  updateStateMutationRef.current.mutate(/* ... */);
}, [serverState]);  // Stable dependencies
```

**Solution 3: Reduce Polling**

```typescript
// Reduced server sync from 10s → 30s intervals
// Disabled refetchInterval during countdown
// Set staleTime: Infinity to prevent unnecessary refetches
// Rely on WebSocket + local timer instead
```

**Performance Impact**:
- Before: ~5-10MB leak per hour, infinite invalidations every 5s
- After: Zero memory leak, invalidations only on WebSocket events

### Pomodoro Timer Drift/Sync Issues

**Symptom**: Timer shows different times across browser tabs (could be 42+ seconds apart)

**Root Cause**: Each tab runs independent countdown with `setInterval`. Accumulated drift over 25 minutes.

**Solution**: Use server timestamp reference instead of independent countdowns

```typescript
// ❌ WRONG - Each tab counts down independently
setInterval(() => {
  setLocalTimeLeft(prev => prev - 1);
}, 1000);

// ✅ CORRECT - Calculate based on server timestamp
const elapsed = Date.now() - startTime;
const timeLeft = initialTime - elapsed;

// Schedule next tick
setTimeout(tick, 1000);
```

**Key Learning**: For multi-tab sync, calculate elapsed time from server reference instead of independent countdowns

### Slow Page Load

**Causes & Solutions**:

1. **Too many API calls**: Batch requests
2. **Large bundle**: Check with `bun run build --analyze`
3. **Missing loading states**: Add skeletons
4. **No caching**: Use React Query properly

### WebSocket Disconnects

**Problem**: Real-time updates stop working
**Debug Steps**:

1. Check DevTools → Network → WS tab
2. Look for ping/pong messages
3. Verify server hasn't restarted
4. Check for memory leaks in long-running connections

## 🛠️ Development Environment

### Build Failures

**Common Fixes**:

```bash
# Clean and rebuild
rm -rf node_modules
rm -rf styled-system
bun install
bun run prepare
bun run build

# Type checking
bunx tsc --noEmit

# Linting
bun run lint:fix
```

### Hot Reload Not Working

**Solutions**:

1. Check nodemon is running
2. Restart dev server: `Ctrl+C` then `bun run dev`
3. Clear Vite cache: `rm -rf .vite`
4. Check file watchers limit: `ulimit -n 10000`

### Port Already in Use

**Error**: "Port 3000 is already in use"

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 bun run dev
```

## 📝 TypeScript Issues

### Import Errors

**Problem**: Module not found

```typescript
// ❌ WRONG - Absolute path
import { Component } from '/src/components/Component';

// ✅ CORRECT - Relative path
import { Component } from '../components/Component';

// ✅ CORRECT - Path alias (if configured)
import { Component } from '~/components/Component';
```

### Type 'any' Errors

**ESLint Rule**: `@typescript-eslint/no-explicit-any`

```typescript
// ❌ BANNED
const data: any = {};

// ✅ ALTERNATIVES
const data: unknown = {};
const data: Record<string, unknown> = {};
const data: SpecificInterface = {};
```

## 🔍 Debugging Tips

### Check These First

1. **Console errors**: Open DevTools Console
2. **Network failures**: Check Network tab
3. **TypeScript errors**: Run `bunx tsc --noEmit`
4. **Lint errors**: Run `bun run lint`
5. **Database state**: Check with `bun run db:studio`

### Useful Debug Commands

```bash
# Check running processes
ps aux | grep bun

# Monitor file changes
find src -name "*.tsx" | entr -c bun run build

# Database queries
psql $DATABASE_URL -c "SELECT * FROM tasks LIMIT 5;"

# WebSocket testing
wscat -c ws://localhost:3000/ws
```

## 🆘 When All Else Fails

1. **Restart everything**:

   ```bash
   pkill -f bun
   bun run dev
   ```

2. **Reset database**:

   ```bash
   bun run db:push --force
   bun run seed
   ```

3. **Clean install**:

   ```bash
   rm -rf node_modules bun.lockb
   bun install --force
   ```

4. **Check the logs**:
   - Server logs in terminal
   - Browser console
   - Network tab in DevTools

---

**Remember**: Add new issues and solutions as you discover them!
