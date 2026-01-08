import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoardDialog } from '../BoardDialog';
import { SpaceContext } from '../../../contexts/SpaceContext';
import { ToasterContext } from '../../../contexts/ToasterContext';
import { api } from '../../../api/client';
import { navigate } from 'vike/client/router';
import type { Board } from '../../../shared/types/board';
import React from 'react';

// Mock dependencies
vi.mock('../../../api/client', () => {
  const mockBoards: any = vi.fn();
  mockBoards.post = vi.fn();
  return {
    api: {
      api: {
        boards: mockBoards,
      },
    },
  };
});

vi.mock('vike/client/router', () => ({
  navigate: vi.fn(),
}));

const mockSpaceContext = {
  currentSpace: 'work',
  spaces: [],
  setSpaces: vi.fn(),
  setCurrentSpace: vi.fn(),
  getSpaceById: vi.fn(),
  toggleSpace: vi.fn(),
};

const mockToasterContext = {
  toast: vi.fn(),
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <SpaceContext.Provider value={mockSpaceContext as any}>
        <ToasterContext.Provider value={mockToasterContext as any}>
          {ui}
        </ToasterContext.Provider>
      </SpaceContext.Provider>
    </QueryClientProvider>
  );
};

describe('BoardDialog', () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const mockPatch = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    
    // Setup nested mocks
    (api.api.boards as any).mockImplementation(() => ({
        patch: mockPatch,
        delete: mockDelete,
    }));
    (api.api.boards as any).post = vi.fn().mockResolvedValue({ data: { id: 'b1' }, error: null });
    mockPatch.mockResolvedValue({ data: { id: 'b1' }, error: null });
    mockDelete.mockResolvedValue({ data: {}, error: null });
  });

  it('should render create mode correctly', () => {
    renderWithProviders(<BoardDialog open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByText('Create New Board')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., Engineering/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Board/i })).toBeInTheDocument();
  });

  it('should render edit mode correctly', () => {
    const mockBoard: Board = { 
        id: 'b1', 
        name: 'Existing Board', 
        description: 'Desc',
        userId: 'u1',
        space: 'work',
        createdAt: '',
        updatedAt: ''
    };
    renderWithProviders(
      <BoardDialog open={true} onOpenChange={onOpenChange} board={mockBoard} />
    );

    expect(screen.getByText('Edit Board')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Board')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Board/i })).toBeInTheDocument();
  });

  it('should handle board creation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BoardDialog open={true} onOpenChange={onOpenChange} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/e.g., Engineering/i), 'New Board');
    await user.click(screen.getByRole('button', { name: /Create Board/i }));

    expect(api.api.boards.post).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Board',
        space: 'work'
    }));
    expect(onSuccess).toHaveBeenCalledWith('b1');
    expect(mockToasterContext.toast).toHaveBeenCalledWith('Board created successfully', expect.any(Object));
  });

  it('should handle board update', async () => {
    const user = userEvent.setup();
    const mockBoard: Board = { 
        id: 'b1', 
        name: 'Existing Board', 
        userId: 'u1',
        space: 'work',
        createdAt: '',
        updatedAt: ''
    };
    renderWithProviders(
      <BoardDialog open={true} onOpenChange={onOpenChange} board={mockBoard} />
    );

    const nameInput = screen.getByDisplayValue('Existing Board');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(mockPatch).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Name'
    }));
    expect(mockToasterContext.toast).toHaveBeenCalledWith('Board updated successfully', expect.any(Object));
  });

  it('should handle board deletion', async () => {
    const user = userEvent.setup();
    const mockBoard: Board = { 
        id: 'b1', 
        name: 'Existing Board',
        userId: 'u1',
        space: 'work',
        createdAt: '',
        updatedAt: ''
    };
    window.confirm = vi.fn(() => true);
    
    renderWithProviders(
      <BoardDialog open={true} onOpenChange={onOpenChange} board={mockBoard} />
    );

    await user.click(screen.getByRole('button', { name: /Delete Board/i }));

    expect(api.api.boards).toHaveBeenCalledWith({ boardId: 'b1' });
    expect(mockDelete).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/boards');
    expect(mockToasterContext.toast).toHaveBeenCalledWith('Board deleted successfully', expect.any(Object));
  });

  it('should handle creation error', async () => {
    const user = userEvent.setup();
    (api.api.boards.post as any).mockResolvedValue({ data: null, error: { message: 'Fail' } });
    
    renderWithProviders(<BoardDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText(/e.g., Engineering/i), 'New Board');
    await user.click(screen.getByRole('button', { name: /Create Board/i }));

    expect(mockToasterContext.toast).toHaveBeenCalledWith('Failed to create board', expect.any(Object));
  });
});