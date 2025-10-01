import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, LayoutGrid } from 'lucide-react';
import { navigate } from 'vike/client/router';
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
import { Spinner } from '../../components/ui/spinner';

interface CompleteTaskPayload {
  id: string;
  completed: boolean;
  instanceDate?: string | Date;
}

export default function AgendaPage() {
  const { currentSpace } = useSpace();
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'day');
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
      let start: Date, end: Date;

      if (viewMode === 'day') {
        // Use UTC dates to avoid timezone issues
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        start = new Date(`${dateStr}T00:00:00.000Z`);
        end = new Date(`${dateStr}T23:59:59.999Z`);
      } else {
        // Use UTC dates for week view too
        const weekStart = startOfWeek(selectedDate);
        const weekEnd = endOfWeek(selectedDate);
        const startStr = format(weekStart, 'yyyy-MM-dd');
        const endStr = format(weekEnd, 'yyyy-MM-dd');
        start = new Date(`${startStr}T00:00:00.000Z`);
        end = new Date(`${endStr}T23:59:59.999Z`);
      }

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
    queryKey: ['habits', format(selectedDate, 'yyyy-MM-dd'), currentSpace, viewMode],
    queryFn: async () => {
      const dateStr =
        viewMode === 'day'
          ? format(selectedDate, 'yyyy-MM-dd')
          : format(startOfWeek(selectedDate), 'yyyy-MM-dd');
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
      const dateStr = data.dueDate as string;
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
      taskData.link = data.link as string;
    }

    if (editingTask) {
      updateTaskMutation.mutate(taskData);
    } else {
      createTaskMutation.mutate(taskData);
    }
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

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i));

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

    const completed = filteredEvents.filter((event) => event.completed).length;
    const overdue = filteredEvents.filter((event) => {
      if (event.completed) return false;
      if (!event.dueDate) return false;
      const dueDate = new Date(event.dueDate);
      return dueDate < now;
    }).length;
    const todo = filteredEvents.filter((event) => {
      if (event.completed) return false;
      if (!event.dueDate) return false;
      const dueDate = new Date(event.dueDate);
      return dueDate >= now; // Future or today (not overdue)
    }).length;
    const total = filteredEvents.length;

    return {
      total,
      completed,
      remaining: total - completed,
      overdue,
      todo
    };
  }, [events, viewMode, selectedDate]);

  return (
    <Box
      colorPalette={currentSpace === 'work' ? 'blue' : 'purple'}
      maxH="100vh"
      p={{ base: '2', md: '4' }}
      overflow="auto"
    >
      <VStack gap="6" alignItems="stretch">
        {/* Header */}
        <VStack gap="4" alignItems="stretch" width="100%">
          <HStack justifyContent="space-between" alignItems="center" flexWrap={{ base: 'wrap', md: 'nowrap' }} gap="3">
            <VStack gap="1" alignItems="start" flex="1" minW={{ base: 'full', md: 'auto' }}>
              <Heading size={{ base: 'xl', md: '2xl' }}>Agenda</Heading>
              <Text color="fg.muted" fontSize={{ base: 'xs', md: 'sm' }}>
                {viewMode === 'day'
                  ? format(selectedDate, 'EEEE, MMM d, yyyy')
                  : `Week of ${format(startOfWeek(selectedDate), 'MMM d, yyyy')}`}
              </Text>
            </VStack>

            <HStack gap="2" flexWrap="wrap" justifyContent={{ base: 'flex-start', md: 'flex-end' }}>
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
                <Button variant="ghost" size={{ base: 'xs', sm: 'sm' }} onClick={() => setSelectedDate(new Date())}>
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
          <Grid gap={4} gridTemplateColumns={{ base: '1fr', lg: '4fr 1fr' }} w="full">
            {/* Week View - Grid Layout */}
            <VStack gap="3" alignItems="stretch" w="full">
              {/* Grid Header */}
              <Grid gap="2" gridTemplateColumns={{ base: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(7, 1fr)' }} w="full">
                {weekDates.map((date) => {
                  const isToday = isSameDay(date, new Date());
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayEvents = groupedEvents[dateKey] || [];
                  const isPast = date < new Date() && !isSameDay(date, new Date());

                  return (
                    <Box
                      key={date.toISOString()}
                      borderColor={isToday ? 'colorPalette.default' : 'border.default'}
                      borderRadius="lg"
                      borderWidth="1px"
                      bg={isToday ? 'colorPalette.subtle' : 'bg.default'}
                      opacity={isPast ? 0.7 : 1}
                      overflow="hidden"
                    >
                      {/* Day Header */}
                      <Box
                        borderBottomWidth="1px"
                        borderBottomColor="border.default"
                        p="2"
                        bg={isToday ? 'colorPalette.subtle' : 'bg.subtle'}
                      >
                        <VStack gap="0.5" alignItems="center">
                          <Text
                            color={isToday ? 'colorPalette.default' : 'fg.muted'}
                            fontSize="xs"
                            fontWeight="semibold"
                            textTransform="uppercase"
                          >
                            {format(date, 'EEE')}
                          </Text>
                          <Text
                            color={isToday ? 'colorPalette.default' : 'fg.default'}
                            fontSize="xl"
                            fontWeight="bold"
                          >
                            {format(date, 'd')}
                          </Text>
                        </VStack>
                      </Box>

                      {/* Day Content */}
                      <Box minH="xs" maxH="md" p="2" overflowY="auto">
                        <VStack gap="1.5" alignItems="stretch">
                          {/* Combined Habits and Tasks - Sorted by Time */}
                          {(() => {
                            const dayHabits = habits?.filter((habit) => {
                              if (habit.frequency === 'daily') return true;
                              if (habit.frequency === 'weekly' && habit.targetDays) {
                                return habit.targetDays.includes(date.getDay());
                              }
                              return false;
                            }) || [];

                            // Combine habits and tasks with a type indicator
                            const combined = [
                              ...dayHabits.map(h => ({ type: 'habit' as const, item: h, time: h.reminderTime })),
                              ...dayEvents.map(e => ({ type: 'task' as const, item: e, time: e.dueDate }))
                            ];

                            // Sort by time
                            combined.sort((a, b) => {
                              if (a.time && b.time) {
                                const aDate = new Date(a.time);
                                const bDate = new Date(b.time);
                                return aDate.getTime() - bDate.getTime();
                              }
                              // Items without time go to bottom
                              if (!a.time) return 1;
                              if (!b.time) return -1;
                              return 0;
                            });

                            return combined.map((item) => {
                              if (item.type === 'habit') {
                                const habit = item.item;
                                return (
                                  <Box
                                    key={`habit-${habit.id}-${dateKey}`}
                                    onClick={() =>
                                      toggleHabitMutation.mutate({
                                        habitId: habit.id,
                                        date,
                                        completed: !habit.completedToday
                                      })
                                    }
                                    cursor="pointer"
                                    borderLeftWidth="3px"
                                    borderLeftColor="colorPalette.default"
                                    borderRadius="sm"
                                    p="1.5"
                                    bg={habit.completedToday ? 'green.subtle' : 'bg.muted'}
                                    transition="all 0.2s"
                                    _hover={{ bg: 'bg.subtle' }}
                                  >
                                    <HStack gap="1.5" alignItems="center">
                                      <Checkbox checked={habit.completedToday} size="sm" readOnly />
                                      <VStack flex="1" gap="0.5" alignItems="start">
                                        <Text
                                          textDecoration={habit.completedToday ? 'line-through' : 'none'}
                                          fontSize="xs"
                                          fontWeight="medium"
                                          lineHeight="1.2"
                                        >
                                          {habit.name}
                                        </Text>
                                        {habit.reminderTime && (
                                          <Text color="fg.muted" fontSize="2xs" lineHeight="1">
                                            {format(new Date(`2000-01-01T${habit.reminderTime}`), 'h:mm a')}
                                          </Text>
                                        )}
                                      </VStack>
                                      {(habit.currentStreak ?? 0) > 0 && (
                                        <Text fontSize="xs" fontWeight="bold">
                                          🔥{habit.currentStreak}
                                        </Text>
                                      )}
                                    </HStack>
                                  </Box>
                                );
                              } else {
                                const event = item.item;
                                const colorPalette = event.priority === 'urgent' ? 'red' : event.priority === 'high' ? 'orange' : event.priority === 'medium' ? 'yellow' : 'gray';
                                return (
                                  <Box
                                    key={`${event.id}-${event.instanceDate}`}
                                    onClick={() => handleTaskClick(event)}
                                    cursor="pointer"
                                    borderLeftWidth="3px"
                                    borderLeftColor={`${colorPalette}.default`}
                                    borderRadius="sm"
                                    p="1.5"
                                    bg="bg.muted"
                                    transition="all 0.2s"
                                    _hover={{ bg: 'bg.subtle', borderLeftColor: `${colorPalette}.emphasized` }}
                                  >
                                    <HStack gap="1.5" alignItems="start">
                                      <Checkbox
                                        size="sm"
                                        checked={event.completed}
                                        onCheckedChange={() => completeTask(event)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <VStack flex="1" gap="0.5" alignItems="start">
                                        <Text
                                          color={event.completed ? 'fg.subtle' : 'fg.default'}
                                          textDecoration={event.completed ? 'line-through' : 'none'}
                                          fontSize="xs"
                                          fontWeight="medium"
                                          lineHeight="1.2"
                                          lineClamp="2"
                                        >
                                          {event.title}
                                        </Text>
                                        {event.dueDate && (
                                          <Text color="fg.muted" fontSize="2xs" lineHeight="1">
                                            {format(new Date(event.dueDate), 'h:mm a')}
                                          </Text>
                                        )}
                                      </VStack>
                                    </HStack>
                                  </Box>
                                );
                              }
                            });
                          })()}
                          {dayEvents.length === 0 &&
                            !habits?.filter((h) => {
                              if (h.frequency === 'daily') return true;
                              if (h.frequency === 'weekly' && h.targetDays) {
                                return h.targetDays.includes(date.getDay());
                              }
                              return false;
                            }).length && (
                              <Text py="4" color="fg.subtle" fontSize="xs" textAlign="center">
                                No tasks or habits
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
            <VStack display={{ base: 'none', lg: 'flex' }} gap={3}>
              {/* Weekly Stats Section */}
              <Card.Root w="full">
                <Card.Header p="3">
                  <Card.Title fontSize="sm">Weekly Stats</Card.Title>
                </Card.Header>
                <Card.Body p="3" pt="0">
                  <VStack gap={2} alignItems="stretch">
                    <HStack justifyContent="space-between">
                      <Text color="fg.muted" fontSize="xs">
                        Todo
                      </Text>
                      <Text fontSize="xl" fontWeight="bold">
                        {stats.todo}
                      </Text>
                    </HStack>
                    {stats.overdue > 0 && (
                      <HStack justifyContent="space-between">
                        <Text color="fg.muted" fontSize="xs">
                          Overdue
                        </Text>
                        <Text color="red.default" fontSize="md" fontWeight="semibold">
                          {stats.overdue}
                        </Text>
                      </HStack>
                    )}
                    <HStack justifyContent="space-between">
                      <Text color="fg.muted" fontSize="xs">
                        Completed
                      </Text>
                      <Text color="green.default" fontSize="md" fontWeight="semibold">
                        {stats.completed}/{stats.total}
                      </Text>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Grid>
        ) : (
          // Day View - Grid Layout
          <Grid gap={4} gridTemplateColumns={{ base: '1fr', lg: '4fr 1fr' }} w="full">
            {/* Tasks for the day */}
            <VStack gap="3" alignItems="stretch" w="full">
              <Box borderRadius="lg" borderWidth="1px" minH="lg" p="4" bg="bg.default">
                <VStack gap="2" alignItems="stretch">
                  <Text mb="2" fontSize="lg" fontWeight="semibold">
                    Tasks for {format(selectedDate, 'MMM d')}
                  </Text>
                  {groupedEvents[format(selectedDate, 'yyyy-MM-dd')]
                    ?.sort((a, b) => {
                      // Sort by dueDate time (earliest first)
                      if (a.dueDate && b.dueDate) {
                        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                      }
                      // Tasks without due times go to bottom
                      if (!a.dueDate) return 1;
                      if (!b.dueDate) return -1;
                      return 0;
                    })
                    .map((event) => (
                      <TaskItem
                        key={`${event.id}-${event.instanceDate}`}
                        event={event}
                        onToggleComplete={() => completeTask(event)}
                        onTaskClick={() => handleTaskClick(event)}
                        extraBadges={
                          event.boardName && event.columnName ? (
                            <>
                              <Badge size="sm" variant="outline">
                                {event.boardName}
                              </Badge>
                              <Badge size="sm" variant="subtle">
                                {event.columnName}
                              </Badge>
                            </>
                          ) : null
                        }
                        actions={
                          event.boardId ? (
                            <IconButton
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                void navigate(`/board/${event.boardId}`);
                              }}
                              aria-label="View Board"
                            >
                              <LayoutGrid width="16" height="16" />
                            </IconButton>
                          ) : undefined
                        }
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
            <VStack display={{ base: 'none', lg: 'flex' }} gap={3}>
              {/* Habits Section */}
              <Card.Root w="full">
                <Card.Header p="3">
                  <Card.Title fontSize="sm">Daily Habits</Card.Title>
                </Card.Header>
                <Card.Body p="3" pt="0">
                  {isLoadingHabits ? (
                    <Center>Loading habits...</Center>
                  ) : isErrorHabits ? (
                    <Center>Error loading habits</Center>
                  ) : (
                    <VStack gap="1.5" alignItems="stretch">
                      {habits?.map((habit) => (
                        <HStack
                          key={habit.id}
                          borderRadius="md"
                          p="1.5"
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
                          <Text
                            textDecoration={habit.completedToday ? 'line-through' : 'none'}
                            fontSize="xs"
                            fontWeight="medium"
                            flex="1"
                          >
                            {habit.name}
                          </Text>
                          {(habit.currentStreak ?? 0) > 0 && (
                            <Badge variant="subtle" size="xs">
                              🔥{habit.currentStreak}
                            </Badge>
                          )}
                        </HStack>
                      ))}
                      {(!habits || habits.length === 0) && (
                        <Text py="2" color="fg.subtle" fontSize="xs" textAlign="center">
                          No habits yet
                        </Text>
                      )}
                    </VStack>
                  )}
                </Card.Body>
              </Card.Root>

              {/* Daily Stats Section */}
              <Card.Root w="full">
                <Card.Header p="3">
                  <Card.Title fontSize="sm">Daily Stats</Card.Title>
                </Card.Header>
                <Card.Body p="3" pt="0">
                  <VStack gap={2} alignItems="stretch">
                    <HStack justifyContent="space-between">
                      <Text color="fg.muted" fontSize="xs">
                        Todo
                      </Text>
                      <Text fontSize="xl" fontWeight="bold">
                        {stats.todo}
                      </Text>
                    </HStack>
                    {stats.overdue > 0 && (
                      <HStack justifyContent="space-between">
                        <Text color="fg.muted" fontSize="xs">
                          Overdue
                        </Text>
                        <Text color="red.default" fontSize="lg" fontWeight="semibold">
                          {stats.overdue}
                        </Text>
                      </HStack>
                    )}
                    <HStack justifyContent="space-between">
                      <Text color="fg.muted" fontSize="xs">
                        Completed
                      </Text>
                      <Text color="green.default" fontSize="md" fontWeight="semibold">
                        {stats.completed}/{stats.total}
                      </Text>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </VStack>
          </Grid>
        )}

        {/* Task Dialog */}
        <TaskDialog
          open={isTaskDialogOpen}
          onOpenChange={(isOpen) => {
            setIsTaskDialogOpen(isOpen);
            if (!isOpen) {
              setEditingTask(null);
            }
          }}
          mode={editingTask ? 'edit' : 'create'}
          task={editingTask || undefined}
          onSubmit={handleDialogSubmit}
        />
      </VStack>
    </Box>
  );
}
