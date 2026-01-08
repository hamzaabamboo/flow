import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuggestionRow } from '../SuggestionRow';
import { SpaceContext } from '../../../contexts/SpaceContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AutoOrganizeSuggestion } from '../../../shared/types/autoOrganize';
import { api } from '../../../api/client';
import React from 'react';

// Mock API
vi.mock('../../../api/client', () => ({
  api: {
    api: {
      boards: { get: vi.fn() }
    }
  }
}));

// Mock SimpleDatePicker
vi.mock('../../ui/simple-date-picker', () => ({
  SimpleDatePicker: ({ value, onChange }: any) => (
    <input 
      role="textbox"
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />
  )
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={{ currentSpace: 'work', setCurrentSpace: vi.fn() } as any}>
        {ui}
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

describe('SuggestionRow', () => {
  const mockSuggestion: AutoOrganizeSuggestion = {
    taskId: 't1',
    taskTitle: 'Test Task',
    reason: 'Better organization',
    confidence: 90,
    included: true,
    details: {
      type: 'column_move',
      currentBoardId: 'b1',
      currentBoardName: 'Board 1',
      currentColumnId: 'c1',
      currentColumnName: 'To Do',
      suggestedBoardId: 'b1',
      suggestedBoardName: 'Board 1',
      suggestedColumnId: 'c2',
      suggestedColumnName: 'In Progress'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.api.boards.get as vi.Mock).mockResolvedValue({ data: [], error: null });
  });

  it('should handle editing priority', async () => {
    const user = userEvent.setup();
    const onUpdateSuggestion = vi.fn();
    const suggestion: AutoOrganizeSuggestion = {
      ...mockSuggestion,
      details: {
        type: 'priority_change',
        currentPriority: 'low',
        suggestedPriority: 'medium'
      }
    };

    renderWithProviders(
      <SuggestionRow 
        suggestion={suggestion} 
        onToggleIncluded={vi.fn()} 
        onUpdateSuggestion={onUpdateSuggestion} 
      />
    );

    // Enter edit mode
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find(b => b.innerHTML.includes('lucide-pen'));
    await user.click(editBtn!);

    // Change priority (combobox)
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    const highOption = await screen.findByRole('option', { name: 'High' });
    await user.click(highOption);

    // Save
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(onUpdateSuggestion).toHaveBeenCalledWith('t1', expect.objectContaining({
        details: expect.objectContaining({
            suggestedPriority: 'high'
        })
    }));
  });

  it('should handle editing due date', async () => {
    const user = userEvent.setup();
    const onUpdateSuggestion = vi.fn();
    const suggestion: AutoOrganizeSuggestion = {
      ...mockSuggestion,
      details: {
        type: 'due_date_adjust',
        currentDueDate: '2024-01-01T10:00:00Z',
        suggestedDueDate: '2024-01-02T10:00:00Z'
      }
    };

    renderWithProviders(
      <SuggestionRow 
        suggestion={suggestion} 
        onToggleIncluded={vi.fn()} 
        onUpdateSuggestion={onUpdateSuggestion} 
      />
    );

    // Enter edit mode
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find(b => b.innerHTML.includes('lucide-pen'));
    await user.click(editBtn!);

    // Change due date (mocked textbox)
    const dateInput = screen.getByRole('textbox');
    fireEvent.change(dateInput, { target: { value: '2024-12-31' } });

    // Save
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(onUpdateSuggestion).toHaveBeenCalledWith('t1', expect.objectContaining({
        details: expect.objectContaining({
            suggestedDueDate: expect.stringContaining('2024-12-31')
        })
    }));
  });

  it('should handle editing column move', async () => {
    const user = userEvent.setup();
    const onUpdateSuggestion = vi.fn();
    const mockBoards = [
        { id: 'b1', name: 'Board 1', columns: [{ id: 'c1', name: 'To Do' }, { id: 'c2', name: 'Done' }] },
        { id: 'b2', name: 'Board 2', columns: [{ id: 'c3', name: 'Inbox' }] }
    ];
    (api.api.boards.get as vi.Mock).mockResolvedValue({ data: mockBoards, error: null });

    renderWithProviders(
      <SuggestionRow 
        suggestion={mockSuggestion} 
        onToggleIncluded={vi.fn()} 
        onUpdateSuggestion={onUpdateSuggestion} 
      />
    );

    // Enter edit mode
    const buttons = screen.getAllByRole('button');
    const editBtn = buttons.find(b => b.innerHTML.includes('lucide-pen'));
    await user.click(editBtn!);

    // Should fetch boards
    await waitFor(() => expect(api.api.boards.get).toHaveBeenCalled());

    // Change board
    const triggers = screen.getAllByRole('combobox');
    await user.click(triggers[0]); // Board select
    const b2Option = await screen.findByRole('option', { name: 'Board 2' });
    await user.click(b2Option);

    // Save
    await user.click(screen.getByRole('button', { name: /Save/i }));

    expect(onUpdateSuggestion).toHaveBeenCalledWith('t1', expect.objectContaining({
        details: expect.objectContaining({
            suggestedBoardId: 'b2',
            suggestedColumnId: 'c3'
        })
    }));
  });
});
