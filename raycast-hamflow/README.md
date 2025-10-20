# HamFlow Raycast Extension

Manage your HamFlow tasks, agenda, and productivity directly from Raycast.

## Features

### 🤖 AI Command
- Create tasks and reminders using natural language
- Powered by HamFlow's built-in AI command processor
- Examples:
  - "deploy staging tomorrow at 3pm high priority"
  - "remind me to call dentist in 30 minutes"
  - "add fix bug to Engineering board"

### 📅 Today's Agenda
- View today's tasks and habits grouped by time
- See overdue items, morning, afternoon, and evening tasks
- Quick complete actions
- Visual priority indicators

### ✨ Quick Add Task
- Fast task creation with a simple form
- Set title, description, due date/time, and priority
- Create multiple tasks in succession
- Tasks go to inbox by default

### 📋 View All Tasks
- Browse all your tasks with powerful filters
- Search by title or description
- Filter by space (work/personal) and priority
- Mark complete or delete tasks
- Open tasks directly in HamFlow

## Setup

### 1. Get Your API Token

1. Open HamFlow in your browser
2. Go to **Settings** → **API Tokens**
3. Click **Create Token**
4. Give it a name (e.g., "Raycast")
5. **Copy the token immediately** (you won't see it again!)

### 2. Configure Raycast Extension

1. Open Raycast preferences
2. Find the HamFlow extension
3. Enter your settings:
   - **API Token**: Paste the token from step 1
   - **Server URL**: Your HamFlow instance URL (e.g., `https://hamflow.yourdomain.com`)
   - **Default Space**: Choose `work` or `personal`

### 3. Start Using!

Type any of these commands in Raycast:
- `AI Command` - Natural language task creation
- `Today's Agenda` - View today's schedule
- `Quick Add Task` - Fast task entry
- `View All Tasks` - Browse and manage tasks

## Requirements

- HamFlow instance (production deployment)
- API token (generated from HamFlow Settings)
- Raycast (macOS)

## Shortcuts

- **Create & Add Another**: `⌘N` (in Quick Add)
- **Mark Complete**: `⌘E` (in View Tasks)
- **Delete Task**: `⌘⌫` (in View Tasks)
- **Refresh**: `⌘R` (in any list view)
- **Open in HamFlow**: `⌘O`

## Troubleshooting

### "Authentication required" error
- Check that your API token is valid
- Go to HamFlow Settings → API Tokens to verify
- Create a new token if needed

### "Connection failed" error
- Verify your Server URL is correct
- Ensure your HamFlow instance is accessible
- Check that you're using `https://` (not `http://`)

### Tasks not appearing
- Refresh the list with `⌘R`
- Check your space filter (work/personal)
- Verify tasks exist in HamFlow web app

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build extension
npm run build

# Lint code
npm run lint
```

## Support

For issues or questions:
1. Check HamFlow documentation at your instance's `/docs`
2. Verify API token is active in Settings
3. Test API connection in browser: `https://your-instance.com/api/tasks` (with Bearer token)

## License

MIT
