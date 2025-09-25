import { Agent, createTool } from '@mastra/core';
import { z } from 'zod';
import { google } from '@ai-sdk/google';

// Helper function to get the next occurrence of a specific day of the week
function getNextDayOfWeek(dayOfWeek: number, fromDate: Date): Date {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  const daysUntilNext = (dayOfWeek - currentDay + 7) % 7 || 7; // If it's the same day, get next week's
  result.setDate(result.getDate() + daysUntilNext);
  result.setHours(9, 0, 0, 0); // Default to 9 AM
  return result;
}

// Tools for the command processor
const parseTaskCommand = createTool({
  id: 'parse-task-command',
  description: 'Parse natural language commands for task management',
  inputSchema: z.object({
    command: z.string()
  }),
  execute: async (context: any) => {
    const { command } = context.input;
    const lowerCommand = command.toLowerCase();

    // Task creation patterns
    if (
      lowerCommand.includes('add task') ||
      lowerCommand.includes('create task') ||
      lowerCommand.includes('new task')
    ) {
      const title = command
        .replace(/add task|create task|new task/i, '')
        .replace(/to (work|personal)/i, '')
        .trim();
      const space = lowerCommand.includes('personal') ? 'personal' : 'work';
      return {
        action: 'create_task',
        data: { title, space }
      };
    }

    // Note/inbox creation
    if (
      lowerCommand.includes('add note') ||
      lowerCommand.includes('quick note') ||
      lowerCommand.includes('inbox')
    ) {
      const content = command.replace(/add note|quick note|inbox/i, '').trim();
      return {
        action: 'create_inbox_item',
        data: { content }
      };
    }

    // Reminder patterns
    if (lowerCommand.includes('remind me')) {
      const message = command.replace(/remind me/i, '').trim();
      return {
        action: 'create_reminder',
        data: { message }
      };
    }

    // Task completion
    if (lowerCommand.includes('complete') || lowerCommand.includes('done')) {
      const taskRef = command.replace(/complete|done|task/gi, '').trim();
      return {
        action: 'complete_task',
        data: { taskRef }
      };
    }

    // Move task
    if (lowerCommand.includes('move') && lowerCommand.includes('to')) {
      const matches = command.match(/move (.+) to (.+)/i);
      if (matches) {
        return {
          action: 'move_task',
          data: { taskRef: matches[1].trim(), destination: matches[2].trim() }
        };
      }
    }

    // List/show tasks
    if (lowerCommand.includes('show') || lowerCommand.includes('list')) {
      if (lowerCommand.includes('today')) {
        return {
          action: 'list_tasks',
          data: { filter: 'today' }
        };
      }
      if (lowerCommand.includes('tomorrow')) {
        return {
          action: 'list_tasks',
          data: { filter: 'tomorrow' }
        };
      }
      return {
        action: 'list_tasks',
        data: { filter: 'all' }
      };
    }

    // Pomodoro timer
    if (lowerCommand.includes('pomodoro') || lowerCommand.includes('timer')) {
      if (lowerCommand.includes('start')) {
        return {
          action: 'start_pomodoro',
          data: {}
        };
      }
      if (lowerCommand.includes('stop') || lowerCommand.includes('pause')) {
        return {
          action: 'stop_pomodoro',
          data: {}
        };
      }
    }

    return {
      action: 'unknown',
      data: { originalCommand: command }
    };
  }
});

const parseDateTime = createTool({
  id: 'parse-datetime',
  description: 'Parse date and time from natural language',
  inputSchema: z.object({
    text: z.string()
  }),
  execute: async (context: any) => {
    const { text } = context.input;
    const now = new Date();
    const lowerText = text.toLowerCase();

    // Time-based patterns
    if (lowerText.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
      return tomorrow.toISOString();
    }

    if (lowerText.includes('today')) {
      const today = new Date(now);
      if (now.getHours() >= 17) {
        today.setHours(20, 0, 0, 0); // If after 5 PM, set to 8 PM
      } else {
        today.setHours(now.getHours() + 2, 0, 0, 0); // 2 hours from now
      }
      return today.toISOString();
    }

    // Relative time patterns
    const minuteMatch = lowerText.match(/in (\d+) minute/);
    if (minuteMatch) {
      const minutes = parseInt(minuteMatch[1]);
      now.setMinutes(now.getMinutes() + minutes);
      return now.toISOString();
    }

    const hourMatch = lowerText.match(/in (\d+) hour/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      now.setHours(now.getHours() + hours);
      return now.toISOString();
    }

    // Day-based patterns
    if (lowerText.includes('monday')) {
      const monday = getNextDayOfWeek(1, now);
      return monday.toISOString();
    }
    if (lowerText.includes('friday')) {
      const friday = getNextDayOfWeek(5, now);
      return friday.toISOString();
    }

    // Week-based patterns
    if (lowerText.includes('next week')) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      return nextWeek.toISOString();
    }

    // Default: 2 hours from now
    now.setHours(now.getHours() + 2);
    return now.toISOString();
  }
});

export const commandProcessor = new Agent({
  id: 'command-processor',
  name: 'HamFlow Command Processor',
  description: 'Processes natural language commands for task management',
  model: google('gemini-1.5-flash'),
  tools: {
    parseTaskCommand,
    parseDateTime
  },
  instructions: `You are an AI assistant for HamFlow, a productivity hub.
    Parse user commands to understand their intent and extract relevant information.
    Common commands include:
    - Creating tasks with titles and due dates
    - Setting reminders
    - Moving tasks between boards
    - Creating notes
    - Checking schedules

    Always be helpful and extract as much relevant information as possible from the command.`
});
