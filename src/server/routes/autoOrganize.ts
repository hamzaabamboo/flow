import { Elysia, t } from 'elysia';
import { eq, and, inArray, gte, lte, or, lt, isNotNull } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { boards, columns, tasks } from '../../../drizzle/schema';
import { autoOrganizer, AutoOrganizeOutputSchema } from '../../mastra/agents/autoOrganizer';
import { nowInJst, getJstDateComponents } from '../../shared/utils/timezone';
import type { AutoOrganizeResponse } from '../../shared/types/autoOrganize';
import type { z } from 'zod';

export const autoOrganizeRoutes = new Elysia({ prefix: '/tasks/auto-organize' })
  .use(withAuth())
  .post(
    '/',
    async ({ body, db, user }) => {
      const { space, boardId, startDate, endDate } = body;

      try {
        // Get current JST time for context
        const jstNow = nowInJst();
        const { year, month, day, hours, minutes, dayOfWeek } = getJstDateComponents(jstNow);
        const dayNames = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday'
        ];
        const currentTimeJst = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+09:00`;

        const timeContext = `\n\n## Current Date and Time\n- Current time (JST): ${currentTimeJst}\n- Current date: ${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}\n- Day of week: ${dayNames[dayOfWeek]}\n\nUse this for calculating all deadline urgency and workload distribution.`;

        // Fetch user's boards and columns
        const whereConditions = [eq(boards.userId, user.id), eq(boards.space, space)];
        if (boardId) {
          whereConditions.push(eq(boards.id, boardId));
        }

        const userBoards = await db
          .select({
            id: boards.id,
            name: boards.name,
            description: boards.description,
            space: boards.space
          })
          .from(boards)
          .where(and(...whereConditions));

        if (userBoards.length === 0) {
          return {
            suggestions: [],
            summary: 'No boards found in this space',
            totalTasksAnalyzed: 0,
            completedTasksSkipped: 0
          } as AutoOrganizeResponse;
        }

        // Fetch all columns for these boards
        const boardIds = userBoards.map((b) => b.id);
        const allColumns = await db
          .select({
            id: columns.id,
            name: columns.name,
            boardId: columns.boardId,
            wipLimit: columns.wipLimit,
            taskOrder: columns.taskOrder
          })
          .from(columns)
          .where(inArray(columns.boardId, boardIds));

        // Build board context with columns
        const boardsWithColumns = userBoards.map((board) => {
          const boardColumns = allColumns.filter((col) => col.boardId === board.id);
          return {
            id: board.id,
            name: board.name,
            description: board.description,
            columns: boardColumns.map((col) => ({
              id: col.id,
              name: col.name,
              wipLimit: col.wipLimit,
              taskCount: 0 // Will be populated below
            }))
          };
        });

        // Fetch all ongoing tasks (exclude completed tasks in "Done" column)
        const taskConditions = [
          eq(tasks.userId, user.id),
          inArray(
            tasks.columnId,
            allColumns.map((c) => c.id)
          )
        ];

        // Optional date range filter for Agenda view
        // IMPORTANT: Include overdue tasks in addition to tasks in date range
        if (startDate && endDate) {
          const now = new Date();
          const dateFilter = or(
            // Tasks within the specified date range
            and(
              gte(tasks.dueDate, new Date(startDate * 1000)),
              lte(tasks.dueDate, new Date(endDate * 1000))
            ),
            // Overdue tasks (past due date)
            and(isNotNull(tasks.dueDate), lt(tasks.dueDate, now))
          );
          if (dateFilter) {
            taskConditions.push(dateFilter);
          }
        } else if (startDate) {
          // If only startDate provided, include overdue + future tasks
          const now = new Date();
          const dateFilter = or(
            gte(tasks.dueDate, new Date(startDate * 1000)),
            and(isNotNull(tasks.dueDate), lt(tasks.dueDate, now))
          );
          if (dateFilter) {
            taskConditions.push(dateFilter);
          }
        } else if (endDate) {
          // If only endDate provided, include all tasks up to that date
          taskConditions.push(lte(tasks.dueDate, new Date(endDate * 1000)));
        }

        const allTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            description: tasks.description,
            dueDate: tasks.dueDate,
            priority: tasks.priority,
            columnId: tasks.columnId,
            labels: tasks.labels,
            recurringPattern: tasks.recurringPattern,
            parentTaskId: tasks.parentTaskId,
            metadata: tasks.metadata,
            createdAt: tasks.createdAt,
            updatedAt: tasks.updatedAt,
            columnName: columns.name,
            boardName: boards.name,
            boardId: boards.id
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .leftJoin(boards, eq(columns.boardId, boards.id))
          .where(and(...taskConditions));

        // Filter out completed tasks (those in "Done" column)
        const ongoingTasks = allTasks.filter((task) => {
          const columnName = task.columnName?.toLowerCase();
          return columnName !== 'done';
        });

        const completedTasksSkipped = allTasks.length - ongoingTasks.length;

        if (ongoingTasks.length === 0) {
          return {
            suggestions: [],
            summary: 'No ongoing tasks found to organize',
            totalTasksAnalyzed: 0,
            completedTasksSkipped
          } as AutoOrganizeResponse;
        }

        // Calculate task counts per column for workload analysis
        const columnTaskCounts = ongoingTasks.reduce(
          (acc, task) => {
            if (task.columnId) {
              acc[task.columnId] = (acc[task.columnId] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        // Update task counts in board context
        boardsWithColumns.forEach((board) => {
          board.columns.forEach((col) => {
            col.taskCount = columnTaskCounts[col.id] || 0;
          });
        });

        // Build rich context for AI
        const boardContext = `\n\n## Board Structure\n${JSON.stringify(boardsWithColumns, null, 2)}`;

        const tasksContext = `\n\n## Ongoing Tasks to Analyze (${ongoingTasks.length} tasks)\n${JSON.stringify(
          ongoingTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            labels: task.labels,
            boardId: task.boardId,
            boardName: task.boardName,
            columnId: task.columnId,
            columnName: task.columnName,
            metadata: task.metadata
          })),
          null,
          2
        )}`;

        const analysisGuidance = `\n\n## Analysis Instructions

Analyze the above tasks and provide intelligent organization suggestions based on:

1. **Deadline Urgency**: Identify tasks due soon that need priority escalation or column movement
2. **Workload Balancing**: Look for overloaded columns (compare taskCount to wipLimit if set)
3. **Content Similarity**: Find related tasks that should be grouped together

For each suggestion:
- Provide a clear, actionable reason
- Include confidence score (only suggest if >= 60)
- Limit to maximum 20 suggestions (prioritize highest confidence)

Focus on changes that will have the most positive impact on productivity.`;

        // Call AI agent for suggestions
        const result = await autoOrganizer.generate<typeof AutoOrganizeOutputSchema>(
          [
            {
              role: 'user',
              content: timeContext + boardContext + tasksContext + analysisGuidance
            }
          ],
          {
            structuredOutput: {
              schema: AutoOrganizeOutputSchema
            }
          }
        );

        const output = result.object;

        if (!output) {
          return {
            suggestions: [],
            summary: 'Failed to generate suggestions',
            totalTasksAnalyzed: ongoingTasks.length,
            completedTasksSkipped
          } as AutoOrganizeResponse;
        }

        // Filter out useless suggestions (same column moves, same priority changes)
        const filteredSuggestions = output.suggestions.filter((suggestion) => {
          const { details } = suggestion;

          // Filter out same-column moves
          if (details.type === 'column_move') {
            if (details.currentColumnId === details.suggestedColumnId) {
              return false; // Same column, useless suggestion
            }
          }

          // Filter out same-priority changes
          if (details.type === 'priority_change') {
            if (details.currentPriority === details.suggestedPriority) {
              return false; // Same priority, useless suggestion
            }
          }

          return true; // Keep suggestion
        });

        // Transform AI output to include 'included' field (default true) for UI state
        const suggestions = filteredSuggestions.map((s) => ({
          ...s,
          included: true // All suggestions included by default
        }));

        return {
          suggestions,
          summary: output.summary,
          totalTasksAnalyzed: ongoingTasks.length,
          completedTasksSkipped
        } as AutoOrganizeResponse;
      } catch (error) {
        console.error('Auto organize error:', error);
        throw new Error('Failed to generate organization suggestions', { cause: error });
      }
    },
    {
      body: t.Object({
        space: t.Union([t.Literal('work'), t.Literal('personal')]),
        boardId: t.Optional(t.String()),
        startDate: t.Optional(t.Number()), // Unix timestamp
        endDate: t.Optional(t.Number()) // Unix timestamp
      })
    }
  );
