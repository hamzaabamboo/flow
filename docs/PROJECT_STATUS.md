# PROJECT STATUS

> **IMPORTANT**: Update this file after every development session with completed tasks, new features, and progress updates.

## Current Phase: Phase 3 Complete ✅

Moving towards Phase 4 - Advanced Features & Integrations

## Latest Updates (2025-10-03)

### ✅ Completed This Session - Part 3 (PWA & UI Polish)

- **PWA Support** - Progressive Web App setup
  - Installed and configured Vite PWA plugin
  - Created app icons and favicon with transparent backgrounds
  - Generated PWA assets (64x64, 192x192, 512x512, maskable icon, apple-touch-icon)
  - Updated logo design with darker colors for better visibility
  - Configured web manifest with app metadata and theme colors
  - Added service worker for offline support
  - Icons use updated logo design: darker H letter (blue 600), lighter speed lines (blue 300), purple checkmark (purple 600)

- **Sidebar Logo & Close Button** - Enhanced mobile navigation
  - Added HamFlow logo to sidebar header (all views)
  - Logo displays at top of sidebar with app name
  - Close button always rendered, visible only in mobile drawer
  - Fixed missing onNavigate prop in personal space mobile drawer
  - Removed unused MobileSidebar component
  - Consistent header layout across work and personal spaces

### ✅ Completed This Session - Part 2 (Quick Wins + Medium Tasks)

#### Quick Wins (< 2 hours each)

- **Sidebar Close Button** - Mobile UX improvement
  - Added X close button to mobile drawer sidebar
  - Uses IconButton with X icon from lucide-react
  - Only shown in mobile view (when `onNavigate` callback is provided)
  - Properly closes drawer when clicked

- **"Send to Inbox" Button for Commands** - Alternative task routing
  - Added "Send to Inbox" button in CommandBar suggestion dialog
  - Only shows for `create_task` actions
  - Forces task to go to inbox instead of board
  - Uses `create_inbox_item` action for execution
  - Navigates to inbox after creation

- **CreateBoardDialog Component** - Reusable board creation
  - Clean dialog component with name and description fields
  - Auto-focus on board name input when opened
  - Integrated into Boards page (`/boards`)
  - Supports optional board description for AI context
  - Success callback navigates to newly created board

- **Time Support in AI Commands** - Enhanced deadline parsing
  - Updated `CommandIntentSchema` to support ISO 8601 format with time
  - AI now parses commands like "tomorrow at 3pm" correctly
  - Backend stores full datetime in `dueDate` field
  - Updated AI instructions to extract and format times

- **Commands Data Refresh Fix** - Proper query invalidation
  - Added `await` to all `invalidateQueries` calls
  - Added calendar query invalidation for task operations
  - Ensures UI updates immediately after command execution

- **Destination Picker in Commands** - User control over task placement
  - Added board/column select dropdowns in CommandBar suggestion
  - Pre-selects AI-suggested board/column
  - Users can override AI suggestion before confirming
  - Auto-selects first column when changing boards
  - Updates task data with user selection

- **Duplicate Task Feature** - Quick task copying
  - Added Copy button in Tasks page actions (blue icon)
  - Creates duplicate with "(Copy)" suffix
  - Copies all metadata: description, priority, due date, labels
  - Resets subtasks to incomplete state
  - Proper query invalidation after duplication

#### Medium Tasks (2-4 hours each)

- **BI-weekly and End of Month Recurring Tasks** - Enhanced recurrence patterns
  - Added "Bi-weekly" option to TaskDialog recurring selector
  - Added "End of Month" option to TaskDialog recurring selector
  - Implemented bi-weekly logic: every 2 weeks on same day of week
  - Implemented end-of-month logic: last day of each month
  - Updated `recurring.ts` utility with proper date calculations
  - Maintains time from original due date

- **Board Description Field + AI Integration** - Intelligent task routing
  - Added `description` text field to boards schema
  - Generated and ran database migration (`0005_fuzzy_selene.sql`)
  - Updated CreateBoardDialog to support description input
  - Command processor fetches board descriptions with board data
  - AI receives board descriptions in context JSON
  - Enhanced AI instructions to use descriptions for smart routing
  - Example: "deploy task" → routes to Engineering board based on description

- **Summary Doesn't Fire Fix** - Cron job debugging
  - Fixed incorrect JSONB query in `sendDailySummaries()`
  - Changed from `eq(users.settings, {...})` to in-memory filtering
  - Fetches all users, filters by `morningSummaryEnabled`/`eveningSummaryEnabled`
  - Properly checks settings object structure
  - Cron jobs now fire correctly at scheduled times

- **Move Tasks Across Boards** - Full task relocation
  - Added "Move to Board" button in Tasks page (purple MoveRight icon)
  - Created Move Task Dialog with board and column selectors
  - Implemented `moveTaskMutation` that updates task's `columnId`
  - Auto-selects current board/column when dialog opens
  - Auto-selects first column when changing target board
  - Proper query invalidation after move operation
  - Dialog shows task title in description

- **Quick Add Bug Fixes** - State management improvements
  - Split useEffect into two separate hooks (focus + cleanup)
  - Reset state only when both dialogs are closed
  - Prevents premature state cleanup when transitioning dialogs
  - More reliable dialog flow and state management

### ✅ Completed This Session - Part 1

- **Quick Add Feature** - AI-powered cheatcode for TaskDialog
  - Quick Add button in top bar with sparkle icon (✨)
  - Keyboard shortcut: Ctrl+N (works on all platforms)
  - Flow: type quick input → AI parses → opens TaskDialog with pre-filled fields
  - AI extracts: title, description, dueDate, priority, labels, board/column
  - Opens full TaskDialog where user can review/edit all fields before creating
  - Reuses existing `/api/command` endpoint for parsing
  - Graceful fallback: opens TaskDialog with raw input as title if AI fails
  - Built with QuickAddDialog component wrapping TaskDialog

- **AI Command Parser (Phase 3) - Enhanced with Board Awareness** - Natural language command processing
  - Integrated Mastra agent with Google Gemini 2.5 Flash Lite model
  - Structured output using Zod schema validation for reliable parsing
  - Actions supported: create_task, create_inbox_item, create_reminder, list_tasks, start/stop_pomodoro
  - **Board-aware context**: AI receives user's boards/columns and maps natural language to IDs
  - **Direct board placement**: Tasks can bypass inbox and go straight to specified board/column
  - Examples: "Add to Engineering board" → Engineering → To Do, "Add to Done" → Board → Done
  - Command history with localStorage persistence (last 20 commands)
  - Arrow key navigation (↑↓) through command history
  - Quick command suggestions when command bar is empty
  - Recent commands section showing last 3 used commands
  - Command bar with dialog-based UI showing parsed intent before execution
  - Voice input support using Web Speech API (cancelable by clicking mic again)
  - Auto-navigation after command execution (direct to board if specified, otherwise tasks/inbox)
  - Defensive JSON parsing to strip markdown code blocks
  - Backend endpoints: `/api/command` (parse with board context), `/api/command/execute` (execute with direct/inbox logic)

- **Inbox System Revamp** - Full inbox processing workflow
  - Modal-based destination selection with visual button grid
  - One-click conversion: inbox items → tasks on selected board/column
  - Batch operations: select multiple items, convert all at once
  - Individual item quick actions (convert, delete) with icon buttons
  - Auto-navigation to board after conversion
  - Pre-selects "To Do" column if available
  - Backend endpoints: `/api/inbox/convert` (item to task), `/api/inbox/delete` (bulk delete)
  - Toast notifications for all actions (success/error feedback)
  - Query invalidation for real-time UI updates

- **Mobile Layout Improvements** - Better responsive design
  - Converted mobile sidebar from overlay to Drawer component (Park UI)
  - Proper drawer animation and backdrop
  - Improved mobile UX with drawer slide-in effect
  - Used SidebarContent component for consistent sidebar rendering

## Previous Updates (2025-10-02)

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
| Recurring Tasks | ✅ | Daily/Weekly/Bi-weekly/Monthly/End-of-Month/Yearly patterns |
| Task Completions | ✅ | Per-instance tracking for recurring |
| Habit Tracking | ✅ | Streaks, timezone-aware completion |
| Calendar Integration | ✅ | iCal feeds with RRULE support |
| Agenda Views | ✅ | Day/Week toggle with navigation |
| WebSocket Sync | ✅ | Real-time updates across entities |
| Space Separation | ✅ | Work/Personal filtering |
| URL State Management | ✅ | Query parameters for views |

### 📋 Phase 4 - In Progress

| Feature | Status | Priority |
|---------|--------|----------|
| HamBot Daily Summaries | ✅ | High - Opt-in morning/evening summaries |
| AI Command Parser | ✅ | High - Natural language processing |
| Universal Inbox | ✅ | High - Quick capture and processing |
| Productivity Analytics | ⏳ | Medium - Charts and insights |
| Focus Mode | ⏳ | Medium - Distraction-free UI |
| Notes Integration | ⏳ | Low - External service |
| Calendar Sync | ⏳ | Low - Google/Outlook OAuth |

## Database Schema

All core tables implemented:
- `users` - Authentication and profiles
- `boards` (with description field), `columns`, `tasks` - Kanban system
- `subtasks` - Task breakdown
- `task_completions` - Recurring task tracking
- `reminders` - Time-based notifications
- `inbox_items` - Quick capture
- `habits`, `habit_logs` - Habit tracking
- `pomodoro_sessions` - Time tracking
- `calendar_integrations` - iCal feed support

**Latest Migration**: `0005_fuzzy_selene.sql` - Added board description field

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

**Last Updated**: 2025-10-03
**Next Review**: Before starting Productivity Analytics feature