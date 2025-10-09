import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { VStack, HStack, Grid, Center, Box } from '../../../styled-system/jsx';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { useSpace } from '../../contexts/SpaceContext';
import { TaskDialog } from '../../components/Board/TaskDialog';
import { MoveTaskDialog } from '../../components/MoveTaskDialog';
import { useTaskActions } from '../../hooks/useTaskActions';
import { useQueryState, useDateQueryState } from '../../hooks/useQueryState';
import type { CalendarEvent, ExtendedTask, Habit } from '../../shared/types/calendar';
import type { Task } from '../../shared/types/board';
import { HabitsCard } from '../../components/Agenda/HabitsCard';
import { AgendaWeekView } from '../../components/Agenda/AgendaWeekView';
import { AgendaDayView } from '../../components/Agenda/AgendaDayView';
import { AgendaSidebar } from '../../components/Agenda/AgendaSidebar';
import { OverdueTasksCard } from '../../components/Agenda/OverdueTasksCard';
import { StatsCard } from '../../components/Agenda/StatsCard';
import { calendarEventToExtendedTask } from '../../utils/type-converters';
import { Spinner } from '../../components/ui/spinner';
import { isTaskCompleted } from '../../shared/utils/taskCompletion';

interface CompleteTaskPayload {
  id: string;
  completed: boolean;
  instanceDate?: string | Date;
}

export default function AgendaPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'day');
  const [selectedDate, setSelectedDate] = useDateQueryState('date');
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Use task actions hook
  const taskActions = useTaskActions({
    onTaskEdit: (task) => {
      const extendedTask = calendarEventToExtendedTask(task as CalendarEvent);
      setEditingTask(extendedTask);
      setIsTaskDialogOpen(true);
    },
    onSuccess: () => {
      refetchEvents();
    }
  });

  // Get calendar events
  const {
    data: events,
    refetch: refetchEvents,
    isLoading: isLoadingEvents,
    isError: isErrorEvents
  } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', selectedDate, viewMode, currentSpace],
    queryFn: async () => {
      let start: Date, end: Date;

      if (viewMode === 'day') {
        // Get local midnight and end of day
        // For day view, fetch from 30 days ago to include overdue tasks
        start = new Date(selectedDate);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
      } else {
        // Week view - local timezone boundaries
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(weekEnd);
        end.setHours(23, 59, 59, 999);
      }

      // Convert to UNIX timestamps (seconds)
      const startUnix = Math.floor(start.getTime() / 1000);
      const endUnix = Math.floor(end.getTime() / 1000);

      const response = await fetch(
        `/api/calendar/events?start=${startUnix}&end=${endUnix}&space=${currentSpace}`
      );
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    }
  });

  const {
    data: habits,
    refetch: refetchHabits,
    isLoading: isLoadingHabits,
    isError: isErrorHabits
  } = useQuery<Habit[]>({
    queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), currentSpace, viewMode],
    queryFn: async () => {
      const dateStr =
        viewMode === 'day'
          ? format(selectedDate, 'yyyy-MM-dd')
          : format(startOfWeek(selectedDate), 'yyyy-MM-dd');
      const response = await fetch(
        `/api/habits?date=${dateStr}&space=${currentSpace}&view=${viewMode}`
      );
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completed, instanceDate }: CompleteTaskPayload) => {
      const body: { completed: boolean; instanceDate?: string } = { completed };
      if (instanceDate) {
        body.instanceDate =
          instanceDate instanceof Date ? instanceDate.toISOString().split('T')[0] : instanceDate;
      }
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      refetchEvents();
    }
  });

  const toggleHabitMutation = useMutation({
    mutationFn: async ({
      habitId,
      date,
      completed
    }: {
      habitId: string;
      date: Date;
      completed: boolean;
    }) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(`/api/habits/${habitId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, completed })
      });
      if (!response.ok) throw new Error('Failed to toggle habit');
      return response.json();
    },
    onSuccess: () => {
      refetchHabits();
    }
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, space: currentSpace })
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: () => {
      setEditingTask(null);
      setIsTaskDialogOpen(false);
      refetchEvents();
    }
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const response = await fetch(`/api/tasks/${taskData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      setEditingTask(null);
      setIsTaskDialogOpen(false);
      refetchEvents();
    }
  });

  // Carry over tasks mutation
  const carryOverTasksMutation = useMutation({
    mutationFn: async ({ taskIds, targetDate }: { taskIds: string[]; targetDate: Date }) => {
      // Get unique task IDs since recurring tasks may have duplicate IDs
      const uniqueTaskIds = Array.from(new Set(taskIds));

      const promises = uniqueTaskIds.map((taskId) => {
        // Preserve time, just update date
        const task = overdueTasks.find((t) => t.id === taskId);
        if (!task?.dueDate) {
          console.warn(`Task ${taskId} not found in overdue tasks or has no due date`);
          return Promise.resolve();
        }

        const oldDate = new Date(task.dueDate);
        const newDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          oldDate.getHours(),
          oldDate.getMinutes(),
          oldDate.getSeconds()
        );

        return fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dueDate: newDate.toISOString() })
        });
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    }
  });

  const completeTask = (event: CalendarEvent) => {
    const currentlyCompleted = isTaskCompleted(event);
    completeTaskMutation.mutate({
      id: event.id,
      completed: !currentlyCompleted,
      instanceDate: event.instanceDate || event.dueDate
    });
  };

  const handleTaskClick = (event: CalendarEvent) => {
    const extendedTask = calendarEventToExtendedTask(event);
    setEditingTask(extendedTask);
    setIsTaskDialogOpen(true);
  };

  const handleDialogSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const taskData: Partial<Task> & { id?: string } = editingTask
      ? {
          id: editingTask.id,
          title: data.title,
          description: data.description
        }
      : {
          title: data.title,
          description: data.description
        };

    if (data.dueDate) {
      // Convert datetime-local to UTC ISO string
      const dateStr = data.dueDate;
      // If already UTC ISO string (from TaskDialog), keep it
      if (dateStr.includes('Z')) {
        taskData.dueDate = dateStr;
      } else {
        // datetime-local format: YYYY-MM-DDTHH:mm - convert to UTC
        const localDate = new Date(dateStr);
        taskData.dueDate = localDate.toISOString();
      }
    }

    if (data.priority && data.priority !== 'none') {
      taskData.priority = data.priority as 'low' | 'medium' | 'high' | 'urgent';
    }

    if (data.labels) {
      try {
        taskData.labels = JSON.parse(data.labels);
      } catch (e) {
        console.error('Failed to parse labels:', e);
      }
    }

    if (data.subtasks) {
      try {
        taskData.subtasks = JSON.parse(data.subtasks);
      } catch (e) {
        console.error('Failed to parse subtasks:', e);
      }
    }

    if (data.recurringPattern) {
      taskData.recurringPattern = data.recurringPattern;
    }

    if (data.recurringEndDate) {
      taskData.recurringEndDate = data.recurringEndDate;
    }

    if (data.createReminder) {
      taskData.createReminder = data.createReminder === 'true';
    }

    if (data.link) {
      taskData.link = data.link;
    }

    if (editingTask) {
      updateTaskMutation.mutate(taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  // Separate overdue tasks
  const overdueTasks = useMemo(() => {
    if (!events || viewMode !== 'day') {
      return [];
    }

    const now = new Date();
    const overdue: CalendarEvent[] = [];

    events.forEach((event) => {
      if (!event.dueDate || isTaskCompleted(event)) return;

      const eventDate = new Date(event.dueDate);

      // Include tasks that are past their due date/time
      if (eventDate < now) {
        overdue.push(event);
      }
    });

    return overdue;
  }, [events, viewMode]);

  const groupedEvents = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    if (viewMode === 'week') {
      // Initialize all days of the week
      for (let i = 0; i < 7; i++) {
        const date = addDays(startOfWeek(selectedDate), i);
        const dateKey = format(date, 'yyyy-MM-dd');
        grouped[dateKey] = [];
      }
    } else {
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      grouped[dateKey] = [];
    }

    // Group events
    events?.forEach((event) => {
      // Always use dueDate converted to local timezone for grouping (ignore instanceDate)
      // instanceDate is in UTC format and causes timezone issues
      if (!event.dueDate) return;

      // Parse the UTC date and extract local date for grouping
      const eventDate = new Date(event.dueDate);
      const year = eventDate.getFullYear();
      const month = String(eventDate.getMonth() + 1).padStart(2, '0');
      const day = String(eventDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      if (grouped[dateKey]) {
        grouped[dateKey].push(event);
      }
    });

    return grouped;
  }, [events, viewMode, selectedDate]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!events) {
      return { total: 0, completed: 0, remaining: 0, overdue: 0, todo: 0 };
    }

    const now = new Date();
    let filteredEvents: CalendarEvent[];

    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate);
      const weekEnd = endOfWeek(selectedDate);
      filteredEvents = events.filter((event) => {
        if (!event.dueDate) return false;
        const eventDate = new Date(event.dueDate);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });
    } else {
      // Day view
      const dayKey = format(selectedDate, 'yyyy-MM-dd');
      filteredEvents = events.filter((event) => {
        if (!event.dueDate) return false;
        return format(new Date(event.dueDate), 'yyyy-MM-dd') === dayKey;
      });
    }

    const completed = filteredEvents.filter((event) => isTaskCompleted(event)).length;
    const overdue = filteredEvents.filter((event) => {
      if (isTaskCompleted(event)) return false;
      if (!event.dueDate) return false;
      const dueDate = new Date(event.dueDate);
      return dueDate < now;
    }).length;
    const todo = filteredEvents.filter((event) => {
      if (isTaskCompleted(event)) return false;
      if (!event.dueDate) return false;
      const dueDate = new Date(event.dueDate);
      return dueDate >= now; // Future or today (not overdue)
    }).length;

    // Add incomplete habits to todo count (only for day view)
    const incompleteHabitsCount =
      viewMode === 'day' && habits ? habits.filter((habit) => !habit.completedToday).length : 0;

    const total = filteredEvents.length;

    return {
      total: total + incompleteHabitsCount,
      completed,
      remaining: total - completed + incompleteHabitsCount,
      overdue,
      todo: todo + incompleteHabitsCount
    };
  }, [events, viewMode, selectedDate, habits]);

  return (
    <Box data-space={currentSpace} p={{ base: '2', md: '4' }}>
      <VStack gap="6" alignItems="stretch">
        {/* Header */}
        <VStack gap="4" alignItems="stretch" width="100%">
          <HStack
            gap="3"
            justifyContent="space-between"
            alignItems="center"
            flexWrap={{ base: 'wrap', md: 'nowrap' }}
          >
            <VStack flex="1" gap="1" alignItems="start" minW={{ base: 'full', md: 'auto' }}>
              <Heading size={{ base: 'xl', md: '2xl' }}>Agenda</Heading>
              <Text color="fg.muted" fontSize={{ base: 'xs', md: 'sm' }}>
                {viewMode === 'day'
                  ? format(selectedDate, 'EEEE, MMM d, yyyy')
                  : `Week of ${format(startOfWeek(selectedDate), 'MMM d, yyyy')}`}
              </Text>
            </VStack>

            <HStack gap="2" justifyContent={{ base: 'flex-start', md: 'flex-end' }} flexWrap="wrap">
              {/* Create Task Button */}
              <Button
                variant="solid"
                size={{ base: 'xs', sm: 'sm' }}
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskDialogOpen(true);
                }}
              >
                <Plus width="16" height="16" />
                <Box display={{ base: 'none', sm: 'block' }}>New Task</Box>
              </Button>

              {/* View Mode Toggle */}
              <HStack gap="1">
                <Button
                  variant={viewMode === 'day' ? 'solid' : 'ghost'}
                  size={{ base: 'xs', sm: 'sm' }}
                  onClick={() => setViewMode('day')}
                >
                  Day
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'solid' : 'ghost'}
                  size={{ base: 'xs', sm: 'sm' }}
                  onClick={() => setViewMode('week')}
                >
                  Week
                </Button>
              </HStack>

              {/* Date Navigation */}
              <HStack gap="1">
                <IconButton
                  variant="ghost"
                  size={{ base: 'xs', sm: 'sm' }}
                  onClick={() =>
                    setSelectedDate(
                      viewMode === 'day' ? addDays(selectedDate, -1) : addDays(selectedDate, -7)
                    )
                  }
                  aria-label="Previous"
                >
                  <ChevronLeft width="16" height="16" />
                </IconButton>
                <Button
                  variant="ghost"
                  size={{ base: 'xs', sm: 'sm' }}
                  onClick={() => setSelectedDate(new Date())}
                >
                  Today
                </Button>
                <IconButton
                  variant="ghost"
                  size={{ base: 'xs', sm: 'sm' }}
                  onClick={() =>
                    setSelectedDate(
                      viewMode === 'day' ? addDays(selectedDate, 1) : addDays(selectedDate, 7)
                    )
                  }
                  aria-label="Next"
                >
                  <ChevronRight width="16" height="16" />
                </IconButton>
              </HStack>
            </HStack>
          </HStack>
        </VStack>

        {/* Main Content */}
        {isLoadingEvents ? (
          <Center minH="60vh">
            <Spinner size="xl" label="Loading events..." />
          </Center>
        ) : isErrorEvents ? (
          <Center>Error loading events</Center>
        ) : viewMode === 'week' ? (
          <Grid gap={4} gridTemplateColumns={{ base: '1fr', xl: '4fr 1fr' }} w="full" h="full">
            <AgendaWeekView
              selectedDate={selectedDate}
              viewMode={viewMode}
              groupedEvents={groupedEvents}
              habits={habits}
              onToggleHabit={(params) => toggleHabitMutation.mutate(params)}
              onTaskClick={handleTaskClick}
              onToggleTask={completeTask}
            />
            <AgendaSidebar
              habits={habits}
              isLoadingHabits={isLoadingHabits}
              isErrorHabits={isErrorHabits}
              stats={stats}
              statsTitle="Weekly Stats"
            />
          </Grid>
        ) : (
          // Day View - CSS Grid with responsive positioning
          <Grid
            gap={4}
            gridTemplateColumns={{ base: '1fr', lg: '4fr 1fr' }}
            gridTemplateRows={{ base: 'auto auto auto', lg: 'auto auto' }}
            w="full"
          >
            {/* Habits - Top on mobile, sidebar top on desktop */}
            <Box gridColumn={{ base: '1', lg: '2' }} gridRow={{ base: '1', lg: '1' }}>
              <HabitsCard
                habits={habits}
                isLoading={isLoadingHabits}
                isError={isErrorHabits}
                onToggleHabit={(habit) =>
                  toggleHabitMutation.mutate({
                    habitId: habit.id,
                    date: selectedDate,
                    completed: !habit.completedToday
                  })
                }
              />
            </Box>

            {/* Tasks - Middle on mobile, left spanning both rows on desktop */}
            <Box gridColumn={{ base: '1', lg: '1' }} gridRow={{ base: '2', lg: '1 / 3' }}>
              <VStack gap="3" alignItems="stretch" w="full">
                <OverdueTasksCard
                  overdueTasks={overdueTasks}
                  onCarryOver={(taskIds, targetDate) => {
                    carryOverTasksMutation.mutate({ taskIds, targetDate });
                  }}
                  onToggleComplete={completeTask}
                  onTaskClick={(event) => taskActions.handleEdit(event)}
                  onDuplicate={(event) => taskActions.handleDuplicate(event)}
                  onDelete={(event) => taskActions.handleDelete(event)}
                  onMove={(event) => taskActions.handleMove(event)}
                  extraActions={taskActions.extraActions}
                  isCarryingOver={carryOverTasksMutation.isPending}
                />
                <AgendaDayView
                  selectedDate={selectedDate}
                  events={(groupedEvents[format(selectedDate, 'yyyy-MM-dd')] || []).filter(
                    (event) => !overdueTasks.includes(event)
                  )}
                  onToggleComplete={completeTask}
                  onTaskClick={(event) => taskActions.handleEdit(event)}
                  onDuplicate={(event) => taskActions.handleDuplicate(event)}
                  onDelete={(event) => taskActions.handleDelete(event)}
                  onMove={(event) => taskActions.handleMove(event)}
                  onCarryOver={(taskId, targetDate) => {
                    carryOverTasksMutation.mutate({ taskIds: [taskId], targetDate });
                  }}
                  extraActions={taskActions.extraActions}
                />
              </VStack>
            </Box>

            {/* Stats - Bottom on mobile, sidebar bottom on desktop */}
            <Box gridColumn={{ base: '1', lg: '2' }} gridRow={{ base: '3', lg: '2' }}>
              <StatsCard title="Daily Stats" stats={stats} />
            </Box>
          </Grid>
        )}

        {/* Task Dialog */}
        <TaskDialog
          open={isTaskDialogOpen}
          onOpenChange={(isOpen) => {
            setIsTaskDialogOpen(isOpen);
            if (!isOpen) {
              // Delay reset until after dialog animation completes
              setTimeout(() => setEditingTask(null), 200);
            }
          }}
          mode={editingTask ? 'edit' : 'create'}
          task={editingTask ? (editingTask as Task) : undefined}
          onSubmit={handleDialogSubmit}
        />

        {/* Move Task Dialog */}
        <MoveTaskDialog
          open={taskActions.isMoveDialogOpen}
          onOpenChange={taskActions.setIsMoveDialogOpen}
          task={taskActions.taskToMove}
          onMove={(taskId, columnId) => taskActions.moveTaskMutation.mutate({ taskId, columnId })}
          isMoving={taskActions.isMoving}
        />
      </VStack>
    </Box>
  );
}
