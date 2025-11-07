import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
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
import { jstToUtc } from '../../shared/utils/timezone';
import { AutoOrganizeDialog } from '../../components/AutoOrganize/AutoOrganizeDialog';
import {
  useAutoOrganize,
  useApplyAutoOrganize
} from '../../components/AutoOrganize/useAutoOrganize';
import { useToaster } from '../../contexts/ToasterContext';
import type { AutoOrganizeSuggestion } from '../../shared/types/autoOrganize';
import { api } from '../../api/client';

interface CompleteTaskPayload {
  id: string;
  completed: boolean;
  instanceDate?: string | Date;
}

export default function AgendaPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const { toast } = useToaster();
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'day');
  const [selectedDate, setSelectedDate] = useDateQueryState('date');
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isAutoOrganizeDialogOpen, setIsAutoOrganizeDialogOpen] = useState(false);
  const [autoOrganizeSuggestions, setAutoOrganizeSuggestions] = useState<AutoOrganizeSuggestion[]>(
    []
  );
  const [autoOrganizeSummary, setAutoOrganizeSummary] = useState<string>('');
  const [totalTasksAnalyzed, setTotalTasksAnalyzed] = useState<number>(0);

  const autoOrganizeMutation = useAutoOrganize();
  const applyAutoOrganizeMutation = useApplyAutoOrganize();

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
        // Day view: fetch only the selected day
        start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
      } else {
        // Week view: fetch the entire week
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(weekEnd);
        end.setHours(23, 59, 59, 999);
      }

      // Convert to UNIX timestamps (seconds)
      // Use Math.floor for start, but Math.ceil for end to include tasks at end of day
      const startUnix = Math.floor(start.getTime() / 1000);
      const endUnix = Math.ceil(end.getTime() / 1000);

      const { data, error } = await api.api.calendar.events.get({
        query: {
          start: startUnix.toString(),
          end: endUnix.toString(),
          space: currentSpace,
          ...(viewMode === 'day' ? { includeOverdue: 'true' } : {})
        }
      });
      if (error) throw new Error('Failed to fetch events');
      return data;
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
      const { data, error } = await api.api.habits.get({
        query: { date: dateStr, space: currentSpace, view: viewMode }
      });
      if (error) throw new Error('Failed to fetch habits');
      return data;
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
      const { data, error } = await api.api.tasks({ id }).patch(body);
      if (error) throw new Error('Failed to update task');
      return data;
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
      const { data, error } = await api.api
        .habits({ habitId })
        .log.post({ date: dateStr, completed });
      if (error) throw new Error('Failed to toggle habit');
      return data;
    },
    onSuccess: () => {
      refetchHabits();
    }
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const { data, error } = await api.api.tasks.post({ ...taskData, space: currentSpace });
      if (error) throw new Error('Failed to create task');
      return data;
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
      const { data, error } = await api.api.tasks({ id: taskData.id! }).patch(taskData);
      if (error) throw new Error('Failed to update task');
      return data;
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
        const task = overdueTasks.find((t) => t.id === taskId);
        if (!task?.dueDate) {
          console.warn(`Task ${taskId} not found in overdue tasks or has no due date`);
          return Promise.resolve();
        }

        // targetDate is a Date object with JST time components
        // We need to convert it properly to UTC for storage
        const newUtcDate = jstToUtc(targetDate);

        return api.api.tasks({ id: taskId }).patch({ dueDate: newUtcDate.toISOString() });
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', currentSpace] });
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

  const handleCreateCopy = (event: CalendarEvent) => {
    // For external events, create a partial task with the event's data
    // This will open the TaskDialog with pre-filled fields, allowing user to review/edit
    const partialTask: Partial<ExtendedTask> = {
      title: event.title,
      description: event.description,
      dueDate: event.dueDate ? new Date(event.dueDate).toISOString() : undefined,
      priority: event.priority as 'low' | 'medium' | 'high' | 'urgent' | undefined
      // No board/column info - will default to inbox
    };
    setEditingTask(partialTask as ExtendedTask);
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

  // Auto Organize handlers
  const handleAutoOrganize = async () => {
    try {
      let start: Date, end: Date;

      if (viewMode === 'day') {
        start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
      } else {
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        start = new Date(weekStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(weekEnd);
        end.setHours(23, 59, 59, 999);
      }

      const startUnix = Math.floor(start.getTime() / 1000);
      const endUnix = Math.ceil(end.getTime() / 1000);

      const result = await autoOrganizeMutation.mutateAsync({
        space: currentSpace,
        startDate: startUnix,
        endDate: endUnix
      });

      setAutoOrganizeSuggestions(result.suggestions);
      setAutoOrganizeSummary(result.summary);
      setTotalTasksAnalyzed(result.totalTasksAnalyzed);
      setIsAutoOrganizeDialogOpen(true);
    } catch (error) {
      console.error('Auto organize error:', error);
      toast?.('Failed to generate suggestions. Please try again.', { type: 'error' });
    }
  };

  const handleApplyAutoOrganize = async (suggestions: AutoOrganizeSuggestion[]) => {
    try {
      const result = await applyAutoOrganizeMutation.mutateAsync(suggestions);

      setIsAutoOrganizeDialogOpen(false);

      toast?.(
        `Successfully organized ${result.applied} tasks${result.failed > 0 ? `. ${result.failed} failed.` : ''}`,
        { type: 'success' }
      );

      // Refetch events to show updated tasks
      refetchEvents();
    } catch (error) {
      console.error('Apply auto organize error:', error);
      toast?.('Failed to apply changes. Please try again.', { type: 'error' });
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
              {/* Auto Organize Button */}
              <Button
                variant="outline"
                size={{ base: 'xs', sm: 'sm' }}
                onClick={handleAutoOrganize}
                loading={autoOrganizeMutation.isPending}
              >
                <Sparkles width="16" height="16" />
                <Box display={{ base: 'none', sm: 'block' }}>Auto Organize</Box>
              </Button>

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
          <Grid
            gap={4}
            gridTemplateColumns={{ base: '1fr', xl: '4fr 1fr' }}
            height="100%"
            minH="calc(100vh - 16rem)"
            flex={1}
          >
            <AgendaWeekView
              selectedDate={selectedDate}
              viewMode={viewMode}
              groupedEvents={groupedEvents}
              habits={habits}
              onToggleHabit={(params) => toggleHabitMutation.mutate(params)}
              onTaskClick={handleTaskClick}
              onToggleTask={completeTask}
              onTaskDrop={(taskId, newDate) => {
                updateTaskMutation.mutate({
                  id: taskId,
                  dueDate: newDate.toISOString()
                });
              }}
              onDateClick={(date) => {
                setSelectedDate(date);
                setViewMode('day');
              }}
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
                  onCreateCopy={handleCreateCopy}
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
                  onCreateCopy={handleCreateCopy}
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

        {/* Auto Organize Dialog */}
        <AutoOrganizeDialog
          open={isAutoOrganizeDialogOpen}
          onOpenChange={setIsAutoOrganizeDialogOpen}
          suggestions={autoOrganizeSuggestions}
          onApply={handleApplyAutoOrganize}
          isApplying={applyAutoOrganizeMutation.isPending}
          summary={autoOrganizeSummary}
          totalTasksAnalyzed={totalTasksAnalyzed}
        />
      </VStack>
    </Box>
  );
}
