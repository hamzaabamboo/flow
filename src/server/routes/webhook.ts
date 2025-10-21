import crypto from 'crypto';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { logger } from '../logger';
import { HamBotIntegration } from '../integrations/hambot';
import { wsManager } from '../websocket';

export const webhookRoutes = new Elysia({ prefix: '/webhook' })
  .decorate('db', db)
  // HamBot webhook endpoint
  .post(
    '/hambot',
    async ({ body, headers, db, set }) => {
      // Verify webhook signature (if configured)
      const expectedSignature = headers['x-hambot-signature'];
      if (expectedSignature && process.env.HAMBOT_WEBHOOK_SECRET) {
        const payload = JSON.stringify(body);
        const signature = crypto
          .createHmac('sha256', process.env.HAMBOT_WEBHOOK_SECRET)
          .update(payload)
          .digest('hex');

        if (signature !== expectedSignature) {
          logger.warn({ signature, expectedSignature }, 'Invalid HamBot webhook signature');
          set.status = 401;
          return { error: 'Invalid signature' };
        }
      }

      const { message, userId } = body;

      if (!message || !userId) {
        logger.warn({ body }, 'Missing required fields in HamBot webhook');
        set.status = 400;
        return { error: 'Missing required fields' };
      }

      try {
        const hambot = new HamBotIntegration(db);

        // Add message to user's inbox
        await hambot.receiveMessage(
          {
            id: message.id || crypto.randomUUID(),
            text: message.text,
            from: message.from || 'Unknown',
            timestamp: message.timestamp || new Date().toISOString(),
            metadata: message.metadata
          },
          userId
        );

        // Broadcast inbox update to connected clients
        wsManager.broadcastInboxUpdate(userId, 'personal');

        logger.info({ userId, messageId: message.id }, 'HamBot message processed');
        return { success: true, message: 'Message processed' };
      } catch (error) {
        logger.error(error, 'HamBot webhook processing error');
        set.status = 500;
        return { error: 'Failed to process message' };
      }
    },
    {
      body: t.Object({
        message: t.Object({
          id: t.Optional(t.String()),
          text: t.String(),
          from: t.Optional(t.String()),
          timestamp: t.Optional(t.String()),
          metadata: t.Optional(t.Any())
        }),
        userId: t.String()
      }),
      headers: t.Object({ 'x-hambot-signature': t.Optional(t.String()) })
    }
  )
  // GitHub webhook for task creation from issues
  .post('/github', async ({ body, headers, db, set }) => {
    // Verify GitHub webhook signature
    const signature = headers['x-hub-signature-256'];
    if (signature && process.env.GITHUB_WEBHOOK_SECRET) {
      const payload = JSON.stringify(body);
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex')}`;

      if (signature !== expectedSignature) {
        logger.warn('Invalid GitHub webhook signature');
        set.status = 401;
        return { error: 'Invalid signature' };
      }
    }

    const { action, issue, repository } = body as {
      action: string;
      issue?: { title: string; body: string; number: number };
      repository?: { full_name: string };
    };

    if (action === 'opened' && issue) {
      // Create inbox item from GitHub issue
      const userId = process.env.DEFAULT_USER_ID || 'system';

      try {
        const [inboxItem] = await db
          .insert((await import('../../../drizzle/schema')).inboxItems)
          .values({
            title: `[GitHub] ${issue.title}`,
            description: `${issue.body}\n\nRepository: ${repository?.full_name || 'Unknown'}\nIssue: #${issue.number}`,
            space: 'work',
            source: 'github',
            userId
          })
          .returning();

        // Broadcast update
        wsManager.broadcastInboxUpdate(userId, 'work');

        logger.info(
          { repository: repository?.full_name, issueNumber: issue.number },
          'GitHub issue added to inbox'
        );
        return { success: true, itemId: inboxItem.id };
      } catch (error) {
        logger.error(error, 'GitHub webhook error');
        set.status = 500;
        return { error: 'Failed to create inbox item' };
      }
    }

    return { success: true, message: 'Webhook processed' };
  });
