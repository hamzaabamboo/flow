import { render, screen, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CarryOverControls } from '../CarryOverControls';
import { endOfDay, addDays, addWeeks, endOfMonth } from 'date-fns';
import { nowInJst } from '../../../shared/utils/timezone';
import React from 'react';

// Mock SimpleDatePicker to avoid complex Ark UI interactions in this test
vi.mock('../../ui/simple-date-picker', () => ({
  SimpleDatePicker: ({ value, onChange }: any) => (
    <input role="textbox" value={value} onChange={(e) => onChange(e.target.value)} />
  )
}));

describe('CarryOverControls', () => {
  const mockHandlers = {
    onOpenChange: vi.fn(),
    onCarryOver: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correct options and call onCarryOver for "End of Today"', async () => {
    const user = userEvent.setup();
    render(<CarryOverControls open={true} {...mockHandlers} />);

    // Check for title
    expect(screen.getByText('Carry Over Task')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Move Task/i });
    await user.click(submitBtn);

    const expectedDate = endOfDay(nowInJst());
    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(expectedDate);
  });

  it('should call onCarryOver for "Tomorrow"', async () => {
    const user = userEvent.setup();
    render(<CarryOverControls open={true} {...mockHandlers} />);

    // Open select (trigger has role combobox)
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Select Tomorrow (item in portal)
    const option = await screen.findByRole('option', { name: 'Tomorrow' });
    await user.click(option);

    const submitBtn = screen.getByRole('button', { name: /Move Task/i });
    await user.click(submitBtn);

    const expectedDate = endOfDay(addDays(nowInJst(), 1));
    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(expectedDate);
  });

  it('should call onCarryOver for "Next Week"', async () => {
    const user = userEvent.setup();
    render(<CarryOverControls open={true} {...mockHandlers} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const option = await screen.findByRole('option', { name: 'Next Week' });
    await user.click(option);

    const submitBtn = screen.getByRole('button', { name: /Move Task/i });
    await user.click(submitBtn);

    const expectedDate = endOfDay(addWeeks(nowInJst(), 1));
    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(expectedDate);
  });

  it('should call onCarryOver for "End of Month"', async () => {
    const user = userEvent.setup();
    render(<CarryOverControls open={true} {...mockHandlers} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const option = await screen.findByRole('option', { name: 'End of Month' });
    await user.click(option);

    const submitBtn = screen.getByRole('button', { name: /Move Task/i });
    await user.click(submitBtn);

    const expectedDate = endOfMonth(nowInJst());
    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(expectedDate);
  });

  it('should handle custom date selection', async () => {
    const user = userEvent.setup();
    render(<CarryOverControls open={true} {...mockHandlers} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const option = await screen.findByRole('option', { name: 'Custom Date' });
    await user.click(option);

    // Should show date picker
    const datePicker = screen.getByRole('textbox');
    fireEvent.change(datePicker, { target: { value: '2026-12-31' } });

    const submitBtn = screen.getByRole('button', { name: /Move Task/i });
    await user.click(submitBtn);

    expect(mockHandlers.onCarryOver).toHaveBeenCalledWith(expect.any(Date));
    const calledDate = mockHandlers.onCarryOver.mock.calls[0][0];
    expect(calledDate.getFullYear()).toBe(2026);
    expect(calledDate.getMonth()).toBe(11); // December
    expect(calledDate.getDate()).toBe(31);
  });
});
