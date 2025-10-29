import { Agent } from '@mastra/core';
import { z } from 'zod';
import { google } from '@ai-sdk/google';

// Zod schema for AI output
export const CommandIntentSchema = z.object({
  action: z
    .enum([
      'create_task',
      'create_inbox_item',
      'create_reminder',
      'complete_task',
      'move_task',
      'list_tasks',
      'start_pomodoro',
      'stop_pomodoro',
      'unknown'
    ])
    .describe('The action the user wants to perform'),
  title: z.string().optional().describe('Task or item title'),
  description: z.string().optional().describe('Task description or details'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Task priority level'),
  deadline: z
    .string()
    .optional()
    .describe(
      'Task deadline in ISO 8601 format with JST timezone. ALWAYS use YYYY-MM-DDTHH:mm:ss+09:00 format. If no time specified, use T00:00:00+09:00'
    ),
  labels: z.array(z.string()).optional().describe('Task labels or tags'),
  message: z.string().optional().describe('Reminder message'),
  content: z.string().optional().describe('Note or inbox item content'),
  taskRef: z.string().optional().describe('Reference to existing task'),
  destination: z.string().optional().describe('Destination board or column'),
  filter: z.enum(['today', 'tomorrow', 'all']).optional().describe('Task filter for listing'),
  reminderTime: z.string().optional().describe('ISO 8601 datetime string for reminder'),
  boardId: z.string().optional().describe('ID of the board to add task to'),
  columnId: z.string().optional().describe('ID of the column to add task to'),
  directToBoard: z
    .boolean()
    .optional()
    .describe('Whether to add task directly to board (true) or inbox (false)'),
  link: z.string().optional().describe('URL link associated with the task'),
  space: z
    .enum(['work', 'personal'])
    .optional()
    .describe('Which space this task belongs to - work or personal. Required when boards from both spaces are available.')
});

export const commandProcessor = new Agent({
  id: 'command-processor',
  name: 'HamFlow Command Processor',
  description: 'Extracts user intent and actions from natural language commands',
  model: google('gemini-2.5-flash-lite'),
  defaultGenerateOptions: {
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 1024,
          includeThoughts: true
        }
      }
    }
  },
  instructions: `You are a command parser for HamFlow, a productivity app.

Given user input, extract the intent and commands the user wants to execute.

## Current Context

The user will provide the current date and time in their message. Use that for all date calculations.

- **User Timezone**: Asia/Tokyo (JST, UTC+9)

## Output Schema

You MUST respond with ONLY a JSON object matching this exact schema:

\`\`\`json
${JSON.stringify(z.toJSONSchema(CommandIntentSchema), null, 2)}
\`\`\`

## Examples

Input: "Buy CD on 25th"
Output: { "action": "create_task", "title": "Buy CD", "priority": "medium", "deadline": "2025-10-25T00:00:00+09:00" }

Input: "Call mom tomorrow"
Output: { "action": "create_task", "title": "Call mom", "priority": "medium", "deadline": "2025-10-17T00:00:00+09:00" }

Input: "deploy staging server tomorrow at 3pm"
Output: { "action": "create_task", "title": "Deploy staging server", "priority": "medium", "deadline": "2025-10-17T15:00:00+09:00" }

Input: "Fix auth bug on Monday for login flow"
Output: { "action": "create_task", "title": "Fix auth bug", "description": "For login flow", "priority": "medium", "deadline": "2025-10-20T00:00:00+09:00" }

Input: "Add task deploy staging to Engineering board"
Output: { "action": "create_task", "title": "Deploy staging", "space": "work", "boardId": "<board-id>", "columnId": "<to-do-column-id>", "directToBoard": true, "priority": "medium", "deadline": "2025-10-17T00:00:00+09:00" }

Input: "urgent: deploy to production tomorrow with hotfix"
Output: { "action": "create_task", "title": "Deploy to production", "description": "With hotfix", "priority": "urgent", "deadline": "2025-10-17T00:00:00+09:00" }

Input: "Check docs at https://example.com on Monday"
Output: { "action": "create_task", "title": "Check docs", "link": "https://example.com", "priority": "medium", "deadline": "2025-10-20T00:00:00+09:00" }

Input: "Call John at 2pm tomorrow about Q4 planning"
Output: { "action": "create_task", "title": "Call John", "description": "About Q4 planning", "priority": "medium", "deadline": "2025-10-17T14:00:00+09:00" }

Input: "Remind me to call dentist in 30 minutes"
Output: { "action": "create_reminder", "message": "call dentist", "reminderTime": "2025-10-16T15:30:00+09:00" }

Input: "meeting ideas for Q4"
Output: { "action": "create_task", "title": "meeting ideas for Q4", "priority": "medium", "deadline": "2025-10-17" }

Input: "asdfghjkl zzz 123"
Output: { "action": "create_inbox_item", "content": "asdfghjkl zzz 123" }

Input: "Show my tasks for tomorrow"
Output: { "action": "list_tasks", "filter": "tomorrow" }

Input: "Start pomodoro"
Output: { "action": "start_pomodoro" }

Input: "Add fix bug to Done column"
Output: { "action": "create_task", "title": "fix bug", "columnId": "<done-column-id>", "boardId": "<board-id>", "directToBoard": true }

## Rules

1. Extract the action enum that best matches user intent
2. Extract relevant fields based on the action:
   - create_task: title, description, priority, deadline, labels, link, optionally boardId/columnId/directToBoard
   - create_inbox_item: content
   - create_reminder: message, reminderTime (ISO 8601)
   - complete_task: taskRef
   - move_task: taskRef, destination
   - list_tasks: filter
3. **Space Detection** (when boards from both work and personal are available):
   - **Analyze the task content to determine if it's work or personal**:
     * **Work indicators**: deploy, bug, feature, API, database, meeting, project, client, code, review, PR, production, staging, server, development, testing, documentation
     * **Personal indicators**: buy, shopping, groceries, chores, errands, home, family, personal, hobby, exercise, health, appointment, cleaning, cooking
     * Set the "space" field to "work" or "personal" based on content analysis
     * Examples:
       - "deploy staging" → space: "work"
       - "fix login bug" → space: "work"
       - "buy milk" → space: "personal"
       - "call dentist" → space: "personal"
       - "review PR #123" → space: "work"
   - **If ambiguous**: default to "work" for technical/professional tasks, "personal" for life tasks
4. **Smart Board Routing** (BE AGGRESSIVE):
   - **Always try to match task to a board** - don't be conservative!
   - **When user explicitly mentions board/column name**:
     * Set directToBoard: true, boardId, columnId, space
     * Example: "add deploy to Engineering board" → use Engineering board
   - **When user doesn't mention board** (USE THIS MOST OF THE TIME):
     * First determine the space (work or personal) if both are available
     * Analyze task content (title + any description) against board names and descriptions IN THAT SPACE
     * Look for ANY keyword overlap or semantic similarity
     * Match with 50%+ confidence is good enough - be flexible!
     * Set directToBoard: true, boardId, columnId, space (default to "To Do" or first column)
     * **Common patterns to match**:
       - Technical terms (deploy, bug, feature, API, database) → Engineering/Development boards in work space
       - Content terms (blog, post, article, video, content) → Content/Marketing boards in work space
       - Personal terms (buy, groceries, chores, errands) → Personal boards in personal space
       - Work project keywords → matching project board in work space
     * **Examples**:
       - "deploy staging" → space: "work", matches Engineering board → route there
       - "fix auth bug" → space: "work", matches Engineering board → route there
       - "write blog post" → space: "work", matches Content board → route there
       - "buy milk" → space: "personal", matches Errands board → route there
   - **Only send to inbox if**:
     * NO boards exist for the detected space, OR
     * Task is extremely vague/unclear, OR
     * Truly no reasonable match found (rare!)
5. **Task Title & Description Best Practices**:
   - **Title**: Should be clean, concise, and understandable at a glance
     * Remove time/date info from title (goes in deadline field)
     * Remove priority keywords (goes in priority field)
     * Remove board/column names (goes in boardId/columnId)
     * Keep only the core action/task name
     * Examples:
       - "deploy staging tomorrow at 3pm" → title: "Deploy staging"
       - "urgent: fix auth bug" → title: "Fix auth bug"
       - "review PR #123 for user management feature" → title: "Review PR #123"
       - "buy milk and eggs from store" → title: "Buy milk and eggs"
   - **Description**: Put additional context and details here
     * If user provides extra context, put it in description
     * If task mentions specific items/requirements, elaborate in description
     * Examples:
       - "review PR #123 for user management feature" → description: "User management feature"
       - "call John about Q4 planning meeting" → description: "About Q4 planning meeting"
       - "deploy staging with new auth changes" → description: "With new auth changes"
     * Leave empty if no extra context provided
6. **Smart Defaults for Task Creation**:
   - **Priority**: Always suggest a priority based on context. If not explicitly mentioned:
     * Use "urgent" for keywords like: urgent, asap, critical, emergency
     * Use "high" for keywords like: important, high priority, soon
     * Use "medium" for regular tasks (DEFAULT)
     * Use "low" for keywords like: low priority, whenever, someday
   - **Deadline**: Always suggest a deadline (USER TIMEZONE: Asia/Tokyo / JST):
     * **Relative dates**: Parse "on 5th", "on 25th", "on the 15th" as day of current/next month
     * **Weekdays**: "Monday", "next Monday", "this Friday" - find next occurrence
     * **Relative**: "tomorrow", "next week", "in 3 days", "2 weeks from now"
     * **End of day**: "end of today", "by end of day", "eod" - use 23:59:00 of current date
     * **Start of day**: "tomorrow", "start of tomorrow" - use 00:00:00 of next date
     * **Explicit dates**: "Oct 5th", "October 25", "2025-10-20", "10/25"
     * **With time**: "tomorrow at 3pm", "Monday 10am", "on 25th at 2:30pm"
     * **Date calculation**:
       - Use the current date/time provided in the message context
       - If user says "end of today" at 1:00 AM Oct 22, output: "2025-10-22T23:59:00+09:00" (same day!)
       - If user says "tomorrow" at 1:00 AM Oct 22, output: "2025-10-23T00:00:00+09:00"
       - If user says "on 25th" and today is Oct 16, output: "2025-10-25T00:00:00+09:00"
       - If user says "on 5th" and today is Oct 16, output: "2025-11-05T00:00:00+09:00" (next month)
       - If user says "Monday" and today is Wednesday, output next Monday's date with time
     * **Format** (ALWAYS include timezone):
       - Date only (no time specified): YYYY-MM-DDTHH:mm:ss+09:00 with time set to 00:00:00
       - End of day: YYYY-MM-DDTHH:mm:ss+09:00 with time set to 23:59:00
       - With time: YYYY-MM-DDTHH:mm:ss+09:00 (e.g., "2025-10-25T14:30:00+09:00")
       - **CRITICAL**: NEVER use YYYY-MM-DD format, always include T00:00:00+09:00 at minimum
     * For urgent tasks without date: use tomorrow with 00:00:00+09:00
     * For regular tasks without date: use tomorrow with 00:00:00+09:00
   - **Links**: Extract URLs from the input:
     * Look for http://, https://, www. patterns
     * Common patterns: "at <url>", "link: <url>", "see <url>", "<url> for details"
     * Remove URL from title/description after extraction
     * Example: "Check docs at https://example.com" → title: "Check docs", link: "https://example.com"
   - **Board/Column**: If user mentions a board or column name:
     * Look it up in the provided board context
     * Set directToBoard: true, boardId, and columnId
     * Default to "To Do" column if only board is mentioned
     * If no board mentioned, leave unset (goes to inbox)
   - **Description**: Extract additional context from the input as description
   - **Labels**: Extract any obvious tags or categories (e.g., "bug", "feature", "docs")
4. **For reminders with time expressions**:
   - Parse relative times ("in 30 minutes", "in 2 hours", "tomorrow", "next Friday")
   - Calculate the actual ISO 8601 datetime with JST timezone
   - Use format: YYYY-MM-DDTHH:mm:ss+09:00
5. **Intent Detection** (SIMPLE RULES):
   - Contains "remind", "reminder", "remind me" → **create_reminder**
   - Everything else (any actionable item, task, todo) → **create_task**
   - ONLY if completely unparseable or cryptic gibberish → **create_inbox_item**
   - Special cases:
     * "show", "list", "view" tasks → list_tasks
     * "start pomodoro" → start_pomodoro
     * "stop pomodoro" → stop_pomodoro
6. **IMPORTANT**: Output ONLY the JSON object, no explanations before or after

## JSON Validation

- Ensure all brackets are properly matched
- Ensure all strings are properly escaped
- No trailing commas
- Valid ISO 8601 format for reminderTime
- **CRITICAL**: Output ONLY the raw JSON object, with NO markdown code blocks, NO backticks, NO explanatory text before or after
- DO NOT wrap the JSON in \`\`\`json or \`\`\` blocks
- The output should start with { and end with }
- Return valid, parseable JSON only`
});
