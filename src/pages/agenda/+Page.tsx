import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { VStack, HStack, Grid, Center, Box } from '../../../styled-system/jsx';
import * as Card from '../../components/ui/styled/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { IconButton } from '../../components/ui/icon-button';
import { useSpace } from '../../contexts/SpaceContext';
import { TaskDialog } from '../../components/Board/TaskDialog';
import { useQueryState, useDateQueryState } from '../../hooks/useQueryState';
import type { CalendarEvent, ExtendedTask, Habit } from '../../shared/types/calendar';
import type { Task } from '../../shared/types/board';
import { TaskItem } from '../../components/Agenda/TaskItem';
import { calendarEventToExtendedTask } from '../../utils/type-converters';
import type { TaskFormData } from '../../shared/types/forms';

interface CompleteTaskPayload {
  id: string;
  completed: boolean;
  instanceDate?: string | Date;
}

export default function AgendaPage() {
  const queryClient = useQueryClient();
  const { currentSpace } = useSpace();
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'week');
  const [selectedDate, setSelectedDate] = useDateQueryState('date');
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Get calendar events
  const {
    data: events,
    refetch: refetchEvents,
    isLoading: isLoadingEvents,
    isError: isErrorEvents
  } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar', 'events', selectedDate, viewMode, currentSpace],
    queryFn: async () => {
      const start = viewMode === 'day' ? startOfDay(selectedDate) : startOfWeek(selectedDate);
      const end = viewMode === 'day' ? endOfDay(selectedDate) : endOfWeek(selectedDate);

      const response = await fetch(
        `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&space=${currentSpace}`
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
    queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), currentSpace],
    queryFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`/api/habits?date=${dateStr}&space=${currentSpace}`);
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

  const completeTask = (event: CalendarEvent) => {
    completeTaskMutation.mutate({
      id: event.id,
      completed: !event.completed,
      instanceDate: event.instanceDate || event.dueDate
    });
  };

  const handleTaskClick = (event: CalendarEvent) => {
    const extendedTask = calendarEventToExtendedTask(event);
    setEditingTask(extendedTask);
    setIsTaskDialogOpen(true);
  };

  const handleUpdateTask = (data: TaskFormData) => {
    if (!editingTask) return;

    updateTaskMutation.mutate(data);
  };

  const handleDialogSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const taskData: TaskFormData = {
      id: editingTask.id,
      title: data.title,
      description: data.description
    };

    if (data.dueDate) {
      taskData.dueDate = new Date(data.dueDate).toISOString();
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

    handleUpdateTask(taskData);
  };

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
      if (event.dueDate) {
        const dateKey = format(new Date(event.dueDate), 'yyyy-MM-dd');
        if (grouped[dateKey]) {
          grouped[dateKey].push(event);
        }
      }
    });

    return grouped;
  }, [events, viewMode, selectedDate]);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i));

  return (
    <Box w="full" py="4" px="4">
      <VStack gap="4">
        {/* Compact Header */}
        <HStack justifyContent="space-between" alignItems="center" width="100%" h="12">
          <HStack gap="4" alignItems="center">
            <Heading size="2xl">Agenda</Heading>
            <Text color="fg.muted" fontSize="lg">
              {viewMode === 'day'
                ? format(selectedDate, 'EEEE, MMM d, yyyy')
                : `Week of ${format(startOfWeek(selectedDate), 'MMM d, yyyy')}`}
            </Text>
          </HStack>

          <HStack gap="3">
            {/* View Mode Toggle */}
            <HStack gap="1">
              <Button
                variant={viewMode === 'day' ? 'solid' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'solid' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
            </HStack>

            {/* Date Navigation */}
            <HStack gap="1">
              <IconButton
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedDate(
                    viewMode === 'day' ? addDays(selectedDate, -1) : addDays(selectedDate, -7)
                  )
                }
                aria-label="Previous"
              >
                <ChevronLeft width="16" height="16" />
              </IconButton>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <IconButton
                variant="ghost"
                size="sm"
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

        {/* Main Content */}
        {isLoadingEvents ? (
          <Center>Loading...</Center>
        ) : isErrorEvents ? (
          <Center>Error loading events</Center>
        ) : viewMode === 'week' ? (
          <Grid gap={4} gridTemplateColumns={{ base: '1fr', lg: '3fr 1fr' }} w="full">
            {/* Week View - Grid Layout */}
            <VStack gap="3" alignItems="stretch" w="full">
              {/* Grid Header */}
              <Grid gap="2" gridTemplateColumns="repeat(7, 1fr)" w="full">
                {weekDates.map((date) => {
                  const isToday = isSameDay(date, new Date());
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayEvents = groupedEvents[dateKey] || [];
                  const isPast = date < new Date() && !isSameDay(date, new Date());

                  return (
                    <Box
                      key={date.toISOString()}
                      borderColor={isToday ? 'blue.default' : 'border.default'}
                      borderRadius="lg"
                      borderWidth="1px"
                      bg={isToday ? 'blue.subtle' : 'bg.default'}
                      opacity={isPast ? 0.7 : 1}
                      overflow="hidden"
                    >
                      {/* Day Header */}
                      <Box
                        borderBottomWidth="1px"
                        borderBottomColor="border.default"
                        p="2"
                        bg={isToday ? 'blue.subtle' : 'bg.subtle'}
                      >
                        <VStack gap="0.5" alignItems="center">
                          <Text
                            color={isToday ? 'blue.default' : 'fg.muted'}
                            fontSize="xs"
                            fontWeight="semibold"
                            textTransform="uppercase"
                          >
                            {format(date, 'EEE')}
                          </Text>
                          <Text
                            color={isToday ? 'blue.default' : 'fg.default'}
                            fontSize="xl"
                            fontWeight="bold"
                          >
                            {format(date, 'd')}
                          </Text>
                        </VStack>
                      </Box>

                      {/* Day Content */}
                      <Box minH="xs" maxH="md" p="2" overflowY="auto">
                        <VStack gap="2" alignItems="stretch">
                          {dayEvents.map((event) => (
                            <TaskItem
                              key={`${event.id}-${event.instanceDate}`}
                              event={event}
                              onToggleComplete={() => completeTask(event)}
                              onTaskClick={() => handleTaskClick(event)}
                            />
                          ))}
                          {dayEvents.length === 0 && (
                            <Text py="4" color="fg.subtle" fontSize="sm" textAlign="center">
                              No tasks
                            </Text>
                          )}
                        </VStack>
                      </Box>
                    </Box>
                  );
                })}
              </Grid>
            </VStack>
            {/* Sidebar for Habits and Stats */}
            <VStack display={{ base: 'none', lg: 'flex' }} gap={4}>
              {/* Weekly Stats Section */}
              <Card.Root w="full">
                <Card.Header>
                  <Card.Title>Weekly Stats</Card.Title>
                </Card.Header>
                <Card.Body>
                  <VStack gap={3} alignItems="stretch">
                    <Text py="4" color="fg.muted" textAlign="center">
                      Productivity analytics coming soon!
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Grid>
        ) : (
          // Day View - Grid Layout
          <Grid gap={4} gridTemplateColumns={{ base: '1fr', lg: '3fr 1fr' }} w="full">
            {/* Tasks for the day */}
            <VStack gap="3" alignItems="stretch" w="full">
              <Box borderRadius="lg" borderWidth="1px" minH="lg" p="4" bg="bg.default">
                <VStack gap="2" alignItems="stretch">
                  <Text mb="2" fontSize="lg" fontWeight="semibold">
                    Tasks for {format(selectedDate, 'MMM d')}
                  </Text>
                  {groupedEvents[format(selectedDate, 'yyyy-MM-dd')]?.map((event) => (
                    <TaskItem
                      key={`${event.id}-${event.instanceDate}`}
                      event={event}
                      onToggleComplete={() => completeTask(event)}
                      onTaskClick={() => handleTaskClick(event)}
                    />
                  ))}
                  {(!groupedEvents[format(selectedDate, 'yyyy-MM-dd')] ||
                    groupedEvents[format(selectedDate, 'yyyy-MM-dd')].length === 0) && (
                    <Text py="8" color="fg.subtle" textAlign="center">
                      No tasks scheduled
                    </Text>
                  )}
                </VStack>
              </Box>
            </VStack>

            {/* Sidebar for Habits and Stats */}
            <VStack display={{ base: 'none', lg: 'flex' }} gap={4}>
              {/* Habits Section */}
              <Card.Root w="full">
                <Card.Header>
                  <Card.Title>Daily Habits</Card.Title>
                </Card.Header>
                <Card.Body>
                  {isLoadingHabits ? (
                    <Center>Loading habits...</Center>
                  ) : isErrorHabits ? (
                    <Center>Error loading habits</Center>
                  ) : (
                    <VStack gap="2" alignItems="stretch">
                      {habits?.map((habit) => (
                        <HStack
                          key={habit.id}
                          borderRadius="md"
                          p="2"
                          bg={habit.completedToday ? 'green.subtle' : 'bg.subtle'}
                          transition="all 0.2s"
                        >
                          <Checkbox
                            checked={habit.completedToday}
                            onCheckedChange={({ checked }) =>
                              toggleHabitMutation.mutate({
                                habitId: habit.id,
                                date: selectedDate,
                                completed: !!checked
                              })
                            }
                            size="sm"
                          />
                          <VStack flex="1" gap="0.5" alignItems="start">
                            <Text
                              textDecoration={habit.completedToday ? 'line-through' : 'none'}
                              fontSize="sm"
                              fontWeight="medium"
                            >
                              {habit.name}
                            </Text>
                            {(habit.currentStreak ?? 0) > 0 && (
                              <Badge variant="subtle" size="sm">
                                🔥 {habit.currentStreak} days
                              </Badge>
                            )}
                          </VStack>
                        </HStack>
                      ))}
                      {(!habits || habits.length === 0) && (
                        <Text py="4" color="fg.subtle" fontSize="sm" textAlign="center">
                          No habits yet
                        </Text>
                      )}
                    </VStack>
                  )}
                </Card.Body>
              </Card.Root>

              {/* Daily Stats Section */}
              <Card.Root w="full">
                <Card.Header>
                  <Card.Title>Daily Stats</Card.Title>
                </Card.Header>
                <Card.Body>
                  <VStack gap={3} alignItems="stretch">
                    <Text py="4" color="fg.muted" textAlign="center">
                      Productivity analytics coming soon!
                    </Text>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Grid>
        )}

        {/* Task Dialog */}
        {editingTask && (
          <TaskDialog
            open={isTaskDialogOpen}
            onOpenChange={(isOpen) => {
              setIsTaskDialogOpen(isOpen);
              if (!isOpen) {
                setEditingTask(null);
              }
            }}
            mode="edit"
            task={editingTask}
            onSubmit={handleDialogSubmit}
          />
        )}
      </VStack>
    </Box>
  );
}
