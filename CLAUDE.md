# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HamFlow is a personalized productivity hub SPA designed to integrate with existing infrastructure services (HamCloud, HamBot, Notes Server). The project is currently in the planning phase with implementation starting.

## Tech Stack

- **Frontend**: React 19 with Vike SSR, PandaCSS + Park UI for styling
- **Backend**: ElysiaJS on Bun runtime for high performance
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSockets (native Elysia support)
- **State Management**: React Query (Tanstack Query)
- **AI**: Mastra framework for command processing
- **Build**: Vite with TypeScript
- **Code Quality**: ESLint + Prettier with PandaCSS rules

## Documentation References

- **ElysiaJS**: Full documentation at https://elysiajs.com/llms-full.txt
- **PandaCSS**: Full documentation at https://panda-css.com/llms-full.txt
- **Park UI**: Component library at https://park-ui.com/
- **Ark UI**: Headless component library that Park UI is built on - https://ark-ui.com/llms-react.txt

## Development Progress Tracker

### Current Status: Phase 2 - Complete ✅

**Phase 1 - Enhanced Board System:**
- [x] Project scaffolding (monorepo with React/Vite and ElysiaJS)
- [x] Basic database schema with Drizzle ORM
- [x] SSR setup with Vike
- [x] OAuth/OIDC authentication integration
- [x] Core UI shell (main layout with Work/Personal space switcher)
- [x] WebSocket setup (real-time connection between frontend and backend)
- [x] Full Kanban board implementation with drag-and-drop
- [x] Command bar with voice input
- [x] Inbox view and Pomodoro timer
- [x] Complete board detail pages with routing
- [x] Task CRUD operations (Create, Read, Update, Delete)
- [x] All Tasks view with filtering and search
- [x] Proper routing structure: /board, /board/:boardId, /board/all
- [x] Datetime support for tasks with countdown timers
- [x] Proper Park-UI Card components implementation
- [x] Fixed colorPalette.fg usage across codebase
- [x] Column management (create, rename, delete, reorder)
- [x] Real-time WebSocket updates for board changes

**Phase 2 - Calendar Integration:**
- [x] iCal feed generation for tasks with due dates
- [x] Calendar events API endpoint with date range filtering
- [x] Agenda view with Day/Week toggle
- [x] Space-based event filtering (Work/Personal)
- [x] Calendar subscription feature (copy iCal URL)
- [x] Task completion from agenda view

### Completed Tasks

- **2025-09-20**: Full Phase 0-1 implementation completed
  - Set up Bun runtime with ElysiaJS backend
  - Configured Vike for SSR with React 19
  - Created database schema with all required tables
  - Implemented simple single-user authentication:
    - JWT token management with 30-day expiry
    - Password hashing with SHA256
    - Auth middleware for protected routes
    - Frontend auth context
    - Auto-login feature for convenience
  - Implemented all core UI components:
    - Work/Personal space switcher with context
    - Full Kanban board with drag-and-drop
    - Command bar with voice input
    - Inbox view for quick capture
    - Pomodoro timer with session tracking
    - Real-time WebSocket sync hooks
  - Created main app layout with React Query integration
  - Updated all API routes to use authenticated user context

- **2025-09-25**: Enhanced Board System implementation + UI/UX Polish
  - Built comprehensive board detail pages with proper Vike routing
  - Implemented complete task CRUD operations:
    - Create tasks with title, description, priority, due date/time
    - Edit/update existing tasks with modal dialogs
    - Delete tasks with confirmation
    - Drag-and-drop task movement between columns
  - Created proper routing structure:
    - `/board` - Lists all boards
    - `/board/:boardId` - Individual Kanban board view
    - `/board/all` - Aggregated view of all tasks
  - Enhanced datetime support:
    - Tasks now support full datetime (not just date)
    - Added countdown timer component showing time remaining/overdue
    - datetime-local inputs for precise task scheduling
  - Major UI/UX improvements:
    - Fixed all Card components to use proper Park-UI structure
    - Implemented Card.Header, Card.Title, Card.Description, Card.Body, Card.Footer
    - Fixed colorPalette.fg usage throughout codebase
    - Established proper color patterns for text and backgrounds
  - Used correct Park-UI styled components for dialogs, selects, popovers
  - Fixed import issues with usePageContext for route parameters

- **2025-09-30**: Phase 1 Final Implementation - Column Management & Real-Time Sync

- **2025-09-30**: Phase 2 Complete - Calendar Integration with iCal
  - **iCal Feed System**:
    - Complete iCal feed generation for tasks, reminders, habits, and pomodoro sessions
    - Token-based authentication for calendar feeds
    - Proper VEVENT/VCALENDAR formatting with all standard fields
    - Feed URL generation endpoint with secure tokens
  - **Calendar Events API**:
    - GET /api/calendar/events endpoint with date range filtering
    - Space-based filtering (Work/Personal)
    - Fixed missing imports (isNotNull, lte) from drizzle-orm
    - In-memory space filtering for reliable results
  - **Enhanced Agenda View**:
    - Day/Week view toggle with proper date navigation
    - Tasks displayed with priority badges and completion checkboxes
    - Space context awareness (shows only relevant space tasks)
    - Calendar subscription button (copies iCal URL to clipboard)
    - Weekly view shows all 7 days with tasks per day
    - Task completion directly from agenda
  - **Browser Testing Verified**:
    - All console errors resolved
    - API returns 200 status with proper task data
    - Space switching works correctly
    - Week/Day views render properly

- **2025-09-30**: Phase 1 Final Implementation - Column Management & Real-Time Sync
  - **Calendar Routes Integration**:
    - Added calendar routes import to server/index.ts
    - iCal feed endpoints now accessible at `/calendar/ical/:userId/:token`
    - Feed URL generation endpoint at `/api/calendar/feed-url`
  - **Full Column Management System**:
    - Verified all API endpoints exist and working (create, update, delete, reorder)
    - KanbanBoard component has complete UI for column operations
    - Column settings dialog with inline editing and WIP limit configuration
    - Drag-and-drop column reordering
    - Validation to prevent deleting columns with tasks
  - **Enhanced Real-Time WebSocket System**:
    - Extended frontend useWebSocket hook to handle all message types
    - Added handlers for: subtask-update, inbox-update, pomodoro-event, reminder-update
    - Server-side WebSocketManager already broadcasting all entity changes
    - Full real-time sync across all features: tasks, columns, boards, subtasks, inbox, pomodoro, reminders
    - Proper reconnection logic with exponential backoff
    - Browser notification support for reminders
  - **TypeScript Code Quality**:
    - Fixed Promise-returning function error in overview page (navigation handler)
    - Removed all 'any' types from command routes
    - Replaced with proper type assertions for Mastra tool execution
    - Zero critical TypeScript compilation errors
  - **API Documentation**:
    - Comprehensive API endpoint list added to CLAUDE.md
    - Organized by feature area (Auth, Boards, Columns, Tasks, Subtasks, etc.)
    - All 40+ endpoints documented with HTTP methods and descriptions

### Implementation Notes

- Using Vike's `renderPage` for SSR instead of client-only SPA
- ElysiaJS middleware connects with Vike dev server in development
- Database schema includes all tables from design document (users, boards, columns, tasks, reminders, inbox, habits, pomodoro)
- Auth currently uses simple cookie-based system, ready for HamCloud OAuth integration
- Cron job checks every minute for due reminders to send via HamBot

### API Endpoints Implemented

**Authentication:**
- POST /api/auth/setup - Initial user setup (run once)
- POST /api/auth/login - Simple email/password login
- POST /api/auth/auto-login - Quick login for single user
- POST /api/auth/logout - Clear auth cookie
- GET /api/auth/me - Get current authenticated user

**Boards:**
- GET /api/boards - Get boards by user and space
- GET /api/boards/:id - Get board with columns
- POST /api/boards - Create board with default columns
- PATCH /api/boards/:id - Update board
- DELETE /api/boards/:id - Delete board

**Columns:**
- GET /api/columns/:columnId - Get column details
- POST /api/columns - Create new column
- PATCH /api/columns/:columnId - Update column (name, position, wipLimit)
- DELETE /api/columns/:columnId - Delete column (only if empty)
- POST /api/columns/reorder - Reorder columns on a board

**Tasks:**
- GET /api/tasks - Get all tasks with filtering (space, search, priority, label, due date, sort)
- GET /api/tasks/:columnId - Get tasks for specific column
- POST /api/tasks - Create task (with labels, subtasks, reminders, recurring patterns)
- PATCH /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task
- POST /api/tasks/reorder - Reorder tasks within a column

**Subtasks:**
- GET /api/subtasks/task/:taskId - Get all subtasks for a task
- POST /api/subtasks - Create subtask
- PATCH /api/subtasks/:id - Update subtask (title, completed, order)
- DELETE /api/subtasks/:id - Delete subtask
- POST /api/subtasks/reorder - Reorder subtasks

**Inbox:**
- GET /api/inbox - Get unprocessed inbox items by space
- POST /api/inbox - Create inbox item

**Pomodoro:**
- GET /api/pomodoro - Get today's pomodoro sessions
- POST /api/pomodoro - Create pomodoro session

**Command Processing:**
- POST /api/command - Process natural language command

**Search:**
- GET /api/search - Universal search across tasks and boards

**Settings:**
- GET /api/settings - Get user settings

**Habits:**
- GET /api/habits - Get all habits
- POST /api/habits - Create habit

**Calendar:**
- GET /api/calendar/feed-url - Get iCal subscription URL
- GET /calendar/ical/:userId/:token - Public iCal feed

**WebSocket:**
- /ws - Real-time updates channel (tasks, columns, boards, subtasks, inbox, pomodoro, reminders)

### Database Migrations

- Initial schema created in `drizzle/schema.ts`
- Tables: users, boards, columns, tasks, reminders, inboxItems, habits, habitLogs, pomodoroSessions

### External Service Integrations

- HamBot: Cron job prepared to send reminders (needs API URL and key)
- HamCloud: Database connection string ready (needs actual credentials)
- Notes Server: noteId field in tasks table ready for integration

### Known Issues & Next Steps

**Minor Issues (Non-blocking):**
- Some TypeScript linting warnings (unused variables with `_` prefix convention)
- Environment variables need to be configured in .env for production
- Some dynamic styling warnings in PandaCSS (non-critical)

**Ready for Phase 2 Features:**
- Calendar sync (Google/Outlook OAuth integration)
- Habits tracking UI and dashboard
- Productivity analytics and charts
- Notes server integration for task details
- Advanced recurring tasks UI
- Focus mode implementation
- Notification preferences UI

#### Completed Tasks (2025-09-25):
- **Enhanced Task Management System**: Fixed all runtime errors and implemented comprehensive CRUD operations
  - Fixed board authorization bug in API route (user ownership verification)
  - Fixed Park-UI Dialog component usage (removed non-existent Header/Body exports)
  - Fixed TypeScript date conversion issues in API routes
  - Completed task CRUD operations with proper forms and validation
  - Added comprehensive task overview page at `/overview` with flexible filtering
  - Implemented bulk operations (toggle complete, delete selected tasks)
  - Added advanced filtering by priority, status, board, and search functionality
  - Created multiple view modes: list view and board grouping view
  - Added task summary cards showing totals, completed, urgent, due today, and overdue
  - Enhanced navigation with Overview page in sidebar
  - All Dialog components now use correct Park-UI structure with Backdrop and Positioner

### Build Status

- ✅ Project builds successfully with `bun run build`
- ✅ All Phase 1 features fully implemented and compiled
- ✅ Client bundle: ~531KB total (comprehensive UI with all features)
- ✅ Server bundle: Ready for production with SSR
- ✅ All runtime issues resolved
- ✅ Full Kanban board system with column management
- ✅ Task overview page with advanced filtering and bulk operations
- ✅ Real-time WebSocket sync for all entities
- ✅ Calendar iCal feed endpoints integrated
- ✅ All TypeScript errors fixed (no 'any' types)
- ✅ Dialog components using correct Park-UI structure

## Project Setup Commands

Since this is a new project, initialize with:

```bash
# Frontend setup
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# Backend setup (in project root)
bun init backend
cd backend
bun add elysia @elysiajs/websocket @elysiajs/cors
```

## Architecture Overview

The application follows a monorepo structure with separate frontend and backend directories:

- `/frontend` - React SPA application
- `/backend` - ElysiaJS API server

### Key Integration Points

1. **HamCloud**: Provides PostgreSQL database and authentication service (JWT-based)
2. **HamBot**: External notification service for Discord/Slack/Telegram alerts via API calls
3. **Notes Server**: External knowledge base for linking detailed documents to tasks

### Core Domain Concepts

- **Spaces**: Work/Personal context separation - all data is filtered by active space
- **Kanban System**: Boards → Columns → Tasks hierarchy
- **Command Processing**: Natural language commands processed via `/command` endpoint
- **Real-time Sync**: WebSocket connections for multi-device synchronization
- **Scheduler Service**: Cron-based reminders triggering HamBot notifications

### Database Schema Core Tables

- `boards` (id, name, space, column_order)
- `columns` (id, board_id, name, task_order)
- `tasks` (id, column_id, title, description, due_date, priority, note_id)
- `inbox_items` (for uncategorized quick capture)
- `habits` and `habit_logs` (for habit tracking)
- `calendar_integrations` (OAuth tokens for Google/Outlook sync)

## Development Phases

Currently implementing Phase 0-1 (Foundation + Core Kanban):

1. Set up monorepo structure
2. Implement HamCloud auth integration
3. Build core Kanban CRUD operations
4. Add drag-and-drop functionality
5. Implement WebSocket real-time sync

## Key Features to Implement

- AI command bar with voice input (Web Speech API)
- Two-way calendar sync (Google Calendar OAuth)
- Pomodoro timer (frontend-only initially)
- Universal Inbox for quick capture
- Focus Mode (UI state management)
- Productivity analytics dashboard

## Park-UI Color System & PandaCSS Styling

### Virtual Color Tokens

**IMPORTANT: When using colorPalette in Park-UI components:**

The available virtual color tokens are:
- `colorPalette.default` - The base color
- `colorPalette.emphasized` - A stronger/darker variant
- `colorPalette.fg` - Foreground color for text (ONLY when background is also colorPalette)
- `colorPalette.text` - Text color

**There is NO `colorPalette.solid`!** Use `colorPalette.default` or `colorPalette.emphasized` instead.

### CRITICAL: colorPalette.fg Usage Rules

**NEVER use `colorPalette.fg` unless the element also has a colorPalette background!**

```tsx
// ✅ CORRECT - colorPalette.fg with colorPalette background
<Box colorPalette="red" bg="colorPalette.default" color="colorPalette.fg" />
<Text colorPalette="blue" color="colorPalette.fg" />

// ❌ WRONG - colorPalette.fg without colorPalette background
<Box bg="bg.muted" color="colorPalette.fg" />
<Text color="colorPalette.fg" />

// ✅ CORRECT - colored text on normal backgrounds
<Text color="red.default">Error text</Text>
<Text color="green.default">Success text</Text>
<Text color="blue.default">Info text</Text>

// ✅ CORRECT - semantic text colors
<Text color="fg.default">Normal text</Text>
<Text color="fg.muted">Muted text</Text>
```

### Color Pattern Decision Tree

1. **Need colored text on normal background?** → Use `color="red.default"`, `color="green.default"`, etc.
2. **Need text on colored background?** → Use `colorPalette="red" bg="colorPalette.default" color="colorPalette.fg"`
3. **Need normal text?** → Use `color="fg.default"`, `color="fg.muted"`, etc.
4. **Component inherits colorPalette from parent?** → Can use `color="colorPalette.fg"`

### Color Palette Inheritance

When using these tokens, you should set the `colorPalette` prop to specify which actual color to use:
```tsx
// Correct usage
<Box colorPalette="red" bg="colorPalette.default" />
<Text colorPalette="blue" color="colorPalette.fg" />
<Badge colorPalette="green" />

// Be careful - missing colorPalette prop
<Box bg="colorPalette.default" /> // Will inherit from parent, which might not be what you want

// If parent has colorPalette="blue", child inherits it
<Box colorPalette="blue">
  <Text color="colorPalette.fg" /> // Uses blue.fg
  <Text colorPalette="red" color="colorPalette.fg" /> // Overrides to use red.fg
</Box>
```

### Work/Personal Mode Theming

The app uses a top-level colorPalette that changes based on the current space (work/personal):
- **Work mode**: `colorPalette="blue"`
- **Personal mode**: `colorPalette="purple"`

This is set at the AppContent level in `+Layout.tsx` and inherited throughout the component tree. All buttons, badges, active states, and accent colors will automatically adapt to the current mode's color.

### Common Color Patterns

1. **Semantic tokens** (don't need colorPalette):
   - `bg.default`, `bg.subtle`, `bg.muted` - Background colors
   - `fg.default`, `fg.muted`, `fg.subtle` - Text colors
   - `border.default`, `border.emphasized` - Border colors

2. **Colored text on normal backgrounds**:
   ```tsx
   // For colored text (stats, status indicators, etc.)
   <Text color="red.default">Urgent tasks</Text>
   <Text color="green.default">Completed</Text>
   <Text color="yellow.default">Due today</Text>
   ```

3. **Component variants with colors**:
   - Buttons, Badges, etc. with `variant="solid"` will use the colorPalette automatically
   - Set `colorPalette` prop on the component, not individual color props

### Park-UI Card Component Structure

**ALWAYS use proper Park-UI Card structure:**

```tsx
<Card.Root width="full">
  <Card.Header>
    <Card.Title>Title Text</Card.Title>
    <Card.Description>Subtitle or description text</Card.Description>
  </Card.Header>
  <Card.Body>
    {/* Main card content */}
  </Card.Body>
  <Card.Footer>
    {/* Action buttons or additional info */}
  </Card.Footer>
</Card.Root>
```

**Key Points:**
- Use `Card.Title` and `Card.Description` inside `Card.Header`
- Keep actions in `Card.Footer` for consistency
- Don't mix custom layouts in header - use the provided components
- Add `width="full"` for responsive cards

### Authentication & Context Issues

**ElysiaJS Context Propagation**:
- When using separate Elysia instances with `.use()`, derived context doesn't automatically propagate
- Solution: Define routes inline within the same group where auth derive is called
- The `apiRoutes.ts` pattern works because auth is derived inside the group:
  ```typescript
  .group('/api', (app) =>
    app
      .derive(async ({ cookie, jwt, db }) => {
        // Auth logic
        return { user };
      })
      .get('/route', ({ user }) => {
        // user is available here
      })
  )
  ```

**JWT & Cookie Setup**:
- Auth middleware needs cookie plugin: `use(cookie())`
- JWT verification returns payload with userId
- User context must be fetched from database using the JWT userId
- Cookie auth token has 30-day expiry

### Vike Routing & Page Parameters

**Route Parameter Access**:
- Use `usePageContext()` from `vike-react/usePageContext` (not `vike/client/router`)
- Access route params via `pageContext.routeParams.paramName`
- Example: `const boardId = pageContext.routeParams.boardId as string`

**Page Configuration**:
- Create `+config.ts` files for each route directory
- Enable client routing: `export default { clientRouting: true, passToClient: ['user', 'space'] }`
- This ensures authentication context passes to client-rendered pages

### Park-UI Component Imports

**Use Styled Components**:
- Import from `src/components/ui/styled/` directory for complex components
- Correct imports:
  ```typescript
  import { Dialog } from '../../components/ui/styled/dialog';
  import { Select } from '../../components/ui/styled/select';
  import { Popover } from '../../components/ui/styled/popover';
  ```
- These provide Root, Trigger, Content, etc. exports that the basic components don't have

## Critical Insights & Patterns Discovered

### 🧠 **Deep Learning from Implementation Experience (2025-09-30)**

**Real-World Development Patterns:**
- **Multiple dev servers pattern**: Running 5+ concurrent `bun run dev` processes indicates heavy development/debugging activity
- **Iterative fixing approach**: Evidence of rapid iteration cycles with immediate HMR feedback
- **Component export standardization**: Need for consistent export patterns across all components

**Architecture Evolution Insights:**
- **Vike routing complexity**: Filesystem-based routing requires exact directory structure matching (`@boardId` vs `:boardId`)
- **Park-UI integration challenges**: Styled components vs basic components create import confusion
- **Context propagation issues**: ElysiaJS derived context doesn't auto-propagate across route groups
- **Color system learning curve**: `colorPalette.fg` usage rules are non-obvious and cause frequent errors

**Performance & Development Experience:**
- **HMR effectiveness**: Hot module replacement working well with 320ms CSS extraction times
- **Build pipeline stability**: PandaCSS codegen + nodemon + Vite integration is solid
- **Error feedback quality**: Vike provides clear routing mismatch tables, making debugging easier
- **WebSocket reliability**: Real-time connections stable with proper disconnect handling

**Component Design Evolution:**
- **Dialog component patterns**: Discovered need for consistent Backdrop + Positioner + Content structure
- **Card component standardization**: Header/Title/Description/Body/Footer structure critical for consistency
- **Export strategy**: Default + named exports cause compilation conflicts - need single pattern
- **File size management**: 400-line file limit requires proactive component splitting

**API Integration Learnings:**
- **Route isolation**: API routes need separate handling from page routes in Vike
- **Authentication flow**: Cookie-based auth with JWT works but needs careful context passing
- **Error handling patterns**: 404s vs 500s reveal different architectural issues
- **Real-time sync**: WebSocket connections need careful lifecycle management

**Developer Experience Insights:**
- **Documentation effectiveness**: Self-updating CLAUDE.md proves essential for complex projects
- **Pattern recognition**: Sample code directory becomes critical reference for consistency
- **Debugging workflow**: Dev server outputs reveal architectural issues faster than code review
- **Type safety impact**: Strict TypeScript prevents runtime errors but requires careful interface design

### 🎯 **Strategic Development Approach**

**Phase-Based Implementation:**
1. **Foundation Phase**: Get basic routing and components working first
2. **Integration Phase**: Connect frontend/backend with proper error handling
3. **Polish Phase**: Fix edge cases, improve UX, optimize performance
4. **Scale Phase**: Add advanced features like real-time sync, bulk operations

**Quality Assurance Strategy:**
- **Continuous validation**: Run `bun run build` after every major change
- **Component testing**: Verify each Park-UI component works in isolation
- **Route testing**: Test all navigation paths manually before moving to next feature
- **Type checking**: Use `bunx tsc --noEmit` for targeted type validation

**Technical Debt Management:**
- **Proactive refactoring**: Split large files before they hit 400 lines
- **Pattern consolidation**: Standardize export patterns across all components
- **Context cleanup**: Ensure all contexts are properly typed and propagated
- **Route optimization**: Consolidate similar routes to reduce configuration overhead

## Development Guidelines

### Self-Update Protocol

**IMPORTANT: Before starting any task, ALWAYS:**

1. Read `design_document.md` to understand the current phase and requirements
2. Review this CLAUDE.md file to check development progress
3. **ALWAYS look at the sample code in `.sample_code_do_not_copy/` directory** for implementation patterns and dependencies
4. Update the relevant sections as you work

### CRITICAL: When User Instructions Are Unclear

**WHEN THE USER SAYS SOMETHING AND YOU DON'T UNDERSTAND OR WHEN INSTRUCTIONS ARE UNCLEAR:**
1. **IMMEDIATELY CHECK THE SAMPLE CODE** in `.sample_code_do_not_copy/` directory
2. Look for similar patterns or implementations in the sample code
3. The sample code shows the CORRECT way to use Park-UI components and patterns
4. If user mentions a component/pattern, it probably exists - CHECK THE UI COMPONENTS DIRECTORY FIRST
5. **READ THE PARK-UI DOCUMENTATION** at https://park-ui.com/docs/components/ for proper component usage

### Continuous Documentation Process

1. **Always update this file** when:
   - Starting a new development phase
   - Implementing a new feature
   - Making architectural decisions
   - Discovering important implementation details
   - Encountering and solving problems
   - Adding new dependencies or tools

2. **Document in the appropriate section**:
   - Mark checkboxes in Current Status when tasks are completed
   - Move completed phase items to Completed Tasks with implementation details
   - Add API endpoints with their purpose and payload structure
   - Record database schema changes with migration notes
   - Note integration requirements and authentication flows
   - Track known issues that need future attention

3. **Cross-reference with design_document.md**:
   - Verify implementation matches the design specifications
   - Check if you're following the correct development phase
   - Ensure consistency with planned architecture
   - Note any deviations from the original plan in Implementation Notes

4. **Development workflow**:
   ```
   1. Read design_document.md → Understand requirements
   2. Read CLAUDE.md → Check current progress
   3. Look at sample code in .sample_code_do_not_copy/ → Follow patterns
   4. Implement feature/fix
   5. Run `bun run lint:fix` → Fix code style issues
   6. Run `bun run build` → Ensure everything compiles
   7. Update CLAUDE.md → Document what was done
   8. If design changes needed → Note in Implementation Notes
   ```

## Step-by-Step Development & Verification Process

### PHASE 1: Understanding Requirements
1. **Read the user's request carefully**
   - Identify what needs to be built/fixed
   - Note any specific requirements or constraints
   - Check if it involves UI, backend, or both

2. **Check existing implementation**
   ```bash
   # Search for related files
   grep -r "feature_name" src/

   # Check component structure
   ls -la src/components/
   ls -la src/pages/

   # Review related API endpoints
   grep -r "api/endpoint" src/server/
   ```

3. **Review sample code**
   - Check `.sample_code_do_not_copy/` for similar patterns
   - Look for Park-UI component examples
   - Study authentication/data flow patterns

### PHASE 2: Planning Implementation
1. **Use TodoWrite tool to track tasks**
   ```typescript
   // Create todo list for complex features
   - Research existing code
   - Design component structure
   - Implement core functionality
   - Add error handling
   - Test implementation
   - Fix any issues
   ```

2. **Identify dependencies**
   - Check if required libraries are installed
   - Verify Park-UI components are available
   - Ensure API endpoints exist or need creation

### PHASE 3: Implementation
1. **Start with component structure**
   ```typescript
   // Always follow this order:
   a. Imports (types first, then React, then libs, then local)
   b. Type definitions/interfaces
   c. Component props interface
   d. Main component function
   e. Helper components (if any)
   f. Export statement
   ```

2. **Follow Park-UI patterns**
   ```typescript
   // For Dialogs:
   <Dialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)}>
     <Dialog.Backdrop />
     <Dialog.Positioner>
       <Dialog.Content>
         <VStack gap="6" p="6">
           <VStack gap="1">
             <Dialog.Title>Title</Dialog.Title>
             <Dialog.Description>Description</Dialog.Description>
           </VStack>
           {/* Content */}
         </VStack>
         <Dialog.CloseTrigger asChild position="absolute" top="2" right="2">
           <IconButton aria-label="Close" variant="ghost" size="sm">
             <X />
           </IconButton>
         </Dialog.CloseTrigger>
       </Dialog.Content>
     </Dialog.Positioner>
   </Dialog.Root>
   ```

3. **Use proper color patterns**
   ```typescript
   // CORRECT:
   <Box colorPalette="blue" bg="colorPalette.default" />
   <Text color="green.default" /> // For semantic colors

   // WRONG:
   <Text colorPalette="blue" color="colorPalette.fg" /> // Only when bg is colorPalette
   ```

### PHASE 4: Verification Steps

1. **Check TypeScript compilation**
   ```bash
   # Run build to catch type errors
   bun run build

   # If errors, check specific file
   bunx tsc --noEmit src/path/to/file.tsx
   ```

2. **Verify component renders**
   ```bash
   # Check dev server is running
   bun run dev

   # Open browser to http://localhost:5173
   # Navigate to the feature
   # Check browser console for errors
   ```

3. **Test functionality**
   - Click all interactive elements
   - Submit forms with valid/invalid data
   - Check responsive behavior
   - Verify state updates correctly
   - Ensure data persists (if applicable)

4. **Validate API integration**
   ```typescript
   // Check network tab in browser DevTools
   // Verify:
   - Request URL is correct
   - Headers include credentials
   - Request payload is properly formatted
   - Response status is 200/201
   - Response data structure matches expectations
   ```

5. **Run linting and formatting**
   ```bash
   # Fix all style issues
   bun run lint:fix

   # Check for remaining warnings
   bun run lint
   ```

### PHASE 5: Common Issues & Solutions

1. **Import errors**
   ```typescript
   // Wrong: import from absolute path
   import { Component } from '/src/components/Component';

   // Correct: relative path
   import { Component } from '../components/Component';

   // Correct: alias (if configured)
   import { Component } from '~/components/Component';
   ```

2. **Park-UI component issues**
   ```typescript
   // If basic component missing features:
   import * as Dialog from '../ui/styled/dialog'; // Use styled version

   // Not:
   import { Dialog } from '../ui/dialog'; // Basic version
   ```

3. **Color system issues**
   ```typescript
   // If colorPalette.fg not working:
   // Check parent has colorPalette prop
   <Box colorPalette="blue">
     <Text color="colorPalette.fg">This works</Text>
   </Box>

   // Without parent colorPalette:
   <Text color="blue.default">Use direct color</Text>
   ```

4. **State management issues**
   ```typescript
   // Always use React Query for server state
   const { data, isLoading, error } = useQuery({
     queryKey: ['resource', id],
     queryFn: async () => {
       const response = await fetch(`/api/resource/${id}`);
       if (!response.ok) throw new Error('Failed');
       return response.json();
     }
   });
   ```

### PHASE 6: Documentation

1. **Update CLAUDE.md after implementation**
   - Add to completed tasks section
   - Document any new patterns discovered
   - Note issues encountered and solutions
   - Update API endpoints list
   - Record any design deviations

2. **Add inline documentation**
   ```typescript
   // Only add comments for complex logic
   // Don't comment obvious code
   // Use JSDoc for public APIs

   /**
    * Formats a date for display in task cards
    * @param date - ISO date string or Date object
    * @returns Formatted string like "Today", "Tomorrow", or "Dec 25"
    */
   function formatTaskDate(date: string | Date): string {
     // Complex logic here
   }
   ```

### PHASE 7: Final Checklist

Before considering a feature complete:

- [ ] All TypeScript errors resolved (no `any` types)
- [ ] Component renders without console errors
- [ ] All interactive elements work as expected
- [ ] Forms validate and submit correctly
- [ ] API calls succeed and handle errors
- [ ] Responsive design works on mobile/desktop
- [ ] Code follows Park-UI patterns
- [ ] Colors use proper semantic tokens
- [ ] Linting passes without errors
- [ ] Build completes successfully
- [ ] CLAUDE.md updated with changes
- [ ] TodoWrite tasks marked complete

### Code Quality Standards

**MANDATORY: After implementing any feature:**

1. **Always run linting**: `bun run lint:fix` to ensure code follows project standards
2. **Always run build**: `bun run build` to verify no compilation errors
3. **Check for TypeScript errors**: `bun run type-check` if build passes but you suspect type issues
4. **Format with Prettier**: Automatically handled by lint:fix

**Component and File Organization - Keep Files Under 400 Lines:**

- **File size limit**: A single file should not exceed 400 lines when possible
- **Component splitting**: When a component or logic file grows too large:
  - Extract reusable components into separate files
  - Split business logic from presentation components
  - Create custom hooks for complex state logic
  - Use composition over inheritance
- **Folder structure**: Group related components together:
  - Place shared components in `/components/ui/`
  - Domain-specific components in `/components/{feature}/`
  - Hooks in `/hooks/`
  - Utilities in `/utils/`
- **Examples of splitting**:
  - Large forms: Split into smaller form sections
  - Complex state: Extract into custom hooks
  - Repeated UI patterns: Create reusable components
  - API calls: Separate into service files

**TypeScript Rules - NEVER USE 'any':**

- **NEVER use the `any` type** - always provide proper TypeScript types
- Use `unknown` when type is truly unknown and add type guards
- Use generics for flexible but type-safe code
- Define explicit interfaces for all data structures
- Use union types for known variants (e.g., `'work' | 'personal'`)
- For third-party libraries without types, create type definitions
- For complex dynamic objects, use `Record<string, unknown>` instead of `any`
- Type all function parameters and return values explicitly

**ESLint Configuration:**

- Uses sample project's ESLint setup with TypeScript, React, and PandaCSS [https://panda-css.com/llms-full.txt] rules

- Components are from Park-UI [https://park-ui.com/] which is based on ark-ui.
- `@typescript-eslint/no-explicit-any` rule enforced - will error on any usage
- Prettier integrated with PandaCSS plugin for consistent formatting
- Single quotes, no trailing commas, 2-space indentation
- Import ordering and unused imports removal
- React hooks and JSX accessibility rules enforced

### Phase Transition Checklist

When completing a development phase:

- [ ] All phase tasks marked complete in Current Status
- [ ] Implementation details documented in Completed Tasks
- [ ] API endpoints and database changes recorded
- [ ] Update Current Status to next phase from design_document.md
- [ ] Note any deviations or improvements discovered
