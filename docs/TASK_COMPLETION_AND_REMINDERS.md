# Task Completion, Recurrence, Reminders, and Calendar Consistency

## Completion Semantics

HamFlow treats `Done` and `Completed` columns as semantic completion states for non-recurring tasks.

- API responses expose normalized `completed` and `completionState` fields.
- Backend storage for non-recurring tasks still uses semantic column transitions underneath.

## Recurring Tasks

Recurring task instances are tracked per date in `task_completions`.

For recurring tasks:
- Completing/uncompleting an instance writes/removes a `task_completions` row.
- Parent task column does not move during instance completion.

## Task Completion Endpoints

### Normalized Completion Fields (Consumer Contract)

Task read endpoints expose normalized completion fields so consumers do not need to infer from raw column names:
- `completed: boolean`
- `completionState: "active" | "completed"`

Applied to:
- `GET /tasks`
- `GET /tasks/column/:id`
- `GET /tasks/:id`
- `GET /calendar/events` (task events)

### `GET /tasks`

Supports semantic completion filtering:
- `completed=true`
- `completed=false`

This filter is semantic and treats both `Done` and `Completed` columns as completed.

### `PATCH /tasks/:id`

Supports normal task updates plus completion toggle.

Body fields:
- `completed?: boolean`
- `instanceDate?: string` (`YYYY-MM-DD` recommended for recurring tasks)

Behavior:
- Non-recurring tasks: semantic column transition.
- Recurring tasks: instance completion log update.

### `POST /tasks/:id/completion`

Dedicated endpoint for completion-only operations.

Request body:
```json
{
  "completed": true,
  "instanceDate": "2026-03-10"
}
```

Response:
- Recurring tasks: `{ recurring: true, taskId, columnId, completed, instanceDate }`
- Non-recurring tasks: `{ recurring: false, task: ... }`

### `POST /tasks/bulk-complete`

Request body:
```json
{
  "taskIds": ["task-1", "task-2"],
  "completed": true,
  "instanceDate": "2026-03-10"
}
```

Behavior:
- Recurring tasks in the batch use instance completion logs.
- Non-recurring tasks use semantic column transitions.

## Reminder Fanout

Task reminders are generated for future due dates at:
- 1 day before
- 6 hours before
- 3 hours before
- 1 hour before
- 15 minutes before
- due time

If a custom `reminderMinutesBefore` exists, it is added to the set and deduplicated.

If all computed reminder times are already in the past while due date is still in the future, a fallback immediate reminder is scheduled for `now + 1 minute`.

## iCal Deadline Rendering

If a task due date is exactly midnight in JST (`00:00:00 JST`), the iCal event is exported as an all-day event (`VALUE=DATE`) for that JST day.

This fixes date-only deadlines showing as timed events and keeps Agenda + iCal behavior aligned.

## Auto-Organize Consistency

Auto-organize uses the same semantic completion detection before generating suggestions, so completed tasks are consistently excluded from re-organization.
