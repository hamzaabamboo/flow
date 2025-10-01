# TROUBLESHOOTING GUIDE

> **IMPORTANT**: Add new issues and solutions as you encounter them. Check here FIRST when something breaks.

## 🔴 Critical Issues

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

### Authentication Errors

**Symptom**: "Authentication required" on API calls
**Solutions**:

1. Check cookie is set: `document.cookie`
2. Ensure withAuth() is used in route
3. Verify JWT token is valid

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
