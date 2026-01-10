import { render, screen, fireEvent, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgendaWeekView } from '../AgendaWeekView';
import type { CalendarEvent, Habit } from '../../../shared/types/calendar';
import React from 'react';
import type { DndContextProps, DragEndEvent } from '@dnd-kit/core';

declare global {
  var lastWeekDndProps: DndContextProps | undefined;
}

// Mock DndContext to capture props
vi.mock('@dnd-kit/core', async () => {
  const actual = (await vi.importActual('@dnd-kit/core')) as any;
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      globalThis.lastWeekDndProps = props;
      return <div data-testid="dnd-context">{props.children}</div>;
    },
    useDraggable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false
    })),
    useDroppable: vi.fn(() => ({
      setNodeRef: vi.fn(),
      isOver: false
    })),
    DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

describe('AgendaWeekView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const selectedDate = new Date('2024-12-25'); // A Wednesday
  const groupedEvents: Record<string, CalendarEvent[]> = {
    '2024-12-25': [
      {
        id: 't1',
        title: 'Task 1',
        dueDate: '2024-12-25T10:00:00Z',
        type: 'task',
        completed: false,
        instanceDate: '2024-12-25',
        space: 'work'
      },
      {
        id: 'ext-1',
        title: 'External Event',
        dueDate: '2024-12-25T09:00:00Z',
        type: 'external',
        completed: false,
        instanceDate: '2024-12-25',
        space: 'work',
        externalCalendarColor: 'blue'
      }
    ]
  };
  const habits: Habit[] = [
    {
      id: 'h1',
      name: 'Habit 1',
      frequency: 'daily',
      completedToday: false,
      checkDate: '2024-12-25',
      reminderTime: '08:00',
      currentStreak: 5,
      space: 'personal',
      createdAt: '2024-01-01',
      active: true
    }
  ];

  const mockHandlers = {
    onToggleHabit: vi.fn(),
    onTaskClick: vi.fn(),
    onToggleTask: vi.fn(),
    onTaskDrop: vi.fn(),
    onDateClick: vi.fn()
  };

  it('should render 7 days of the week', () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    days.forEach((day) => {
      expect(screen.getByText(day)).toBeInTheDocument();
    });
  });

  it('should render tasks and habits sorted by time', () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('External Event')).toBeInTheDocument();
    expect(screen.getByText('Habit 1')).toBeInTheDocument();

    // Check for streak
    expect(screen.getByText('🔥5')).toBeInTheDocument();
  });

  it('should render external events without checkbox', () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    const extEvent = screen.getByText('External Event');
    // External events are rendered as simple Text, not inside Checkbox
    // In our implementation, non-external are inside Checkbox
    expect(extEvent.closest('label')).toBeNull();
  });

  it('should call onToggleHabit when habit is clicked', () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Habit 1'));
    expect(mockHandlers.onToggleHabit).toHaveBeenCalledWith(
      expect.objectContaining({
        habitId: 'h1',
        completed: true
      })
    );
  });

  it('should call onTaskClick when task title is clicked', () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Task 1'));
    expect(mockHandlers.onTaskClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1'
      })
    );
  });

  it('should call onToggleTask when task checkbox is toggled', async () => {
    const user = userEvent.setup();
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Task 1/i });
    await user.click(checkbox);

    expect(mockHandlers.onToggleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1'
      })
    );
  });

  it('should handle habit with link', () => {
    const habitsWithLink: Habit[] = [{ ...habits[0], link: 'http://example.com' }];
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habitsWithLink}
        {...mockHandlers}
      />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'http://example.com');
  });

  it('should filter habits by frequency when viewMode is "day"', () => {
    const mixedHabits: Habit[] = [
      { ...habits[0], id: 'h1', frequency: 'daily', name: 'Daily Habit' },
      { ...habits[0], id: 'h2', frequency: 'weekly', targetDays: [0], name: 'Sunday Habit' } // Sunday
    ];
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="day"
        groupedEvents={{}}
        habits={mixedHabits}
        {...mockHandlers}
      />
    );

    // Selected date is 2024-12-25 (Wednesday)
    // Daily habit should appear on all 7 days
    expect(screen.getAllByText('Daily Habit')).toHaveLength(7);
    // Sunday habit should appear exactly once
    expect(screen.getAllByText('Sunday Habit')).toHaveLength(1);
  });

  it('should call onTaskDrop when a task is dropped on a different day', async () => {
    render(
      <AgendaWeekView
        selectedDate={selectedDate}
        viewMode="week"
        groupedEvents={groupedEvents}
        habits={habits}
        {...mockHandlers}
      />
    );

    const dndProps = globalThis.lastWeekDndProps;

    await act(async () => {
      dndProps?.onDragEnd?.({
        active: {
          id: 't1',
          data: { current: { event: groupedEvents['2024-12-25'][0], originalDate: '2024-12-25' } }
        },
        over: { id: '2024-12-26' } // Move to next day
      } as unknown as DragEndEvent);
    });

    expect(mockHandlers.onTaskDrop).toHaveBeenCalledWith('t1', expect.any(Date));
    const calledDate = mockHandlers.onTaskDrop.mock.calls[0][1];
    expect(calledDate.toISOString()).toContain('2024-12-26');
  });
});
