import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CommandBar } from '../CommandBar/CommandBar';
// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom';

// Mock the SpaceContext
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work',
    setCurrentSpace: vi.fn()
  }))
}));

// Mock the ToasterContext
vi.mock('../../contexts/ToasterContext', () => ({
  useToaster: () => ({
    toast: vi.fn()
  })
}));

// Mock fetch with proper typing
global.fetch = vi.fn() as unknown as typeof fetch;

describe('CommandBar', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('should render the command input', () => {
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);
    expect(input).toBeTruthy();
  });

  it('should handle text input', async () => {
    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Add task Buy groceries');

    expect(input).toHaveValue('Add task Buy groceries');
  });

  it('should submit command on Enter key', async () => {
    const mockResponse = {
      action: 'task_created',
      data: { title: 'Buy groceries' },
      description: 'Task will be added to inbox'
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Add task Buy groceries');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'Add task Buy groceries',
          space: 'work'
        })
      });
    });
  });

  it('should not submit empty commands', async () => {
    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const _input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.keyboard('{Enter}');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should show processing state', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ action: 'task_created', data: { title: 'test' } })
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Test command');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Processing your command...')).toBeTruthy();
    });
  });

  it('should handle voice input button click', () => {
    // Mock SpeechRecognition
    const mockSpeechRecognition = vi.fn();
    mockSpeechRecognition.prototype.start = vi.fn();
    mockSpeechRecognition.prototype.stop = vi.fn();

    (window as unknown as { SpeechRecognition: typeof mockSpeechRecognition }).SpeechRecognition =
      mockSpeechRecognition;

    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const voiceButton = screen.getByRole('button', { name: /voice input/i });

    fireEvent.click(voiceButton);

    expect(mockSpeechRecognition).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Test command');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Command processing failed:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('should disable input while processing', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve({ action: 'task_created', data: { title: 'test' } })
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    render(<CommandBar open={true} onOpenChange={mockOnOpenChange} />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Test command');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });
});
