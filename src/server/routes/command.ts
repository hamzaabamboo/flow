import { Elysia, t } from 'elysia';
import { withAuth } from '../auth/withAuth';
import { inboxItems, reminders } from '../../../drizzle/schema';
import { commandProcessor } from '../../mastra/agents/commandProcessor';

export const commandRoutes = new Elysia({ prefix: '/command' })
  .use(withAuth())
  // Process a natural language command
  .post(
    '/',
    async ({ body, db, user }) => {
      const { command, space } = body;

      try {
        const result = await commandProcessor.generate([
          {
            role: 'user',
            content: command
          }
        ]);

        const toolCalls = result.toolCalls || [];
        let parsedCommandResult: { action: string; data: Record<string, unknown> } | undefined;
        let parseDateTimeResult: string | undefined;

        for (const toolCall of toolCalls) {
          if (toolCall.toolName === 'parse-task-command') {
            if (commandProcessor.tools.parseTaskCommand?.execute) {
              parsedCommandResult = (await commandProcessor.tools.parseTaskCommand.execute(
                toolCall.args
              )) as { action: string; data: Record<string, unknown> };
            }
          } else if (toolCall.toolName === 'parse-datetime') {
            if (commandProcessor.tools.parseDateTime?.execute) {
              parseDateTimeResult = (await commandProcessor.tools.parseDateTime.execute(
                toolCall.args
              )) as string;
            }
          }
        }

        if (!parsedCommandResult) {
          // If no clear action, add to inbox for manual processing
          const [inboxItem] = await db
            .insert(inboxItems)
            .values({
              title: command,
              space: space as 'work' | 'personal',
              source: 'command',
              userId: user.id
            })
            .returning();

          return {
            success: true,
            action: 'added_to_inbox',
            data: inboxItem
          };
        }

        const { action, data } = parsedCommandResult;

        switch (action) {
          case 'create_task':
            // Add to inbox for user to organize
            const [taskItem] = await db
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
              action: 'task_created',
              data: taskItem
            };

          case 'create_reminder':
            // Parse time from command
            const reminderTime = parseDateTimeResult
              ? new Date(parseDateTimeResult)
              : new Date(Date.now() + 30 * 60 * 1000); // Default to 30 minutes

            const [reminder] = await db
              .insert(reminders)
              .values({
                message: data.message as string,
                reminderTime,
                userId: user.id,
                sent: false
              })
              .returning();

            return {
              success: true,
              action: 'reminder_created',
              data: reminder
            };

          default:
            // Unknown command, add to inbox
            const [unknownItem] = await db
              .insert(inboxItems)
              .values({
                title: command,
                space: space as 'work' | 'personal',
                source: 'command',
                userId: user.id
              })
              .returning();

            return {
              success: true,
              action: 'added_to_inbox',
              data: unknownItem
            };
        }
      } catch (error) {
        console.error('Command processing error:', error);

        // On error, add to inbox as fallback
        const [fallbackItem] = await db
          .insert(inboxItems)
          .values({
            title: command,
            space: space as 'work' | 'personal',
            source: 'command',
            userId: user.id
          })
          .returning();

        return {
          success: true,
          action: 'added_to_inbox',
          data: fallbackItem
        };
      }
    },
    {
      body: t.Object({
        command: t.String(),
        space: t.String()
      })
    }
  );
