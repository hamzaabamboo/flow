import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesSection } from '../NotesSection';
import { NoteSearchDialog } from '../NoteSearchDialog';
import { ToasterProvider } from '../../../contexts/ToasterProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useNotesHooks from '../../../hooks/useNotes';

// Mock the hooks
vi.mock('../../../hooks/useNotes', () => ({
  useNotesEnabled: vi.fn(),
  useTaskNote: vi.fn(),
  useCreateNote: vi.fn(),
  useUnlinkNote: vi.fn(),
  useSearchNotes: vi.fn(),
  useLinkNote: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>{ui}</ToasterProvider>
    </QueryClientProvider>
  );
};

describe('Notes', () => {
  const mockedHooks = vi.mocked(useNotesHooks);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks for all hooks
    mockedHooks.useNotesEnabled.mockReturnValue({ data: { enabled: true } } as any);
    mockedHooks.useTaskNote.mockReturnValue({ data: null, refetch: vi.fn() } as any);
    mockedHooks.useCreateNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    mockedHooks.useUnlinkNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
    mockedHooks.useSearchNotes.mockReturnValue({ 
      mutate: vi.fn(), 
      isPending: false, 
      isSuccess: false,
      data: [] 
    } as any);
    mockedHooks.useLinkNote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as any);
  });

  describe('NotesSection', () => {
    it('should show info message when notes are disabled', () => {
      mockedHooks.useNotesEnabled.mockReturnValue({ data: { enabled: false } } as any);
      renderWithProviders(<NotesSection taskTitle="Test Task" />);
      expect(screen.getByText(/Configure Outline in Settings/i)).toBeInTheDocument();
    });

    it('should render create and link buttons when no note linked', () => {
      renderWithProviders(<NotesSection taskTitle="Test Task" />);
      expect(screen.getByRole('button', { name: /Create Note/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Link Existing/i })).toBeInTheDocument();
    });

    it('should show create form when clicking create button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<NotesSection taskTitle="Test Task" />);
      
      await user.click(screen.getByRole('button', { name: /Create Note/i }));
      
      expect(screen.getByText('Note Title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Notes for: Test Task/i)).toBeInTheDocument();
    });

    it('should call createNote mutation on submit', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({ url: 'http://note.url' });
      mockedHooks.useCreateNote.mockReturnValue({ mutateAsync, isPending: false } as any);
      
      renderWithProviders(<NotesSection taskId="t1" taskTitle="Test Task" />);
      
      await user.click(screen.getByRole('button', { name: /Create Note/i }));
      await user.type(screen.getByPlaceholderText(/Notes for: Test Task/i), 'My Note Title');
      await user.type(screen.getByPlaceholderText(/Add initial note content/i), 'Some content');
      
      // Mock window.open
      vi.stubGlobal('open', vi.fn());
      
      await user.click(screen.getByRole('button', { name: /Create & Link Note/i }));
      
      expect(mutateAsync).toHaveBeenCalledWith({
        title: 'My Note Title',
        text: 'Some content',
        taskId: 't1'
      });
    });

    it('should render linked note details', () => {
      mockedHooks.useTaskNote.mockReturnValue({ 
        data: { title: 'Existing Note', url: 'http://note.url' }, 
        refetch: vi.fn() 
      } as any);
      
      renderWithProviders(<NotesSection taskTitle="Test Task" />);
      
      expect(screen.getByText('Existing Note')).toBeInTheDocument();
      expect(screen.getByText('http://note.url')).toBeInTheDocument();
    });

    it('should call unlink mutation when clicking X', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedHooks.useUnlinkNote.mockReturnValue({ mutateAsync, isPending: false } as any);
      mockedHooks.useTaskNote.mockReturnValue({ 
        data: { title: 'Existing Note' }, 
        refetch: vi.fn() 
      } as any);
      
      renderWithProviders(<NotesSection taskId="t1" taskTitle="Test Task" />);
      
      // Find the unlink button (X icon)
      const unlinkBtn = screen.getAllByRole('button').pop();
      
      await user.click(unlinkBtn!);
      
      expect(mutateAsync).toHaveBeenCalledWith('t1');
    });
  });

  describe('NoteSearchDialog', () => {
    it('should call search mutation when searching', async () => {
      const user = userEvent.setup();
      const mutate = vi.fn();
      mockedHooks.useSearchNotes.mockReturnValue({ mutate, isPending: false, isSuccess: false } as any);
      
      renderWithProviders(
        <NoteSearchDialog open={true} onOpenChange={vi.fn()} taskId="t1" />
      );
      
      const input = screen.getByPlaceholderText(/Search notes/i);
      await user.type(input, 'query');
      await user.click(screen.getByRole('button', { name: /Search/i }));
      
      expect(mutate).toHaveBeenCalledWith({ query: 'query' });
    });

    it('should display search results', async () => {
      mockedHooks.useSearchNotes.mockReturnValue({ 
        mutate: vi.fn(), 
        isPending: false, 
        isSuccess: true, 
        data: [
          { id: 'n1', title: 'Note 1', context: 'Context 1', updatedAt: new Date().toISOString(), url: 'http://url1' }
        ] 
      } as any);
      
      renderWithProviders(
        <NoteSearchDialog open={true} onOpenChange={vi.fn()} taskId="t1" />
      );
      
      expect(screen.getByText('Note 1')).toBeInTheDocument();
      expect(screen.getByText('Context 1')).toBeInTheDocument();
    });

    it('should call linkNote mutation when clicking Link', async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({});
      mockedHooks.useLinkNote.mockReturnValue({ mutateAsync, isPending: false } as any);
      mockedHooks.useSearchNotes.mockReturnValue({ 
        isSuccess: true, 
        data: [{ id: 'n1', title: 'Note 1', updatedAt: new Date().toISOString() }] 
      } as any);
      
      renderWithProviders(
        <NoteSearchDialog open={true} onOpenChange={vi.fn()} taskId="t1" />
      );
      
      await user.click(screen.getByRole('button', { name: 'Link' }));
      
      expect(mutateAsync).toHaveBeenCalledWith({ taskId: 't1', noteId: 'n1' });
    });
  });
});
