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
import { UpcomingTasksCard } from '../../components/Agenda/UpcomingTasksCard';
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
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');

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

  const {
    data: events,
    refetch: refetchEvents,
    isLoading: isLoadingEvents,
    isError: isErrorEvents
  } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', selectedDateKey, viewMode, currentSpace],
    queryFn: async () => {
      let start: Date, end: Date;

      if (viewMode === 'day') {
        start = jstToUtc(`${selectedDateKey}T00:00:00`);
        end = jstToUtc(`${selectedDateKey}T23:59:59`);
      } else {
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        start = jstToUtc(`${format(weekStart, 'yyyy-MM-dd')}T00:00:00`);
        end = jstToUtc(`${format(weekEnd, 'yyyy-MM-dd')}T23:59:59`);
      }

      const startUnix = Math.floor(start.getTime() / 1000);
      const endUnix = Math.ceil(end.getTime() / 1000);
      const query = new URLSearchParams({
        start: startUnix.toString(),
        end: endUnix.toString(),
        space: currentSpace,
        includeNoDueDate: 'true',
        ...(viewMode === 'day' ? { includeOverdue: 'true', includeUpcoming: 'true' } : {})
      });
      const response = await fetch(`/api/calendar/events?${query.toString()}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return (await response.json()) as CalendarEvent[];
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
      return data as unknown as Habit[];
    }
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ id, completed, instanceDate }: CompleteTaskPayload) => {
      const body: { completed: boolean; instanceDate?: string } = { completed };
      if (instanceDate) {
        body.instanceDate =
          instanceDate instanceof Date
            ? instanceDate.toISOString().split('T')[0]
            : (instanceDate as string);
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
        .habits({ id: habitId })
        .log.post({ date: dateStr, completed });
      if (error) throw new Error('Failed to toggle habit');
      return data;
    },
    onSuccess: () => {
      refetchHabits();
    }
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const { id: _, columnName: __, subtasks: ___, column: ____, ...payload } = taskData;
      const { data, error } = await api.api.tasks.post({
        title: taskData.title || 'Untitled',
        ...payload
      } as unknown as { title: string });
      if (error) throw new Error('Failed to create task');
      return data;
    },
    onSuccess: () => {
      setEditingTask(null);
      setIsTaskDialogOpen(false);
      refetchEvents();
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const { data, error } = await api.api
        .tasks({ id: taskData.id! })
        .patch(taskData as unknown as Partial<Task>);
      if (error) throw new Error('Failed to update task');
      return data;
    },
    onSuccess: () => {
      setEditingTask(null);
      setIsTaskDialogOpen(false);
      refetchEvents();
    }
  });

  const carryOverTasksMutation = useMutation({
    mutationFn: async ({ taskIds, targetDate }: { taskIds: string[]; targetDate: Date }) => {
      const uniqueTaskIds = Array.from(new Set(taskIds));

      const promises = uniqueTaskIds.map((taskId) => {
        const task = overdueTasks.find((t) => t.id === taskId);
        if (!task?.dueDate) {
          console.warn(`Task ${taskId} not found in overdue tasks or has no due date`);
          return Promise.resolve();
        }

        const newUtcDate = jstToUtc(targetDate);

        return api.api
          .tasks({ id: taskId })
          .patch({ dueDate: newUtcDate.toISOString() } as unknown as { dueDate: string });
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
    const partialTask: Partial<ExtendedTask> = {
      title: event.title,
      description: event.description,
      dueDate: event.dueDate ? new Date(event.dueDate).toISOString() : undefined,
      priority: event.priority as 'low' | 'medium' | 'high' | 'urgent' | undefined
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
          title: data.title as string,
          description: data.description as string
        }
      : {
          title: data.title as string,
          description: data.description as string
        };

    if (data.dueDate) {
      const dateStr = data.dueDate as string;
      if (dateStr.includes('Z')) {
        taskData.dueDate = dateStr;
      } else {
        const localDate = new Date(dateStr);
        taskData.dueDate = localDate.toISOString();
      }
    }

    if (data.priority && data.priority !== 'none') {
      taskData.priority = data.priority as 'low' | 'medium' | 'high' | 'urgent';
    }

    if (data.labels) {
      try {
        taskData.labels = JSON.parse(data.labels as string);
      } catch (parseError) {
        console.error('Failed to parse labels:', parseError);
      }
    }

    if (data.subtasks) {
      try {
        taskData.subtasks = JSON.parse(data.subtasks as string);
      } catch (parseError) {
        console.error('Failed to parse subtasks:', parseError);
      }
    }

    if (data.recurringPattern) {
      taskData.recurringPattern = data.recurringPattern as string;
    }

    if (data.recurringEndDate) {
      taskData.recurringEndDate = data.recurringEndDate as string;
    }

    if (data.createReminder) {
      taskData.createReminder = data.createReminder === 'true';
    }

    if (data.link) {
      taskData.link = data.link as string;
    }

    if (editingTask) {
      updateTaskMutation.mutate(taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  const handleAutoOrganize = async () => {
    try {
      let start: Date, end: Date;

      if (viewMode === 'day') {
        start = jstToUtc(`${selectedDateKey}T00:00:00`);
        end = jstToUtc(`${selectedDateKey}T23:59:59`);
      } else {
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        start = jstToUtc(`${format(weekStart, 'yyyy-MM-dd')}T00:00:00`);
        end = jstToUtc(`${format(weekEnd, 'yyyy-MM-dd')}T23:59:59`);
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

      refetchEvents();
    } catch (error) {
      console.error('Apply auto organize error:', error);
      toast?.('Failed to apply changes. Please try again.', { type: 'error' });
    }
  };

  const overdueTasks = useMemo(() => {
    if (!events || viewMode !== 'day') {
      return [];
    }

    const overdue: CalendarEvent[] = [];

    events.forEach((event) => {
      if (!event.dueDate || isTaskCompleted(event)) return;

      const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');

      if (eventDateKey < selectedDateKey) {
        overdue.push(event);
      }
    });

    return overdue;
  }, [events, selectedDateKey, viewMode]);

  const unscheduledAndUpcomingTasks = useMemo(() => {
    if (!events) {
      return [];
    }

    const tasks: CalendarEvent[] = [];

    events.forEach((event) => {
      if (isTaskCompleted(event)) return;

      if (!event.dueDate) {
        tasks.push({ ...event, isUpcoming: false });
        return;
      }

      const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');

      if (eventDateKey > selectedDateKey) {
        tasks.push({ ...event, isUpcoming: true });
      }
    });

    return tasks.toSorted((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return -1;
      if (!b.dueDate) return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [events, selectedDateKey]);

  const groupedEvents = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    if (viewMode === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = addDays(startOfWeek(selectedDate), i);
        const dateKey = format(date, 'yyyy-MM-dd');
        grouped[dateKey] = [];
      }
    } else {
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      grouped[dateKey] = [];
    }

    events?.forEach((event) => {
      if (!event.dueDate) return;

      const dateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');

      if (grouped[dateKey]) {
        grouped[dateKey].push(event);
      }
    });

    return grouped;
  }, [events, viewMode, selectedDate]);

  const stats = useMemo(() => {
    if (!events) {
      return { total: 0, completed: 0, remaining: 0, overdue: 0, todo: 0 };
    }

    let filteredEvents: CalendarEvent[];

    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate);
      const weekEnd = endOfWeek(selectedDate);
      const weekStartKey = format(weekStart, 'yyyy-MM-dd');
      const weekEndKey = format(weekEnd, 'yyyy-MM-dd');
      filteredEvents = events.filter((event) => {
        if (!event.dueDate) return false;
        const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');
        return eventDateKey >= weekStartKey && eventDateKey <= weekEndKey;
      });
    } else {
      filteredEvents = events.filter((event) => {
        if (!event.dueDate) return false;
        const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');
        return eventDateKey === selectedDateKey;
      });
    }

    const completed = filteredEvents.filter((event) => isTaskCompleted(event)).length;
    const overdue = filteredEvents.filter((event) => {
      if (isTaskCompleted(event)) return false;
      if (!event.dueDate) return false;
      const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');
      return eventDateKey < selectedDateKey;
    }).length;
    const todo = filteredEvents.filter((event) => {
      if (isTaskCompleted(event)) return false;
      if (!event.dueDate) return false;
      const eventDateKey = event.instanceDate || format(new Date(event.dueDate), 'yyyy-MM-dd');
      return eventDateKey >= selectedDateKey;
    }).length;

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
  }, [events, viewMode, selectedDate, selectedDateKey, habits]);

  return (
    <Box data-space={currentSpace} p={{ base: '2', md: '4' }}>
      <VStack gap="6" alignItems="stretch">
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
              <Button
                variant="outline"
                size={{ base: 'xs', sm: 'sm' }}
                onClick={handleAutoOrganize}
                loading={autoOrganizeMutation.isPending}
                aria-label="Auto Organize"
              >
                <Sparkles width="16" height="16" />
                <Box display={{ base: 'none', sm: 'block' }}>Auto Organize</Box>
              </Button>

              <Button
                variant="solid"
                size={{ base: 'xs', sm: 'sm' }}
                onClick={() => {
                  setEditingTask(null);
                  setIsTaskDialogOpen(true);
                }}
                aria-label="New Task"
              >
                <Plus width="16" height="16" />
                <Box display={{ base: 'none', sm: 'block' }}>New Task</Box>
              </Button>

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
          <Grid
            gap={4}
            gridTemplateColumns={{ base: '1fr', lg: '4fr 1fr' }}
            gridTemplateRows={{ base: 'auto auto auto', lg: 'auto auto' }}
            w="full"
          >
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
                onCompleteAll={() => {
                  habits
                    ?.filter((habit) => !habit.completedToday)
                    .forEach((habit) => {
                      toggleHabitMutation.mutate({
                        habitId: habit.id,
                        date: selectedDate,
                        completed: true
                      });
                    });
                }}
              />
            </Box>

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
                  events={(groupedEvents[selectedDateKey] || []).filter(
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

                {unscheduledAndUpcomingTasks.length > 0 && (
                  <UpcomingTasksCard
                    tasks={unscheduledAndUpcomingTasks}
                    onToggleComplete={completeTask}
                    onTaskClick={(event) => taskActions.handleEdit(event)}
                    onDuplicate={(event) => taskActions.handleDuplicate(event)}
                    onDelete={(event) => taskActions.handleDelete(event)}
                    onMove={(event) => taskActions.handleMove(event)}
                    onCreateCopy={handleCreateCopy}
                    extraActions={taskActions.extraActions}
                  />
                )}
              </VStack>
            </Box>

            <Box gridColumn={{ base: '1', lg: '2' }} gridRow={{ base: '3', lg: '2' }}>
              <StatsCard title="Daily Stats" stats={stats} />
            </Box>
          </Grid>
        )}

        <TaskDialog
          open={isTaskDialogOpen}
          onOpenChange={(isOpen) => {
            setIsTaskDialogOpen(isOpen);
            if (!isOpen) {
              setTimeout(() => setEditingTask(null), 200);
            }
          }}
          mode={editingTask && editingTask.id ? 'edit' : 'create'}
          task={editingTask ? (editingTask as Task) : undefined}
          onSubmit={handleDialogSubmit}
        />

        <MoveTaskDialog
          open={taskActions.isMoveDialogOpen}
          onOpenChange={taskActions.setIsMoveDialogOpen}
          task={taskActions.taskToMove}
          onMove={(taskId, columnId) => taskActions.moveTaskMutation.mutate({ taskId, columnId })}
          isMoving={taskActions.isMoving}
        />

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
