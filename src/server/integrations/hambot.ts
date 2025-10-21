import { inboxItems } from '../../../drizzle/schema';
import type { Database } from '../db';

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
      console.warn('HamBot integration not configured. Set HAMBOT_API_KEY environment variable.');
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
      console.warn('HamBot not configured, skipping message send');
      return false;
    }

    try {
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
          channel: channel || this.channel
        })
      });

      if (!response.ok) {
        throw new Error(`HamBot API error: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send HamBot message:', error);
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

      console.log(`HamBot message received and added to inbox for user ${userId}`);
    } catch (error) {
      console.error('Failed to process HamBot message:', error);
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
