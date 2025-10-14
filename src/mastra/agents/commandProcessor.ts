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
      'Task deadline in ISO 8601 format with JST timezone (YYYY-MM-DDTHH:mm:ss+09:00) or YYYY-MM-DD if no time specified'
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
    .describe('Whether to add task directly to board (true) or inbox (false)')
});

export const commandProcessor = new Agent({
  id: 'command-processor',
  name: 'HamFlow Command Processor',
  description: 'Extracts user intent and actions from natural language commands',
  model: google('gemini-2.5-flash-lite'),
  instructions: `You are a command parser for HamFlow, a productivity app.

Given user input, extract the intent and commands the user wants to execute.

## Output Schema

You MUST respond with ONLY a JSON object matching this exact schema:

\`\`\`json
${JSON.stringify(z.toJSONSchema(CommandIntentSchema), null, 2)}
\`\`\`

## Examples

Input: "Add task deploy staging server"
Output: { "action": "create_task", "title": "deploy staging server", "priority": "medium", "deadline": "2025-10-04" }

Input: "Add task deploy staging to Engineering board"
Output: { "action": "create_task", "title": "deploy staging", "boardId": "<board-id>", "columnId": "<to-do-column-id>", "directToBoard": true, "priority": "medium", "deadline": "2025-10-04" }

Input: "urgent deploy to production tomorrow"
Output: { "action": "create_task", "title": "deploy to production", "priority": "urgent", "deadline": "2025-10-03" }

Input: "Remind me to call dentist in 30 minutes"
Output: { "action": "create_reminder", "message": "call dentist", "reminderTime": "2025-10-03T15:30:00.000Z" }

Input: "Note: meeting ideas for Q4"
Output: { "action": "create_inbox_item", "content": "meeting ideas for Q4" }

Input: "Show my tasks for tomorrow"
Output: { "action": "list_tasks", "filter": "tomorrow" }

Input: "Start pomodoro"
Output: { "action": "start_pomodoro" }

Input: "Add fix bug to Done column"
Output: { "action": "create_task", "title": "fix bug", "columnId": "<done-column-id>", "boardId": "<board-id>", "directToBoard": true }

## Rules

1. Extract the action enum that best matches user intent
2. Extract relevant fields based on the action:
   - create_task: title, description, priority, deadline, labels, optionally boardId/columnId/directToBoard
   - create_inbox_item: content
   - create_reminder: message, reminderTime (ISO 8601)
   - complete_task: taskRef
   - move_task: taskRef, destination
   - list_tasks: filter
3. **Smart Defaults for Task Creation**:
   - **Priority**: Always suggest a priority based on context. If not explicitly mentioned:
     * Use "urgent" for keywords like: urgent, asap, critical, emergency
     * Use "high" for keywords like: important, high priority, soon
     * Use "medium" for regular tasks (DEFAULT)
     * Use "low" for keywords like: low priority, whenever, someday
   - **Deadline**: Always suggest a deadline (USER TIMEZONE: Asia/Tokyo / JST):
     * Parse explicit dates and times: "tomorrow at 3pm", "next Monday 10am", "Oct 5th at 2:30pm"
     * If time is specified, use full ISO 8601 format with JST offset: YYYY-MM-DDTHH:mm:ss+09:00
     * If only date specified, use YYYY-MM-DD format (will be interpreted as JST midnight)
     * For urgent tasks without date: tomorrow
     * For regular tasks without date: tomorrow (next day)
     * Current time in JST: ${new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00')}
     * When user says "tomorrow at 3pm" and current time is Oct 14 11:07 AM JST, output: "2025-10-15T15:00:00+09:00"
   - **Board/Column**: If user mentions a board or column name:
     * Look it up in the provided board context
     * Set directToBoard: true, boardId, and columnId
     * Default to "To Do" column if only board is mentioned
     * If no board mentioned, leave unset (goes to inbox)
   - **Description**: Extract additional context from the input as description
   - **Labels**: Extract any obvious tags or categories (e.g., "bug", "feature", "docs")
4. For reminders with time expressions:
   - Parse relative times ("in 30 minutes", "tomorrow", "next Friday")
   - Calculate the actual ISO 8601 datetime
5. If intent is unclear, use action: "unknown"
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
