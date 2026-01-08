import { describe, it, expect } from 'vitest';
import { CommandIntentSchema } from '../commandProcessor';
import { AutoOrganizeOutputSchema, AutoOrganizeSuggestionSchema } from '../autoOrganizer';
import { RefinementSuggestionSchema } from '../commandRefinement';

describe('Agent Schemas', () => {
  describe('CommandIntentSchema', () => {
    it('should validate a valid create_task intent', () => {
      const validIntent = {
        action: 'create_task',
        title: 'Buy milk',
        priority: 'medium',
        deadline: '2025-10-25T00:00:00+09:00',
        labels: ['groceries'],
        space: 'personal'
      };
      const result = CommandIntentSchema.safeParse(validIntent);
      expect(result.success).toBe(true);
    });

    it('should validate a valid create_reminder intent', () => {
      const validIntent = {
        action: 'create_reminder',
        message: 'Call dentist',
        reminderTime: '2025-10-16T15:30:00+09:00'
      };
      const result = CommandIntentSchema.safeParse(validIntent);
      expect(result.success).toBe(true);
    });

    it('should invalidate incorrect action types', () => {
      const invalidIntent = {
        action: 'invalid_action',
        title: 'Something'
      };
      const result = CommandIntentSchema.safeParse(invalidIntent);
      expect(result.success).toBe(false);
    });
  });

  describe('AutoOrganize schemas', () => {
    it('should validate a priority change suggestion', () => {
      const validSuggestion = {
        taskId: '123',
        taskTitle: 'Important task',
        details: {
          type: 'priority_change',
          currentPriority: 'low',
          suggestedPriority: 'high'
        },
        reason: 'It is overdue',
        confidence: 90
      };
      const result = AutoOrganizeSuggestionSchema.safeParse(validSuggestion);
      expect(result.success).toBe(true);
    });

    it('should validate a column move suggestion', () => {
        const validSuggestion = {
          taskId: '123',
          taskTitle: 'Important task',
          details: {
            type: 'column_move',
            currentBoardId: 'b1',
            currentBoardName: 'Board 1',
            currentColumnId: 'c1',
            currentColumnName: 'Col 1',
            suggestedBoardId: 'b1',
            suggestedBoardName: 'Board 1',
            suggestedColumnId: 'c2',
            suggestedColumnName: 'Col 2'
          },
          reason: 'Better organized here',
          confidence: 80
        };
        const result = AutoOrganizeSuggestionSchema.safeParse(validSuggestion);
        expect(result.success).toBe(true);
      });

    it('should validate complete output schema', () => {
      const validOutput = {
        suggestions: [
          {
            taskId: '123',
            taskTitle: 'Task 1',
            details: {
              type: 'priority_change',
              currentPriority: 'medium',
              suggestedPriority: 'urgent'
            },
            reason: 'Critical deadline',
            confidence: 95
          }
        ],
        summary: '1 urgent change suggested'
      };
      const result = AutoOrganizeOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });

  describe('RefinementSuggestionSchema', () => {
    it('should validate valid refinements', () => {
      const validRefinements = {
        suggestions: [
          {
            type: 'completion',
            text: 'Add task to buy milk',
            description: 'Completed with object'
          },
          {
            type: 'timing',
            text: 'Add task tomorrow',
            description: 'Added timing'
          }
        ]
      };
      const result = RefinementSuggestionSchema.safeParse(validRefinements);
      expect(result.success).toBe(true);
    });

    it('should invalidate if type is incorrect', () => {
        const invalidRefinements = {
          suggestions: [
            {
              type: 'invalid_type',
              text: 'Some text',
              description: 'Some desc'
            }
          ]
        };
        const result = RefinementSuggestionSchema.safeParse(invalidRefinements);
        expect(result.success).toBe(false);
      });
  });
});
