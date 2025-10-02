# PROJECT STATUS

> **IMPORTANT**: Update this file after every development session with completed tasks, new features, and progress updates.

## Current Phase: Phase 3 Complete ✅

Moving towards Phase 4 - Advanced Features & Integrations

## Latest Updates (2025-10-02)

### ✅ Completed This Session

- **HamBot Daily Summaries** - Opt-in notification system with customization
  - Added user settings for morning/evening summary preferences
  - Settings stored in `users.settings` jsonb field (morningSummaryEnabled, eveningSummaryEnabled, summarySpaces)
  - Cron jobs filter opted-in users at database level (10:00 AM and 10:00 PM JST)
  - Users can choose to receive summaries for work/personal or both spaces combined
  - Morning summary: Tasks due today, upcoming tasks (7 days), with greetings and instance link
  - Evening summary: Completed count, unfinished tasks, incomplete habits, with greetings
  - Tasks/habits show space indicators (💼 work, 🏠 personal)
  - Test functionality in settings page sends actual HamBot messages
  - Shared logic between cron and test endpoint via `sendDailySummary()` function

- **Settings Page UI** - User preferences management
  - Created comprehensive settings page with Park UI Fieldset components
  - Morning/Evening summary toggles (functional)
  - Summary space selector buttons (Work/Personal)
  - Test summary buttons for both morning/evening
  - Disabled unimplemented features with "(Coming soon)" labels
  - Integrated toast notifications using ToasterContext/ToasterProvider

- **Toast System** - Proper notification feedback
  - Created ToasterContext and ToasterProvider based on sample project
  - Created ToastContent component for rendering messages
  - Wrapped app with ToasterProvider in Layout
  - Uses `useToaster()` hook for showing success/error messages

- **Layout Fixes** - Improved scrolling and spacing
  - Fixed page scrolling by removing problematic `minHeight` constraint
  - Simplified layout padding to just `pb="24"`
  - Removed excessive responsive padding combinations

- **Auto-Move Tasks on Completion** - Smart column management
  - When a task is marked complete from Tasks/Agenda pages, it automatically moves to "Done" column
  - When unchecked, task moves back to "To Do" column
  - System auto-creates "Done" and "To Do" columns if they don't exist on the board
  - Backend logic in `src/server/routes/tasks.ts` PATCH endpoint

- **Sidebar Navigation Enhancement** - Active route highlighting
  - Updated sidebar to use `_active` pseudo-class for highlighting active routes
  - Matches sample project NavigationItem pattern with `data-active` attribute
  - Uses `bg: 'bg.emphasized'` for consistent hover and active states

- **Tasks Page Improvements** - Enhanced filters and UI components
  - Refactored task priority picker to use RadioButtonGroup with color coding (green/yellow/orange/red)
  - Moved PriorityBadge component from `/ui` to `/components` (business logic separation)
  - Made task filters responsive with flexbox wrapping
  - Search bar uses `flex="1"` to fill available space
  - Filter group (Priority/Status/Board + view buttons) wraps together as a unit
  - Fixed Select component text wrapping with proper `whiteSpace="nowrap"` on ValueText
  - Adjusted filter widths: Priority 130px, Status 90px, Board 130px
  - Added full date+time display in TaskItem using `Intl.DateTimeFormat`

- **Type System Improvements** - Better TypeScript coverage
  - Extended `ExtendedTask` interface to include CalendarEvent fields (`type`, `space`, `parentTaskId`, `instanceDate`, `link`)
  - Fixed type compatibility between ExtendedTask and CalendarEvent

- **Bug Fixes** - Calendar and recurring tasks
  - Fixed calendar endpoint to show child tasks (removed `parentTaskId` filter)
  - Changed from ISO date strings to UNIX timestamps for date range queries
  - Fixed N+1 query performance issue in boards endpoint using `inArray`
  - Fixed incorrect JOIN in calendar.ts (tasks→columns→boards)
  - Fixed infinite render loop in TaskDialog by properly managing useEffect dependencies

## Previous Updates (2025-10-01)

- **UI/UX Improvements** - Enhanced user interface and navigation
  - Made Agenda the home page (`/`) with Boards moved to `/boards`
  - Added "New Task" button to Agenda page header
  - Fixed week agenda color theming (now uses colorPalette for space-based colors)
  - Standardized page layouts with consistent padding (`p="6"`) and spacing
  - Replaced all loading text with proper Spinner components
  - Changed habit display from full border to left-side accent border (3px)
  - Made day view the default view for Agenda page

- **Task Statistics** - Improved task tracking and visibility
  - Updated stats to show "Todo" (upcoming incomplete tasks) instead of "Tasks Left"
  - Added "Overdue" count (shown in red when > 0)
  - Todo count excludes overdue tasks for better clarity
  - Applied to both Weekly Stats and Daily Stats sections

- **Task Sorting** - Better task organization
  - Tasks page now sorts by deadline first (no deadline goes to end)
  - Secondary sort by priority (urgent > high > medium > low > none)

- **React Query Cache Management** - Fixed space switching issues
  - Updated all `invalidateQueries` to include `currentSpace` in queryKey
  - Fixes board/task data not switching when toggling between work/personal spaces
  - Applied to: boards, tasks, habits, inbox pages

- **Development Mode Enhancement** - Faster local development
  - Added auto-login in development mode (server-side)
  - Works in both API route protection (`withAuth.ts`) and SSR route guard
  - Only active when `NODE_ENV !== 'production'`

### 🚧 In Progress

- None

## Feature Implementation Status

### ✅ Phase 0-3 Complete

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication System | ✅ | OIDC with Keycloak, JWT cookies |
| Route Guards | ✅ | Vike server-side guards |
| Kanban Boards | ✅ | Full CRUD with drag-drop |
| Task Management | ✅ | Labels, priorities, subtasks |
| Recurring Tasks | ✅ | Daily/Weekly/Monthly patterns |
| Task Completions | ✅ | Per-instance tracking for recurring |
| Habit Tracking | ✅ | Streaks, timezone-aware completion |
| Calendar Integration | ✅ | iCal feeds with RRULE support |
| Agenda Views | ✅ | Day/Week toggle with navigation |
| WebSocket Sync | ✅ | Real-time updates across entities |
| Space Separation | ✅ | Work/Personal filtering |
| URL State Management | ✅ | Query parameters for views |

### 📋 Phase 4 - Next Steps

| Feature | Status | Priority |
|---------|--------|----------|
| HamBot Daily Summaries | ✅ | High - Opt-in morning/evening summaries |
| AI Command Parser | ⏳ | High - Natural language processing |
| Productivity Analytics | ⏳ | Medium - Charts and insights |
| Focus Mode | ⏳ | Medium - Distraction-free UI |
| Notes Integration | ⏳ | Low - External service |
| Calendar Sync | ⏳ | Low - Google/Outlook OAuth |

## Database Schema

All core tables implemented:
- `users` - Authentication and profiles
- `boards`, `columns`, `tasks` - Kanban system
- `subtasks` - Task breakdown
- `task_completions` - Recurring task tracking
- `reminders` - Time-based notifications
- `inbox_items` - Quick capture
- `habits`, `habit_logs` - Habit tracking
- `pomodoro_sessions` - Time tracking

## Known Issues

### 🔴 Blocking
- None

### 🟡 Non-blocking
- Some TypeScript warnings in test files
- Badge component size prop only accepts "sm"/"md"/"lg" (not "xs")

### 🟢 Minor
- Some ESLint warnings for dynamic styles
- EventItem component defined but unused
- cSpell warnings for "vike" in guard files

## Build & Test Status

```bash
✅ bun run build       # Passes
✅ bunx tsc --noEmit   # No errors
⚠️  bun run lint       # Some warnings
✅ Dev server          # Running stable
```

## Recent Commits

- `feat: implement OIDC authentication with Keycloak and Vike route guards`
- `fix: timezone-consistent date handling for habits`
- `fix: recurring task completion tracking and migration cleanup`
- `fix: missing routes`

## Deployment Notes

- Database: PostgreSQL with Drizzle ORM
- Runtime: Bun (not Node.js)
- Server: Port 3000 (not 5173)
- Auth: OIDC with Keycloak, JWT in httpOnly cookies
- Route Protection: Vike server-side guards
- Migrations: Squashed into single initial migration

---

**Last Updated**: 2025-10-02
**Next Review**: Before starting AI Command Parser feature