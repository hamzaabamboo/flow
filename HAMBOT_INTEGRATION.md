# HamBot Integration - Implementation Summary

## 🎯 Overview

Complete HamBot integration for HamFlow with automatic reminders and daily summaries.

## ✅ What's Implemented

### 1. Database Schema Changes

**Boards Table:**
```typescript
settings: jsonb {
  reminderMinutesBefore?: number;      // Default: 15
  enableAutoReminders?: boolean;        // Default: true
  dailySummaryEnabled?: boolean;        // Default: true
}
```

**Tasks Table:**
```typescript
reminderMinutesBefore: integer  // NULL = use board default, number = override
```

### 2. Core Services

#### `ReminderSyncService` (`src/server/services/reminder-sync.ts`)
- **Purpose**: Automatically manage reminders for tasks
- **Strategy**: Delete-then-create (idempotent)
- **Triggers**: Task create, update, delete
- **Logic**:
  - Deletes unsent reminders for task
  - Checks if reminder needed (has due date, not completed, future date)
  - Gets settings (task override → board setting → default 15min)
  - Creates reminder if auto-reminders enabled
  - Only creates if reminder time is in future

#### `SummaryService` (`src/server/services/summary-service.ts`)
- **Purpose**: Generate daily summaries
- **Morning Summary (10:00 JST)**:
  - Tasks due today
  - Habits to complete
- **Evening Summary (22:00 JST)**:
  - Completed tasks/habits count
  - Unfinished tasks
  - Incomplete habits

### 3. HamBot Integration (`src/server/integrations/hambot.ts`)

**Simplified API:**
```typescript
send(message: string, channel?: string): Promise<boolean>
sendReminder(userId: string, message: string): Promise<boolean>
sendSummary(userId: string, message: string): Promise<boolean>
```

**Configuration (env vars):**
- `HAMBOT_WEBHOOK_URL`: HamBot webhook URL (default: `https://hambot.ham-san.net/webhook/hambot-push`)
- `HAMBOT_API_KEY`: API key for authentication (required)
- `HAMBOT_CHANNEL`: Default channel name (default: `hamflow`)

**Request Format (matches HamBot schema):**
```json
POST https://hambot.ham-san.net/webhook/hambot-push
Headers:
  Content-Type: application/json
  x-hambot-key: {HAMBOT_API_KEY}

Body:
{
  "data": {
    "message": "your message here"
  },
  "channel": "hamflow"
}
```

### 4. Cron Jobs (`src/server/cron.ts`)

All times in JST (UTC+9):

| Job | Schedule | Description |
|-----|----------|-------------|
| `reminder-sender` | Every minute | Sends due reminders via HamBot + WebSocket |
| `morning-summary` | 10:00 JST (01:00 UTC) | Daily agenda for all users |
| `evening-summary` | 22:00 JST (13:00 UTC) | Daily summary for all users |
| `cleanup-old-reminders` | 02:00 UTC daily | Deletes sent reminders older than 30 days |

### 5. Constants (`src/shared/constants.ts`)

```typescript
APP_TIMEZONE = 'Asia/Tokyo'  // JST
MORNING_SUMMARY_HOUR_UTC = 1  // 10:00 JST
EVENING_SUMMARY_HOUR_UTC = 13 // 22:00 JST
DEFAULT_REMINDER_MINUTES_BEFORE = 15
```

## 📋 How It Works

### Automatic Reminder Creation

```
1. User creates/updates task with dueDate
   ↓
2. Task route calls ReminderSyncService.syncReminders()
   ↓
3. Service deletes old unsent reminders
   ↓
4. Service checks: completed? has dueDate? future date?
   ↓
5. Service gets reminder settings (hierarchical)
   - Task.reminderMinutesBefore (if set)
   - OR Board.settings.reminderMinutesBefore
   - OR Default (15 minutes)
   ↓
6. Calculate reminderTime = dueDate - minutes
   ↓
7. Create reminder in DB if time is in future
```

### Reminder Delivery Flow

```
Every minute:
1. Cron checks for reminders where:
   - sent = false
   - reminderTime <= now
   ↓
2. For each reminder:
   - Send via HamBot (if configured)
   - Send via WebSocket (in-app)
   - Mark as sent
```

### Daily Summary Flow

```
At 10:00 JST & 22:00 JST:
1. Get all users from database
   ↓
2. For each user:
   - For work space: generate summary
   - For personal space: generate summary
   - Send via HamBot
```

## 🔧 Integration Points

### Task Routes (`src/server/routes/tasks.ts`)

**POST /api/tasks**
- Creates task
- Calls `reminderSync.syncReminders()`

**PATCH /api/tasks/:id**
- Updates task
- Calls `reminderSync.syncReminders()`

**DELETE /api/tasks/:id**
- Deletes task
- Reminders auto-deleted via CASCADE

## 📝 Message Formats

### Morning Summary
```
🌅 Good Morning! Here's your work agenda for today:

📋 Tasks Due Today (3):
  🔴 Deploy staging - 14:00
  🟠 Team meeting prep - 16:00
  🟡 Code review - 17:00

✅ Habits to Complete (2):
  • Morning exercise
  • Read 30 minutes
```

### Evening Summary
```
🌙 Daily Summary (work):

✅ Completed Today: 5 tasks, 2 habits

⏳ Unfinished Tasks (2):
  🟠 Code review (OVERDUE)
  🟡 Update docs

⏳ Incomplete Habits (1):
  • Read 30 minutes

💪 Keep going! Tomorrow is a new day.
```

### Reminder
```
⏰ Task due in 15 minutes: Deploy staging server
```

## 🚀 Next Steps (Migration)

1. **Generate migration**:
   ```bash
   bun run db:generate
   ```

2. **Apply migration**:
   ```bash
   bun run db:migrate
   ```

3. **Set environment variables** in `.env`:
   ```bash
   HAMBOT_API_KEY=your-api-key-here
   # Optional overrides:
   # HAMBOT_WEBHOOK_URL=https://hambot.ham-san.net/webhook/hambot-push
   # HAMBOT_CHANNEL=hamflow
   ```

4. **Test**:
   - Create a task with due date
   - Check reminders table
   - Wait for reminder time
   - Check HamBot endpoint receives message

## 🔍 Testing Checklist

- [ ] Create task with due date → reminder created
- [ ] Update task due date → reminder updated
- [ ] Complete task → reminder deleted
- [ ] Delete task → reminder deleted
- [ ] Task with board-level setting → uses board default
- [ ] Task with override → uses task setting
- [ ] Morning summary sends at 10:00 JST
- [ ] Evening summary sends at 22:00 JST
- [ ] HamBot endpoint receives correct format

## 📊 Database Queries for Debugging

```sql
-- Check reminders for a task
SELECT * FROM reminders WHERE task_id = 'uuid';

-- Check board settings
SELECT name, settings FROM boards;

-- Check upcoming reminders
SELECT * FROM reminders
WHERE sent = false
AND reminder_time > NOW()
ORDER BY reminder_time;

-- Check sent reminders
SELECT * FROM reminders
WHERE sent = true
ORDER BY reminder_time DESC
LIMIT 10;
```

## ⚠️ Important Notes

1. **Timezone**: Everything is in JST (Asia/Tokyo)
2. **Hierarchical Settings**: Task override → Board setting → Default (15min)
3. **Idempotent Sync**: Safe to call `syncReminders()` multiple times
4. **Cascade Deletes**: DB handles cleanup automatically
5. **Both Spaces**: Summaries sent for work AND personal spaces
6. **WebSocket Fallback**: Reminders sent via WebSocket even if HamBot fails

## 🎯 Future Enhancements

- User-level timezone settings
- Per-user summary preferences
- Reminder snooze functionality
- Digest mode (batch reminders)
- Custom reminder messages
- Notification preferences per space
