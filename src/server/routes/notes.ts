import { Elysia, t } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '../auth/withAuth';
import { tasks, users } from '../../../drizzle/schema';
import { wsManager } from '../websocket';
import { createOutlineClient } from '../services/outline-client';
import { successResponse, errorResponse } from '../utils/errors';
import { logger } from '../logger';

export const notesRoutes = new Elysia({ prefix: '/notes' })
  .use(withAuth())
  // Check if notes integration is enabled
  .get('/enabled', async ({ db, user }) => {
    // Check if user has Outline configured
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

    return {
      enabled: userClient?.isEnabled() ?? false,
      configured: !!(dbUser?.settings?.outlineApiUrl && dbUser?.settings?.outlineApiKey)
    };
  })
  // List available collections
  .get('/collections', async ({ db, user, set }) => {
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
    const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

    if (!userClient || !userClient.isEnabled()) {
      set.status = 400;
      return errorResponse('Outline integration is not configured');
    }

    try {
      const collections = await userClient.listCollections();
      return successResponse(collections);
    } catch (error) {
      logger.error({ error }, 'Failed to list Outline collections');
      set.status = 500;
      return errorResponse(error instanceof Error ? error.message : 'Failed to list collections');
    }
  })
  // Create a new note and optionally link it to a task
  .post(
    '/create',
    async ({ body, db, user, set }) => {
      // Get user's Outline client
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
      const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

      if (!userClient || !userClient.isEnabled()) {
        set.status = 400;
        return errorResponse('Outline integration is not configured');
      }

      try {
        const { title, text, taskId, collectionId } = body;

        // Create document in Outline
        const document = await userClient.createDocument({
          title,
          text,
          collectionId,
          publish: true
        });

        // If taskId provided, link the note to the task
        if (taskId) {
          // Verify task ownership
          const [task] = await db
            .select({ id: tasks.id })
            .from(tasks)
            .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

          if (!task) {
            set.status = 404;
            return errorResponse('Task not found');
          }

          // Update task with noteId
          await db.update(tasks).set({ noteId: document.id }).where(eq(tasks.id, taskId));

          // Broadcast task update
          wsManager.broadcastToUser(user.id, {
            type: 'task-update',
            data: { taskId, userId: user.id }
          });
        }

        logger.info({ documentId: document.id, taskId }, 'Created note');

        return successResponse(
          {
            id: document.id,
            title: document.title,
            url: document.url,
            taskId
          },
          'Note created successfully'
        );
      } catch (error) {
        logger.error({ error }, 'Error creating note');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to create note');
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1 }),
        text: t.Optional(t.String()),
        taskId: t.Optional(t.String()),
        collectionId: t.Optional(t.String())
      })
    }
  )
  // Search for notes
  .post(
    '/search',
    async ({ body, db, user, set }) => {
      // Get user's Outline client
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
      const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

      if (!userClient || !userClient.isEnabled()) {
        set.status = 400;
        return errorResponse('Outline integration is not configured');
      }

      try {
        const { query, limit, offset, collectionId } = body;

        const results = await userClient.searchDocuments(query, {
          limit,
          offset,
          collectionId
        });

        // Transform results to simpler format
        const documents = results.map((result) => ({
          id: result.document.id,
          title: result.document.title,
          url: result.document.url,
          context: result.context,
          ranking: result.ranking,
          updatedAt: result.document.updatedAt
        }));

        return { documents };
      } catch (error) {
        logger.error({ error }, 'Error searching notes');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to search notes');
      }
    },
    {
      body: t.Object({
        query: t.String({ minLength: 1 }),
        limit: t.Optional(t.Number()),
        offset: t.Optional(t.Number()),
        collectionId: t.Optional(t.String())
      })
    }
  )
  // Link an existing note to a task
  .post(
    '/link',
    async ({ body, db, user, set }) => {
      // Get user's Outline client
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
      const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

      if (!userClient || !userClient.isEnabled()) {
        set.status = 400;
        return errorResponse('Outline integration is not configured');
      }

      try {
        const { taskId, noteId } = body;

        // Verify task ownership
        const [task] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        if (!task) {
          set.status = 404;
          return errorResponse('Task not found');
        }

        // Verify note exists in Outline
        try {
          await userClient.getDocument(noteId);
        } catch {
          set.status = 404;
          return errorResponse('Note not found in Outline');
        }

        // Update task with noteId
        await db.update(tasks).set({ noteId }).where(eq(tasks.id, taskId));

        // Broadcast task update
        wsManager.broadcastToUser(user.id, {
          type: 'task-update',
          data: { taskId, userId: user.id }
        });

        logger.info({ taskId, noteId }, 'Linked note to task');

        return successResponse({ taskId, noteId }, 'Note linked successfully');
      } catch (error) {
        logger.error({ error }, 'Error linking note');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to link note');
      }
    },
    {
      body: t.Object({
        taskId: t.String(),
        noteId: t.String()
      })
    }
  )
  // Unlink a note from a task
  .delete(
    '/unlink/:taskId',
    async ({ params, db, user, set }) => {
      const { taskId } = params;

      try {
        // Verify task ownership
        const [task] = await db
          .select({ id: tasks.id, noteId: tasks.noteId })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        if (!task) {
          set.status = 404;
          return errorResponse('Task not found');
        }

        if (!task.noteId) {
          set.status = 400;
          return errorResponse('Task has no linked note');
        }

        // Remove noteId from task
        await db.update(tasks).set({ noteId: null }).where(eq(tasks.id, taskId));

        // Broadcast task update
        wsManager.broadcastToUser(user.id, {
          type: 'task-update',
          data: { taskId, userId: user.id }
        });

        logger.info({ taskId }, 'Unlinked note from task');

        return successResponse(null, 'Note unlinked successfully');
      } catch (error) {
        logger.error({ error }, 'Error unlinking note');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to unlink note');
      }
    },
    {
      params: t.Object({
        taskId: t.String()
      })
    }
  )
  // Get note details by ID
  .get(
    '/:noteId',
    async ({ params, db, user, set }) => {
      // Get user's Outline client
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
      const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

      if (!userClient || !userClient.isEnabled()) {
        set.status = 400;
        return errorResponse('Outline integration is not configured');
      }

      try {
        const { noteId } = params;
        const document = await userClient.getDocument(noteId);

        return {
          id: document.id,
          title: document.title,
          text: document.text,
          url: document.url,
          collectionId: document.collectionId,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        };
      } catch (error) {
        logger.error({ error }, 'Error fetching note');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to fetch note');
      }
    },
    {
      params: t.Object({
        noteId: t.String()
      })
    }
  )
  // Get note for a specific task
  .get(
    '/task/:taskId',
    async ({ params, db, user, set }) => {
      const { taskId } = params;

      try {
        // Get task with noteId
        const [task] = await db
          .select({
            id: tasks.id,
            noteId: tasks.noteId,
            title: tasks.title
          })
          .from(tasks)
          .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));

        if (!task) {
          set.status = 404;
          return errorResponse('Task not found');
        }

        if (!task.noteId) {
          return { note: null };
        }

        // Get user's Outline client
        const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
        const userClient = dbUser?.settings ? createOutlineClient(dbUser.settings) : null;

        if (!userClient || !userClient.isEnabled()) {
          // Return just the noteId if Outline is not configured
          return {
            note: {
              id: task.noteId,
              url: null,
              title: null
            }
          };
        }

        // Fetch note details from Outline
        try {
          const document = await userClient.getDocument(task.noteId);
          return {
            note: {
              id: document.id,
              title: document.title,
              url: document.url,
              updatedAt: document.updatedAt
            }
          };
        } catch (error) {
          logger.warn({ noteId: task.noteId, error }, 'Failed to fetch note from Outline');
          // Return partial info if Outline fetch fails
          return {
            note: {
              id: task.noteId,
              url: userClient.getDocumentUrl(task.noteId),
              title: null
            }
          };
        }
      } catch (error) {
        logger.error({ error }, 'Error fetching task note');
        set.status = 500;
        return errorResponse(error instanceof Error ? error.message : 'Failed to fetch task note');
      }
    },
    {
      params: t.Object({
        taskId: t.String()
      })
    }
  );
