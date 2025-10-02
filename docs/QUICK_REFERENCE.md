# Quick Reference Guide

## 🔥 Critical Reminders

1. **Port is 3000**: Dev server runs on `http://localhost:3000` NOT 5173!
2. **No 'any' Types**: Always use proper TypeScript types
3. **Props Stay, Models Move**: Component props in files, data models in shared/types
4. **Use Styled Components**: Import from `ui/styled/` not `ui/` for complex components
5. **Global Auth Context**: Use `{ as: 'global' }` in derive for auth propagation
6. **Logger Error First**: `logger.error(error, 'message')` not the reverse
7. **Invalidate Queries**: Always `queryClient.invalidateQueries()` after mutations
8. **Mastra Structured Output**: Use `generateVNext` with `structuredOutputs: true`

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

## ⚡ Common Gotchas

1. **Vite HMR Issues**: Restart dev server if hot reload stops working
2. **Type Errors**: Run `bunx tsc --noEmit` before committing
3. **Database Changes**: Always generate AND apply migrations
4. **WebSocket Issues**: Check if port 3000 is already in use
5. **Build Failures**: Clear cache with `rm -rf .vite/ dist/`

## 🎯 Quick Wins

- Use `logger` from `shared/logger` for consistent logging
- Import components from `ui/styled/` for better TypeScript support
- Use React Query for all data fetching (no manual fetch calls)
- Prefer Drizzle query builder over raw SQL
- Always handle errors with proper error boundaries