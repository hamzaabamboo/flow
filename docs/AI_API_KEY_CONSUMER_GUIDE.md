# AI API Key Consumer Guide

This guide is for AI agents and automation clients consuming HamFlow as an API service using an API key.

## 1) Base URL and Auth

- Base URL (local default): `http://localhost:3000`
- Protected API prefix: `/api`
- Auth header format:

```http
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

HamFlow auth middleware accepts:
- API tokens (recommended for agents)
- HamAuth bearer tokens
- Browser JWT cookies (web app session)

## 2) Get an API Key

Recommended bootstrap:
1. Log into HamFlow web app.
2. Go to Settings -> API Tokens.
3. Create a token and copy it immediately (shown once).
4. Store in your agent secret store.

Programmatic management endpoint (requires existing auth):
- `GET /api/api-tokens`
- `POST /api/api-tokens`
- `DELETE /api/api-tokens/:id`

## 3) Quick Connectivity Check

```bash
BASE_URL="http://localhost:3000"
API_KEY="<PASTE_TOKEN>"

curl -sS "$BASE_URL/api/stats/test" \
  -H "Authorization: Bearer $API_KEY"
```

Expected:

```json
{"test":"working"}
```

## 4) Completion Semantics (Important)

HamFlow treats both column names as completed:
- `Done`
- `Completed`

Task read APIs normalize this for consumers:
- `completed: boolean`
- `completionState: "active" | "completed"`

Use semantic filter:
- `GET /api/tasks?completed=true`
- `GET /api/tasks?completed=false`

Do not hardcode `columnName === "Done"` in agent logic.

## 5) Core API Interfaces for AI Consumers

All routes below are under `/api` unless noted.

### Auth (public, not under grouped `/api` router)
- `GET /api/auth/login`
- `GET /api/auth/callback`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

### Boards and Columns
- `GET /boards`
- `POST /boards`
- `GET /boards/:boardId`
- `PATCH /boards/:boardId`
- `DELETE /boards/:boardId`
- `GET /boards/:boardId/summary`
- `GET /columns/:columnId`
- `POST /columns`
- `PATCH /columns/:columnId`
- `DELETE /columns/:columnId`
- `POST /columns/reorder`

### Tasks and Subtasks
- `GET /tasks`
- `GET /tasks/:id`
- `GET /tasks/column/:id`
- `POST /tasks`
- `PATCH /tasks/:id`
- `POST /tasks/:id/completion`
- `DELETE /tasks/:id`
- `POST /tasks/bulk-complete`
- `POST /tasks/reorder`
- `GET /subtasks/task/:taskId`
- `POST /subtasks`
- `PATCH /subtasks/:id`
- `DELETE /subtasks/:id`
- `POST /subtasks/reorder`

### Agenda / Calendar
- `GET /calendar/feed-url`
- `GET /calendar/events`
- Public iCal feed (no auth): `GET /api/calendar/ical/:userId/:token`

### Inbox, Habits, Pomodoro, Reminders
- Inbox: `GET /inbox`, `POST /inbox`, `POST /inbox/convert`, `POST /inbox/delete`
- Habits: `GET /habits`, `POST /habits`, `PATCH /habits/:id`, `DELETE /habits/:id`, `POST /habits/:id/log`, `GET /habits/:id/stats`
- Pomodoro: `GET /pomodoro`, `POST /pomodoro`, `GET /pomodoro/active`, `POST /pomodoro/active`, `DELETE /pomodoro/active`
- Reminders: `GET /reminders`, `GET /reminders/:id`, `POST /reminders`, `PATCH /reminders/:id`, `DELETE /reminders/:id`

### Search, Stats, Settings, Notes, Command
- Search: `GET /search`
- Stats: `GET /stats/test`, `GET /stats/badges`, `GET /stats/analytics/completions`
- Settings: `GET /settings`, `PATCH /settings`, `GET /settings/shortcuts`, `POST /settings/shortcuts`, `GET /settings/export`, `POST /settings/import`, `POST /settings/test-summary`
- Notes: `GET /notes/enabled`, `GET /notes/collections`, `POST /notes/create`, `POST /notes/search`, `POST /notes/link`, `DELETE /notes/unlink/:taskId`, `GET /notes/:noteId`, `GET /notes/task/:taskId`
- Command: `POST /command`, `POST /command/execute`

### API Tokens and External Calendars
- API tokens: `GET /api-tokens`, `POST /api-tokens`, `DELETE /api-tokens/:id`
- External calendars: `GET /external-calendars`, `POST /external-calendars`, `PATCH /external-calendars/:id`, `DELETE /external-calendars/:id`

### Non-`/api` interfaces
- Webhooks (public): `POST /webhook/hambot`, `POST /webhook/github`
- WebSocket realtime: `GET /ws?token=<jwt>`

## 6) End-to-End Example (cURL)

```bash
BASE_URL="http://localhost:3000"
API_KEY="<TOKEN>"

# 1. Create board
BOARD_ID=$(curl -sS -X POST "$BASE_URL/api/boards" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"AI Board","space":"work"}' | jq -r '.data.id // .id')

# 2. Create columns
TODO_COL=$(curl -sS -X POST "$BASE_URL/api/columns" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"boardId\":\"$BOARD_ID\",\"name\":\"To Do\",\"position\":1}" | jq -r '.data.id // .id')

DONE_COL=$(curl -sS -X POST "$BASE_URL/api/columns" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"boardId\":\"$BOARD_ID\",\"name\":\"Completed\",\"position\":2}" | jq -r '.data.id // .id')

# 3. Create recurring task
TASK_ID=$(curl -sS -X POST "$BASE_URL/api/tasks" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"columnId\":\"$TODO_COL\",\"title\":\"Daily review\",\"recurringPattern\":\"daily\"}" | jq -r '.id')

# 4. Complete recurring instance
TODAY=$(date +%F)
curl -sS -X POST "$BASE_URL/api/tasks/$TASK_ID/completion" \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"completed\":true,\"instanceDate\":\"$TODAY\"}"

# 5. Query semantic completion
curl -sS "$BASE_URL/api/tasks?completed=false" -H "Authorization: Bearer $API_KEY" | jq '.[0]'
curl -sS "$BASE_URL/api/tasks?completed=true" -H "Authorization: Bearer $API_KEY" | jq '.[0]'
```

## 7) Error Patterns

- `401` invalid or missing bearer token.
- `400` validation failure or integration not configured (common in Notes routes).
- `404` missing resource.
- `500` server/integration failure.

## 8) Consumer Validation

Run this to validate full contract as an API consumer:

```bash
bun run scripts/test-endpoints.ts
```

It covers auth, boards, columns, tasks, recurrence, semantic completion fields, stats semantics, calendar/ical, reminders, notes, command, webhooks, and cleanup.
