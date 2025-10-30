# DEVELOPMENT GUIDE

> **IMPORTANT**: Follow these guidelines for consistent, high-quality development.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server (runs on port 3000, NOT 5173)
bun run dev

# Run type checking
bunx tsc --noEmit

# Fix linting issues
bun run lint:fix

# Build for production
bun run build
```

## 📁 Project Structure

```
hamflow/
├── src/
│   ├── server/          # Backend (ElysiaJS)
│   │   ├── index.ts     # Main server entry
│   │   ├── routes/      # API route handlers
│   │   ├── db/          # Database connection
│   │   └── logger.ts    # Pino logger config
│   ├── pages/           # Frontend pages (Vike SSR)
│   │   └── +Page.tsx    # Page components
│   ├── components/      # Reusable UI components
│   │   ├── ui/          # Park-UI components
│   │   └── Board/       # Feature-specific
│   ├── shared/          # Shared code
│   │   └── types/       # TypeScript type definitions
│   ├── hooks/           # Custom React hooks
│   └── contexts/        # React contexts
├── drizzle/             # Database migrations
├── styled-system/       # PandaCSS generated
└── docs/               # Documentation
```

## 🎨 UI Component Guidelines

### Park-UI Component Usage

```typescript
// ✅ CORRECT - Use styled components for complex features
import * as Dialog from '../ui/styled/dialog';
import { Portal } from '@ark-ui/react/portal';

// ❌ WRONG - Basic components lack features
import { Dialog } from '../ui/dialog';
```

### Panda CSS Semantic Token Reference

**ALWAYS use semantic tokens - NEVER hardcode colors!**

```typescript
// ✅ CORRECT - Semantic tokens adapt to theme
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

// ❌ WRONG - Hardcoded colors break theming
green.500, red.400, blue.50, white // DON'T USE THESE
```

### Color System Rules

```typescript
// ✅ CORRECT - Colored text on normal background
<Text color="red.default">Error text</Text>

// ✅ CORRECT - colorPalette.fg with colorPalette background
<Box colorPalette="red" bg="colorPalette.default" color="colorPalette.fg" />

// ❌ WRONG - colorPalette.fg without colorPalette background
<Box bg="bg.muted" color="colorPalette.fg" />
```

### Dynamic Styling - ZERO TOLERANCE

**Never use dynamic values in Panda props!** Panda CSS performs static analysis at build time.

#### Pattern 1: Use `colorPalette` Prop

```typescript
// ❌ WRONG - Dynamic bg value
<Box bg={getPriorityColor(task.priority)} />

// ✅ CORRECT - Use colorPalette + semantic token
<Box
  colorPalette={getPriorityColor(task.priority)}
  bg="colorPalette.solid"
/>
```

#### Pattern 2: Data Attributes + `css()` for Conditional Styles

```typescript
import { css } from 'styled-system/css';

// ❌ WRONG - Ternary in style prop
<Box
  borderColor={isDragOver ? 'colorPalette.default' : 'transparent'}
  bg={isDragOver ? 'colorPalette.subtle' : 'bg.muted'}
/>

// ✅ CORRECT - Data attribute + css()
<Box
  data-drag-over={isDragOver}
  className={css({
    borderColor: 'transparent',
    bg: 'bg.muted',
    '&[data-drag-over=true]': {
      borderColor: 'colorPalette.default',
      bg: 'colorPalette.subtle'
    }
  })}
/>
```

#### Pattern 3: Global CSS for App-Wide Patterns

```typescript
// panda.config.ts
globalCss: {
  '[data-priority=urgent]': { colorPalette: 'red' },
  '[data-priority=high]': { colorPalette: 'orange' },
  '[data-space=work]': { colorPalette: 'blue' },
  '[data-space=personal]': { colorPalette: 'purple' }
}

// Usage in components
<Box data-priority={task.priority} bg="colorPalette.subtle">
  {task.title}
</Box>
```

#### Pattern 4: CSS Custom Properties for Truly Dynamic Values

```typescript
// ❌ WRONG - Inline style with dynamic value
<Box style={{ width: `${progress}%` }} />

// ✅ CORRECT - CSS custom property
<Box
  style={{ '--progress': `${progress}%` } as React.CSSProperties}
  className={css({ width: 'var(--progress)' })}
/>
```

### Dialog Component Structure

**Dialog.Content has NO default padding** - always wrap in VStack!

```tsx
<Dialog.Root>
  <Dialog.Trigger asChild>
    <Button>Open Dialog</Button>
  </Dialog.Trigger>

  <Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content maxW="md">  {/* 1. Set max width */}
        <VStack gap="6" p="6">    {/* 2. REQUIRED: Add padding wrapper */}

          {/* 3. Group title and description */}
          <VStack gap="1" alignItems="start">
            <Dialog.Title>Dialog Title</Dialog.Title>
            <Dialog.Description>
              Description text goes here
            </Dialog.Description>
          </VStack>

          {/* 4. Content sections with width="100%" */}
          <Box width="100%">
            <FormLabel htmlFor="field-id">Field Label</FormLabel>
            <Input id="field-id" placeholder="Placeholder" />
          </Box>

          {/* 5. Actions row */}
          <HStack gap="2" justifyContent="flex-end" width="100%">
            <Dialog.CloseTrigger asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.CloseTrigger>
            <Button>Confirm</Button>
          </HStack>
        </VStack>

        {/* 6. Close button (absolute positioned) */}
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

**Common Dialog Sizes:**
- `maxW="sm"` - Small (confirmations)
- `maxW="md"` - Standard forms
- `maxW="lg"` - Larger forms
- `maxW="xl"` - Complex multi-section forms

**Key Rules:**
- Use `<Portal>` for proper z-index
- Wrap content in `<VStack gap="6" p="6">`
- Set `maxW` on Dialog.Content
- Add `width="100%"` to form sections
- Use `gap="6"` for major sections, `gap="1"` for related text

### Drag and Drop with dnd-kit

Use `DragOverlay` for proper z-index management:

```tsx
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';

function Component() {
  const [activeItem, setActiveItem] = useState(null);

  const handleDragStart = (event) => {
    setActiveItem(event.active.data.current);
  };

  const handleDragEnd = (event) => {
    setActiveItem(null);
    // Handle drop logic
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Draggable items */}

      {/* Render overlay with high z-index */}
      <DragOverlay>
        {activeItem ? (
          <Box
            borderLeftWidth="3px"
            borderLeftColor="colorPalette.default"
            borderRadius="sm"
            p="1.5"
            bg="bg.muted"
            boxShadow="lg"
            opacity={0.9}
          >
            {/* Preview content */}
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

**Benefits:**
- DragOverlay renders at root level with high z-index
- Dragged preview always appears on top
- Smooth visual feedback during drag

### Component Props

- TaskDialog: `open` (NOT `isOpen`)
- Badge sizes: `"sm"`, `"md"`, `"lg"` (NO `"xs"`)
- FormLabel: Use `htmlFor` to connect with Input `id`
- Always check prop types when errors occur

## 📝 Type System Rules

### NEVER Use 'any'

```typescript
// ❌ WRONG
const data: any = fetchData();

// ✅ CORRECT
const data: unknown = fetchData();
// Then use type guards or assertions

// ✅ BETTER
interface DataType {
  id: string;
  // ... specific fields
}
const data: DataType = fetchData();
```

### Type Organization

```typescript
// Component files - Props interfaces stay
interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
}

// Data models - Move to shared/types/
// ❌ WRONG - In component file
interface Task {
  id: string;
  title: string;
}

// ✅ CORRECT - In shared/types/task.ts
export interface Task {
  id: string;
  title: string;
}
```

## 🔧 Development Workflow

### Before Starting Any Task

1. **Read documentation**
   - Check `docs/PROJECT_STATUS.md` for current state
   - Review `docs/TROUBLESHOOTING.md` for known issues
   - Look at sample code in `.sample_code_do_not_copy/`

2. **Use TodoWrite tool**
   ```typescript
   - Research existing code
   - Design component structure
   - Implement functionality
   - Test implementation
   - Fix any issues
   ```

3. **Check for existing patterns**
   ```bash
   grep -r "feature_name" src/
   ls -la src/components/
   ```

### During Development

1. **Keep files under 400 lines**
   - Extract reusable components
   - Split logic from presentation
   - Create custom hooks for complex state

2. **Run checks frequently**
   ```bash
   bun run lint:fix    # After each feature
   bun run build       # Before committing
   bunx tsc --noEmit   # For type validation
   ```

3. **Test with Chrome DevTools**
   - Navigate to `http://localhost:3000` (NOT 5173!)
   - Check network tab for API calls
   - Verify WebSocket connections
   - Test responsive layouts

### After Implementation

1. **Update documentation**
   - Update `docs/PROJECT_STATUS.md`
   - Add learnings to `docs/SESSION_LEARNINGS.md`
   - Document issues in `docs/TROUBLESHOOTING.md`

2. **Verify everything works**
   - [ ] TypeScript compilation passes
   - [ ] No console errors
   - [ ] API calls succeed
   - [ ] UI renders correctly
   - [ ] Build completes

## 🌐 API Development

### Route Structure

```typescript
// src/server/routes/tasks.ts
export const tasksRoutes = new Elysia({ prefix: '/tasks' })
  .use(withAuth())
  .get('/', async ({ user }) => {
    // Route handler
  });
```

### Authentication Context

```typescript
// Must use { as: 'global' } for context propagation
.derive({ as: 'global' }, async ({ cookie, jwt, db, set }) => {
  // Auth logic
  return { user };
})
```

### Logger Usage

```typescript
import { logger } from '../logger';

// ✅ CORRECT - Error object first
logger.error(error, 'Operation failed');

// ❌ WRONG
logger.error('Operation failed', error);
```

## 🗄️ Database Patterns

### Drizzle ORM Best Practices

```typescript
// ❌ WRONG - JSONB fields lost with select
const tasks = await db.select({
  id: tasks.id,
  labels: tasks.labels
}).from(tasks);

// ✅ CORRECT - Get all fields
const rawTasks = await db.select().from(tasks);
const tasks = rawTasks.map(row => ({
  id: row.id,
  labels: row.labels || []
}));
```

### Migrations

```bash
bun run db:generate  # Create migration
bun run db:push      # Apply to database
```

## 📦 Build & Deploy

### Environment Setup

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Production Build

```bash
NODE_ENV=production bun run build
NODE_ENV=production bun run start:prod
```

## ⚡ Performance Tips

1. **Use React Query for server state**
2. **Batch API calls when possible**
3. **Implement proper loading states**
4. **Use WebSocket for real-time updates**
5. **Keep bundle size minimal**

## 🎯 Code Quality Standards

### ESLint Rules
- No `any` types
- No unused variables (prefix with `_`)
- Proper import ordering
- React hooks rules enforced

### Prettier Config
- Single quotes
- No trailing commas
- 2-space indentation
- PandaCSS plugin integrated

---

**Remember**: Always run `bun run lint:fix` and `bun run build` before committing!