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
Output: { "action": "create_task", "title": "deploy staging server" }

Input: "Add task deploy staging to Engineering board"
Output: { "action": "create_task", "title": "deploy staging", "boardId": "<board-id>", "columnId": "<to-do-column-id>", "directToBoard": true }

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
   - create_task: title, optionally boardId/columnId/directToBoard if board/column mentioned
   - create_inbox_item: content
   - create_reminder: message, reminderTime (ISO 8601)
   - complete_task: taskRef
   - move_task: taskRef, destination
   - list_tasks: filter
3. For task creation with board/column context:
   - If user mentions a board or column name, look it up in the provided context
   - Set directToBoard: true, boardId, and columnId accordingly
   - Default to "To Do" column if only board is mentioned
   - If no board mentioned, leave these fields unset (task goes to inbox)
4. For reminders with time expressions:
   - Parse relative times ("in 30 minutes", "tomorrow", "next Friday")
   - Calculate the actual ISO 8601 datetime
   - Current time: ${new Date().toISOString()}
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
