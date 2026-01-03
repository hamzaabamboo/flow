import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import InboxPage from '../inbox/+Page';

// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';

// Mock vike navigation
const mockNavigate = vi.fn();
vi.mock('vike/client/router', () => ({
  navigate: (...args: any[]) => mockNavigate(...args)
}));

// Mock SpaceContext
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work'
  }))
}));

// Mock ToasterContext
vi.mock('../../contexts/ToasterContext', () => ({
  useToaster: () => ({
    toast: vi.fn()
  })
}));

// Mock Dialogs (useDialogs)
const mockConfirm = vi.fn();
vi.mock('../../utils/useDialogs', () => ({
  useDialogs: () => ({
    confirm: (...args: any[]) => mockConfirm(...args)
  })
}));

// Mock API
const mockInboxGet = vi.fn();
const mockBoardsGet = vi.fn();
const mockConvertPost = vi.fn();
const mockDeletePost = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    api: {
      inbox: Object.assign(
        (_params: any) => ({
          // If nested routes needing ID
        }),
        {
          get: (...args: any[]) => mockInboxGet(...args),
          convert: { post: (...args: any[]) => mockConvertPost(...args) },
          delete: { post: (...args: any[]) => mockDeletePost(...args) }
        }
      ),
      boards: {
        get: (...args: any[]) => mockBoardsGet(...args)
      }
    }
  }
}));

describe('InboxPage Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });

    // Default Mocks
    mockInboxGet.mockResolvedValue({ data: [], error: null });
    mockBoardsGet.mockResolvedValue({
      data: [{ id: 'b1', name: 'Board 1', columns: [{ id: 'c1', name: 'Todo' }] }],
      error: null
    });
    mockConvertPost.mockResolvedValue({ data: { success: true }, error: null });
    mockDeletePost.mockResolvedValue({ data: { success: true }, error: null });
    mockConfirm.mockResolvedValue(true);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('should render empty state when no items', async () => {
    render(<InboxPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Your inbox is empty!/i)).toBeInTheDocument();
    });
  });

  it('should list inbox items', async () => {
    mockInboxGet.mockResolvedValue({
      data: [
        { id: 'i1', title: 'Inbox Item 1', source: 'command', createdAt: new Date().toISOString() },
        { id: 'i2', title: 'Inbox Item 2', source: 'email', createdAt: new Date().toISOString() }
      ],
      error: null
    });

    render(<InboxPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Inbox Item 1')).toBeInTheDocument();
      expect(screen.getByText('Inbox Item 2')).toBeInTheDocument();
    });
  });

  it('should select items and show bulk actions', async () => {
    mockInboxGet.mockResolvedValue({
      data: [
        { id: 'i1', title: 'Inbox Item 1', source: 'command', createdAt: new Date().toISOString() }
      ],
      error: null
    });

    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InboxPage />, { wrapper });

    await waitFor(() => screen.getByText('Inbox Item 1'));

    // Find checkbox (Radix Checkbox or standard?)
    // The code uses `Checkbox` component.
    // We can click the item itself since the row has onClick handler too.

    const _itemRow = screen.getByText('Inbox Item 1').closest('div');
    // Or better, click the text
    await user.click(screen.getByText('Inbox Item 1'));

    expect(screen.getByText('Move to Board (1)')).toBeInTheDocument();
    expect(screen.getByText('Delete (1)')).toBeInTheDocument();
  });

  it('should delete items', async () => {
    mockInboxGet.mockResolvedValue({
      data: [
        { id: 'i1', title: 'Inbox Item 1', source: 'command', createdAt: new Date().toISOString() }
      ],
      error: null
    });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InboxPage />, { wrapper });

    await waitFor(() => screen.getByText('Inbox Item 1'));
    await user.click(screen.getByText('Inbox Item 1')); // Select

    const deleteBtn = screen.getByText(/Delete \(1\)/i);
    await user.click(deleteBtn);

    // Confirm dialog mocked to return true
    await waitFor(() => {
      expect(mockDeletePost).toHaveBeenCalledWith({ itemIds: ['i1'] });
    });
  });

  it('should move items to board', async () => {
    mockInboxGet.mockResolvedValue({
      data: [
        { id: 'i1', title: 'Inbox Item 1', source: 'command', createdAt: new Date().toISOString() }
      ],
      error: null
    });
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<InboxPage />, { wrapper });

    await waitFor(() => screen.getByText('Inbox Item 1'));
    await user.click(screen.getByText('Inbox Item 1')); // Select

    const moveBtn = screen.getByText(/Move to Board \(1\)/i);
    await user.click(moveBtn);

    // Modal opens
    await waitFor(() => screen.getByText('Move to Board'));

    // Select Board/Column. Code pre-selects 'Todo'.
    expect(screen.getByText('Board 1')).toBeInTheDocument();

    // Click Move
    const confirmMove = screen.getByRole('button', { name: /Move Item/i });
    await user.click(confirmMove);

    await waitFor(() => {
      expect(mockConvertPost).toHaveBeenCalledWith({ itemId: 'i1', columnId: 'c1' });
      expect(mockNavigate).toHaveBeenCalledWith('/board/b1');
    });
  });
});
