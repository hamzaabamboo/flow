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
  private apiUrl: string;
  private apiKey: string;
  private db: Database;

  constructor(db: Database) {
    this.apiUrl = process.env.HAMBOT_API_URL || '';
    this.apiKey = process.env.HAMBOT_API_KEY || '';
    this.db = db;

    if (!this.apiUrl || !this.apiKey) {
      console.warn('HamBot integration not configured. Set HAMBOT_API_URL and HAMBOT_API_KEY.');
    }
  }

  isConfigured(): boolean {
    return !!(this.apiUrl && this.apiKey);
  }

  // Send a message via HamBot
  async sendMessage(recipient: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn('HamBot not configured, skipping message send');
      return false;
    }

    try {
      const response = await fetch(`${this.apiUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          recipient,
          message,
          timestamp: new Date().toISOString()
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
  async sendReminder(userId: string, reminderMessage: string): Promise<boolean> {
    // In a real implementation, you would map userId to HamBot recipient
    const recipient = `user_${userId}`; // This would be mapped to actual contact info

    return this.sendMessage(recipient, `[REMINDER] ${reminderMessage}`);
  }

  // Send task notification
  async sendTaskNotification(
    userId: string,
    taskTitle: string,
    action: 'created' | 'completed' | 'due'
  ): Promise<boolean> {
    const recipient = `user_${userId}`;

    let message = '';
    switch (action) {
      case 'created':
        message = `[TASK] New task created: ${taskTitle}`;
        break;
      case 'completed':
        message = `[COMPLETED] Task completed: ${taskTitle}`;
        break;
      case 'due':
        message = `[DUE SOON] Task due soon: ${taskTitle}`;
        break;
    }

    return this.sendMessage(recipient, message);
  }

  // Batch send messages (for daily summaries, etc.)
  async sendBatchMessages(
    messages: Array<{ userId: string; message: string }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const { userId, message } of messages) {
      const sent = await this.sendMessage(`user_${userId}`, message);
      if (sent) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }
}
