import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { DialogProvider, useDialogs } from '../useDialogs';
import React from 'react';

// A component to trigger dialogs
const TestComponent = () => {
  const { confirm, alert } = useDialogs();
  const [result, setResult] = React.useState<string>('');

  return (
    <div>
      <button
        onClick={async () => {
          const ok = await confirm({ title: 'Confirm?', description: 'Are you sure?' });
          setResult(ok ? 'confirmed' : 'cancelled');
        }}
      >
        Show Confirm
      </button>

      <button
        onClick={async () => {
          await alert({ title: 'Alert!', description: 'Something happened' });
          setResult('alerted');
        }}
      >
        Show Alert
      </button>

      <div data-testid="result">{result}</div>
    </div>
  );
};

describe('useDialogs', () => {
  it('should throw error if used outside DialogProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      'useDialogs must be used within DialogProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should show and handle confirm dialog', async () => {
    const user = userEvent.setup();
    render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>
    );

    await user.click(screen.getByText('Show Confirm'));

    // Wait for lazy loaded component
    const title = await screen.findByText('Confirm?', {}, { timeout: 3000 });
    expect(title).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    // Click confirm
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('confirmed');
    });

    expect(screen.queryByText('Confirm?')).not.toBeInTheDocument();
  });

  it('should handle cancel in confirm dialog', async () => {
    const user = userEvent.setup();
    render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>
    );

    await user.click(screen.getByText('Show Confirm'));
    await screen.findByText('Confirm?', {}, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('cancelled');
    });
  });

  it('should show and handle alert dialog', async () => {
    const user = userEvent.setup();
    render(
      <DialogProvider>
        <TestComponent />
      </DialogProvider>
    );

    await user.click(screen.getByText('Show Alert'));

    await screen.findByText('Alert!', {}, { timeout: 3000 });
    expect(screen.getByText('Something happened')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('alerted');
    });
  });
});
