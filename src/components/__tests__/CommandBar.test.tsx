import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandBar } from '../CommandBar/CommandBar';
import '@testing-library/jest-dom';

// Mock the SpaceContext
vi.mock('../../contexts/SpaceContext', () => ({
  useSpace: vi.fn(() => ({
    currentSpace: 'work',
    setCurrentSpace: vi.fn()
  }))
}));

// Mock fetch with proper typing
global.fetch = vi.fn() as unknown as typeof fetch;

describe('CommandBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('should render the command input', () => {
    render(<CommandBar />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);
    expect(input).toBeTruthy();
  });

  it('should handle text input', async () => {
    const user = userEvent.setup();
    render(<CommandBar />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Add task Buy groceries');

    expect(input).toHaveValue('Add task Buy groceries');
  });

  it('should submit command on Enter key', async () => {
    const mockResponse = {
      success: true,
      action: 'task_created',
      data: { id: 'task-1', title: 'Buy groceries' }
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const user = userEvent.setup();
    render(<CommandBar />);

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

    // Input should be cleared after successful submission
    expect(input).toHaveValue('');
  });

  it('should not submit empty commands', async () => {
    const user = userEvent.setup();
    render(<CommandBar />);

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
                json: () => Promise.resolve({ success: true })
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    render(<CommandBar />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Test command');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeTruthy();
    });
  });

  it('should handle voice input button click', () => {
    // Mock SpeechRecognition
    const mockSpeechRecognition = vi.fn();
    mockSpeechRecognition.prototype.start = vi.fn();
    mockSpeechRecognition.prototype.stop = vi.fn();

    (window as unknown as { SpeechRecognition: typeof mockSpeechRecognition }).SpeechRecognition =
      mockSpeechRecognition;

    render(<CommandBar />);

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
    render(<CommandBar />);

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
                json: () => Promise.resolve({ success: true })
              }),
            100
          )
        )
    );

    const user = userEvent.setup();
    render(<CommandBar />);

    const input = screen.getByPlaceholderText(/Type a command or click the mic/i);

    await user.type(input, 'Test command');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });
});
