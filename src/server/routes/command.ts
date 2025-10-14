import { Elysia, t } from 'elysia';
import type { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { inboxItems, reminders, boards, columns, tasks } from '../../../drizzle/schema';
import type { CommandIntentSchema } from '../../mastra/agents/commandProcessor';
import { commandProcessor } from '../../mastra/agents/commandProcessor';
import { jstToUtc } from '../../shared/utils/timezone';

export const commandRoutes = new Elysia({ prefix: '/command' })
  .use(withAuth())
  // Process a natural language command and return suggestion
  .post(
    '/',
    async ({ body, db, user }) => {
      const { command, space } = body;

      try {
        // Fetch user's boards and columns for context
        const userBoards = await db
          .select({
            id: boards.id,
            name: boards.name,
            description: boards.description,
            space: boards.space
          })
          .from(boards)
          .where(and(eq(boards.userId, user.id), eq(boards.space, space as 'work' | 'personal')));

        let boardContext = '';
        if (userBoards.length > 0) {
          const boardIds = userBoards.map((b) => b.id);
          const allColumns = await db
            .select({
              id: columns.id,
              name: columns.name,
              boardId: columns.boardId
            })
            .from(columns)
            .where(inArray(columns.boardId, boardIds));

          // Build context string
          const boardsWithColumns = userBoards.map((board) => {
            const boardColumns = allColumns.filter((col) => col.boardId === board.id);
            return {
              id: board.id,
              name: board.name,
              description: board.description,
              columns: boardColumns.map((col) => ({ id: col.id, name: col.name }))
            };
          });

          boardContext = `\n\n## User's Boards and Columns\n${JSON.stringify(boardsWithColumns, null, 2)}\n\nIf the user specifies a board or column name, map it to the corresponding ID. Use board descriptions to understand what each board is for and intelligently route tasks. For example, if a user says "add deploy task" and the Engineering board has description "Software development and deployments", route it there. When creating tasks, you can suggest adding them directly to a specific column by setting "directToBoard": true, "boardId": "<board-id>", and "columnId": "<column-id>". Otherwise, tasks will go to the inbox for manual processing.`;
        }

        const result = await commandProcessor.generateVNext(
          [
            {
              role: 'user',
              content: command + boardContext
            }
          ],
          {
            providerOptions: {
              google: {
                structuredOutputs: true
              }
            }
          }
        );

        // AI returns structured output via Zod schema
        let intent: z.infer<typeof CommandIntentSchema> | null = null;
        if (result.text) {
          // Strip markdown code blocks if present (defensive)
          const cleanedText = result.text
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/, '')
            .replace(/```\s*$/, '')
            .trim();
          intent = JSON.parse(cleanedText) as z.infer<typeof CommandIntentSchema>;
        }

        if (!intent || intent.action === 'unknown') {
          return {
            action: 'create_inbox_item',
            data: { title: command },
            description:
              'Could not understand command. Will be added to inbox for manual processing.'
          };
        }

        // Build response based on action
        switch (intent.action) {
          case 'create_task':
            // Check if AI wants to add directly to board
            if (intent.directToBoard && intent.boardId && intent.columnId) {
              // Find board and column names for better UX
              const [targetBoard] = await db
                .select({ name: boards.name })
                .from(boards)
                .where(eq(boards.id, intent.boardId));
              const [targetColumn] = await db
                .select({ name: columns.name })
                .from(columns)
                .where(eq(columns.id, intent.columnId));

              return {
                action: 'create_task',
                data: {
                  title: intent.title || command,
                  description: intent.description,
                  priority: intent.priority,
                  deadline: intent.deadline,
                  labels: intent.labels,
                  boardId: intent.boardId,
                  columnId: intent.columnId,
                  directToBoard: true
                },
                description: `Task "${intent.title || command}" will be added to ${targetBoard?.name || 'board'} → ${targetColumn?.name || 'column'}`
              };
            }

            return {
              action: 'create_task',
              data: {
                title: intent.title || command,
                description: intent.description,
                priority: intent.priority,
                deadline: intent.deadline,
                labels: intent.labels
              },
              description: `Task "${intent.title || command}" will be added to your inbox`
            };

          case 'create_inbox_item':
            return {
              action: 'create_inbox_item',
              data: { title: intent.content || command },
              description: `Note will be added to inbox: "${intent.content || command}"`
            };

          case 'create_reminder':
            const reminderTime =
              intent.reminderTime || new Date(Date.now() + 30 * 60 * 1000).toISOString();
            const reminderDate = new Date(reminderTime);

            return {
              action: 'create_reminder',
              data: {
                message: intent.message || command,
                reminderTime
              },
              description: `Reminder "${intent.message}" will be sent at ${reminderDate.toLocaleString()}`
            };

          case 'complete_task':
          case 'move_task':
          case 'list_tasks':
          case 'start_pomodoro':
          case 'stop_pomodoro':
            return {
              action: intent.action,
              data: intent,
              description: `Action: ${intent.action}`
            };

          default:
            return {
              action: 'create_inbox_item',
              data: { title: command },
              description: 'Will be added to inbox for processing'
            };
        }
      } catch (error) {
        console.error('Command processing error:', error);
        return {
          action: 'create_inbox_item',
          data: { title: command },
          description: 'Failed to parse command. Will be added to inbox.'
        };
      }
    },
    {
      body: t.Object({
        command: t.String(),
        space: t.String()
      })
    }
  )
  // Execute the confirmed action
  .post(
    '/execute',
    async ({ body, db, user }) => {
      const { action, data, space } = body;

      try {
        switch (action) {
          case 'create_task':
            // Check if task should go directly to board
            if (data.directToBoard && data.boardId && data.columnId) {
              const taskData: {
                columnId: string;
                title: string;
                userId: string;
                description?: string;
                priority?: string;
                dueDate?: Date;
                labels?: string[];
              } = {
                columnId: data.columnId as string,
                title: data.title as string,
                userId: user.id
              };

              if (data.description) taskData.description = data.description as string;
              if (data.priority) taskData.priority = data.priority as string;
              if (data.deadline) {
                // Handle both full datetime (with timezone) and date-only formats
                const deadlineStr = data.deadline as string;
                if (deadlineStr.includes('T')) {
                  // Full datetime - Date constructor handles timezone correctly
                  taskData.dueDate = new Date(deadlineStr);
                } else {
                  // Date only (YYYY-MM-DD) - interpret as JST midnight
                  taskData.dueDate = jstToUtc(`${deadlineStr}T00:00:00`);
                }
              }
              if (data.labels && Array.isArray(data.labels))
                taskData.labels = data.labels as string[];

              const [task] = await db.insert(tasks).values(taskData).returning();

              return {
                success: true,
                data: task,
                boardId: data.boardId
              };
            }

            // Otherwise add to inbox with metadata
            const inboxData: {
              title: string;
              space: 'work' | 'personal';
              source: string;
              userId: string;
              description?: string;
            } = {
              title: data.title as string,
              space: space as 'work' | 'personal',
              source: 'command',
              userId: user.id
            };

            // Store task metadata in description for later processing
            if (data.description || data.priority || data.deadline || data.labels) {
              const metadata = {
                description: data.description,
                priority: data.priority,
                deadline: data.deadline,
                labels: data.labels
              };
              inboxData.description = JSON.stringify(metadata);
            }

            const [taskInbox] = await db.insert(inboxItems).values(inboxData).returning();

            return {
              success: true,
              data: taskInbox
            };

          case 'create_inbox_item':
            const [inboxItem] = await db
              .insert(inboxItems)
              .values({
                title: data.title as string,
                space: space as 'work' | 'personal',
                source: 'command',
                userId: user.id
              })
              .returning();

            return {
              success: true,
              data: inboxItem
            };

          case 'create_reminder':
            const [reminder] = await db
              .insert(reminders)
              .values({
                message: data.message as string,
                reminderTime: new Date(data.reminderTime as string),
                userId: user.id,
                sent: false
              })
              .returning();

            return {
              success: true,
              data: reminder
            };

          default:
            throw new Error('Unknown action');
        }
      } catch (error) {
        console.error('Command execution error:', error);
        throw error;
      }
    },
    {
      body: t.Object({
        action: t.String(),
        data: t.Record(t.String(), t.Any()),
        space: t.String()
      })
    }
  );
