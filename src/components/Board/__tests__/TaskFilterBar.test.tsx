import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TaskFilterBar } from '../TaskFilterBar';
import type { FilterOptions } from '../../../shared/types';
import React from 'react';

// Mock SimpleDatePicker
vi.mock('../../ui/simple-date-picker', () => ({
  SimpleDatePicker: ({
    value,
    onChange,
    placeholder
  }: {
    value?: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <input
      role="textbox"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}));

describe('TaskFilterBar', () => {
  const initialFilters: FilterOptions = {
    search: '',
    priority: '',
    label: '',
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  };

  const StatefulFilterBar = ({
    onFiltersChange
  }: {
    onFiltersChange: (f: FilterOptions) => void;
  }) => {
    const [filters, setFilters] = React.useState(initialFilters);
    const handleChange = (newFilters: FilterOptions) => {
      setFilters(newFilters);
      onFiltersChange(newFilters);
    };
    return <TaskFilterBar filters={filters} onFiltersChange={handleChange} />;
  };

  it('should render search input and call onFiltersChange', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<StatefulFilterBar onFiltersChange={onFiltersChange} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    await user.type(input, 'test query');

    await waitFor(() => {
      expect(onFiltersChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: 'test query'
        })
      );
    });
  });

  it('should handle priority change', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<StatefulFilterBar onFiltersChange={onFiltersChange} />);

    // Get all comboboxes
    const triggers = screen.getAllByRole('combobox');
    const priorityTrigger = triggers[0];
    await user.click(priorityTrigger);

    const option = await screen.findByRole('option', { name: 'Urgent' });
    await user.click(option);

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'urgent'
      })
    );
  });

  it('should handle label selection', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const availableLabels = ['bug', 'feature'];
    render(
      <TaskFilterBar
        filters={initialFilters}
        onFiltersChange={onFiltersChange}
        availableLabels={availableLabels}
      />
    );

    // Click label filter button
    const labelBtn = screen.getByRole('button', { name: /All Labels/i });
    await user.click(labelBtn);

    const bugBtn = await screen.findByRole('button', { name: 'bug' });
    await user.click(bugBtn);

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'bug'
      })
    );
  });

  it('should handle date filters', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<TaskFilterBar filters={initialFilters} onFiltersChange={onFiltersChange} />);

    await user.click(screen.getByRole('button', { name: /Due Date/i }));

    const dateInputs = screen.getAllByPlaceholderText('Select date');
    // First is "before", second is "after"
    fireEvent.change(dateInputs[0], { target: { value: '2024-12-31' } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dueBefore: '2024-12-31'
      })
    );

    fireEvent.change(dateInputs[1], { target: { value: '2024-01-01' } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dueAfter: '2024-01-01'
      })
    );
  });

  it('should handle sort change', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<StatefulFilterBar onFiltersChange={onFiltersChange} />);

    const triggers = screen.getAllByRole('combobox');
    const sortTrigger = triggers[1];
    await user.click(sortTrigger);

    const option = await screen.findByRole('option', { name: 'Priority' });
    await user.click(option);

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortBy: 'priority'
      })
    );
  });

  it('should toggle sort order', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    render(<StatefulFilterBar onFiltersChange={onFiltersChange} />);

    const sortOrderBtn = screen.getByRole('button', { name: /Sort Descending/i });
    await user.click(sortOrderBtn);

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sortOrder: 'asc'
      })
    );
  });

  it('should show clear filters button when filters are active', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const activeFilters = { ...initialFilters, search: 'something' };
    render(<TaskFilterBar filters={activeFilters} onFiltersChange={onFiltersChange} />);

    expect(screen.getByText('Clear Filters')).toBeInTheDocument();

    await user.click(screen.getByText('Clear Filters'));
    expect(onFiltersChange).toHaveBeenCalledWith(initialFilters);
  });
});
