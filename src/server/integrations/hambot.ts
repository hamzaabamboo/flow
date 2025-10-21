import { inboxItems } from '../../../drizzle/schema';
import type { Database } from '../db';
import { logger } from '../logger';

interface HamBotMessage {
  id: string;
  text: string;
  from: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class HamBotIntegration {
  private webhookUrl: string;
  private apiKey: string;
  private channel: string;
  private db: Database;

  constructor(db: Database) {
    this.webhookUrl =
      process.env.HAMBOT_API_URL || 'https://hambot.ham-san.net/webhook/hambot-push';
    this.apiKey = process.env.HAMBOT_API_KEY || '';
    this.channel = process.env.HAMBOT_CHANNEL || 'hamflow';
    this.db = db;

    if (!this.apiKey) {
      logger.warn('HamBot integration not configured. Set HAMBOT_API_KEY environment variable.');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Send a message via HamBot webhook
   * Matches the HamBot API schema exactly
   */
  async send(message: string, channel?: string): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('HamBot not configured, skipping message send');
      return false;
    }

    try {
      const targetChannel = channel || this.channel;
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hambot-key': this.apiKey
        },
        body: JSON.stringify({
          data: {
            message
          },
          channel: targetChannel
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, statusText: response.statusText, body: errorText },
          'HamBot API error'
        );
        return false;
      }

      logger.debug({ channel: targetChannel }, 'HamBot message sent');
      return true;
    } catch (error) {
      logger.error(error, 'Failed to send HamBot message');
      return false;
    }
  }

  // Legacy method for backwards compatibility
  async sendMessage(recipient: string, message: string): Promise<boolean> {
    return this.send(message);
  }

  // Receive messages from HamBot webhook
  async receiveMessage(message: HamBotMessage, userId: string): Promise<void> {
    try {
      // Add message to inbox
      await this.db.insert(inboxItems).values({
        title: message.text,
        description: `From: ${message.from} at ${message.timestamp}`,
        space: 'personal', // Default to personal space for external messages
        source: 'hambot',
        userId,
        processed: false,
        createdAt: new Date()
      });

      logger.info({ userId, messageId: message.id }, 'HamBot message received and added to inbox');
    } catch (error) {
      logger.error({ userId, messageId: message.id, error }, 'Failed to process HamBot message');
      throw error;
    }
  }

  // Send reminder via HamBot
  async sendReminder(
    userId: string,
    reminderMessage: string,
    link?: string | null
  ): Promise<boolean> {
    const message = link ? `⏰ ${reminderMessage}\n${link}` : `⏰ ${reminderMessage}`;
    return this.send(message);
  }

  // Send daily summary
  async sendSummary(userId: string, summaryMessage: string): Promise<boolean> {
    return this.send(summaryMessage);
  }
}
