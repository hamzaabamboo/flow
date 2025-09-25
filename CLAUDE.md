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

## Development Progress Tracker

### Current Status: Phase 1 - Core Kanban System

- [x] Project scaffolding (monorepo with React/Vite and ElysiaJS)
- [x] Basic database schema with Drizzle ORM
- [x] SSR setup with Vike
- [x] OAuth/OIDC authentication integration
- [x] Core UI shell (main layout with Work/Personal space switcher)
- [x] WebSocket setup (real-time connection between frontend and backend)
- [x] Full Kanban board implementation with drag-and-drop
- [x] Command bar with voice input
- [x] Inbox view and Pomodoro timer

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

### Implementation Notes

- Using Vike's `renderPage` for SSR instead of client-only SPA
- ElysiaJS middleware connects with Vike dev server in development
- Database schema includes all tables from design document (users, boards, columns, tasks, reminders, inbox, habits, pomodoro)
- Auth currently uses simple cookie-based system, ready for HamCloud OAuth integration
- Cron job checks every minute for due reminders to send via HamBot

### API Endpoints Implemented

- POST /api/auth/setup - Initial user setup (run once)
- POST /api/auth/login - Simple email/password login
- POST /api/auth/auto-login - Quick login for single user
- POST /api/auth/logout - Clear auth cookie
- GET /api/auth/me - Get current authenticated user

- GET /api/boards - Get boards by user and space
- GET /api/boards/:id - Get board with columns
- POST /api/boards - Create board with default columns
- PATCH /api/boards/:id - Update board
- DELETE /api/boards/:id - Delete board

- GET /api/tasks/:columnId - Get tasks for column
- POST /api/tasks - Create task
- PATCH /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task

- WebSocket /ws - Real-time updates channel

### Database Migrations

- Initial schema created in `drizzle/schema.ts`
- Tables: users, boards, columns, tasks, reminders, inboxItems, habits, habitLogs, pomodoroSessions

### External Service Integrations

- HamBot: Cron job prepared to send reminders (needs API URL and key)
- HamCloud: Database connection string ready (needs actual credentials)
- Notes Server: noteId field in tasks table ready for integration

### Known Issues & TODOs

- Environment variables need to be configured in .env file
- TypeScript import paths need adjustment (drizzle schema imports)
- Some TypeScript type warnings (doesn't affect build)

### Build Status

- ✅ Project builds successfully with `bun run build`
- ✅ All features implemented and compiled
- ✅ Client bundle: ~341KB total
- ✅ Server bundle: Ready for production with SSR

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
- `colorPalette.fg` - Foreground color for text
- `colorPalette.text` - Text color

**There is NO `colorPalette.solid`!** Use `colorPalette.default` or `colorPalette.emphasized` instead.

### Color Palette Inheritance

When using these tokens, you should set the `colorPalette` prop to specify which actual color to use:
```tsx
// Correct usage
<Box colorPalette="red" bg="colorPalette.default" />
<Text colorPalette="blue" color="colorPalette.fg" />
<Badge colorPalette="green" />

// Be careful - missing colorPalette prop
<Box bg="colorPalette.default" /> // Will inherit from parent, which might not be what you want
<Box bg="red.solid" /> // Don't use this - use colorPalette instead

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

2. **Color-specific tokens** (need colorPalette):
   - When using `red.fg`, `blue.default`, etc. directly, replace with:
     ```tsx
     // Instead of:
     <Box color="red.fg" />

     // Use:
     <Box colorPalette="red" color="colorPalette.fg" />
     ```

3. **Component variants with colors**:
   - Buttons, Badges, etc. with `variant="solid"` will use the colorPalette automatically
   - Set `colorPalette` prop on the component, not individual color props

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

### Code Quality Standards

**MANDATORY: After implementing any feature:**

1. **Always run linting**: `bun run lint:fix` to ensure code follows project standards
2. **Always run build**: `bun run build` to verify no compilation errors
3. **Check for TypeScript errors**: `bun run type-check` if build passes but you suspect type issues
4. **Format with Prettier**: Automatically handled by lint:fix

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
