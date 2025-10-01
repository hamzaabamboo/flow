import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Bell, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { Box, VStack, HStack, Grid } from '../../../styled-system/jsx';
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

export default function AgendaPage() {
  const { currentSpace } = useSpace();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'week');
  const [selectedDate, setSelectedDate] = useDateQueryState('date');
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  // Get calendar events
  const { data: events, refetch: refetchEvents } = useQuery<CalendarEvent[]>({
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

  // Get habits
  const { data: habits, refetch: refetchHabits } = useQuery<Habit[]>({
    queryKey: ['habits', selectedDate, currentSpace],
    queryFn: async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(`/api/habits?date=${dateStr}&space=${currentSpace}`);
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    }
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({
      id,
      completed,
      instanceDate
    }: {
      id: string;
      completed: boolean;
      instanceDate?: string | Date;
    }) => {
      const body: any = { completed };
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

  // Toggle habit mutation
  const toggleHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const response = await fetch(`/api/habits/${habitId}/log`, {
        method: 'POST'
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
    mutationFn: async (taskData: any) => {
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

  const completeTask = (taskId: string, dueDate?: string | Date) => {
    const task = events?.find((e) => {
      if (e.id !== taskId) return false;
      if (dueDate && e.instanceDate) {
        const eventDateStr =
          typeof e.instanceDate === 'string'
            ? e.instanceDate
            : new Date(e.instanceDate).toISOString().split('T')[0];
        const targetDateStr =
          dueDate instanceof Date
            ? dueDate.toISOString().split('T')[0]
            : typeof dueDate === 'string' && dueDate.includes('T')
              ? dueDate.split('T')[0]
              : dueDate;
        return eventDateStr === targetDateStr;
      }
      return true;
    });

    if (task) {
      completeTaskMutation.mutate({
        id: taskId,
        completed: !task.completed,
        instanceDate: dueDate
      });
    }
  };

  const handleTaskClick = (event: CalendarEvent) => {
    const extendedTask: ExtendedTask = {
      id: event.id,
      title: event.title,
      description: event.description,
      dueDate: event.dueDate ? new Date(event.dueDate).toISOString() : undefined,
      priority: (event.priority as ExtendedTask['priority']) || undefined,
      completed: event.completed || false,
      columnId: event.columnId || '',
      columnName: '',
      boardName: '',
      boardId: '',
      boardSpace: event.space || 'personal',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      labels: event.labels,
      subtasks: event.subtasks,
      recurringPattern: event.recurringPattern,
      recurringEndDate: event.recurringEndDate
    };

    setEditingTask(extendedTask);
    setIsTaskDialogOpen(true);
  };

  const handleUpdateTask = (data: any) => {
    if (!editingTask) return;

    const taskData: any = {
      id: editingTask.id,
      title: data.title,
      description: data.description
    };

    if (data.dueDate) {
      taskData.dueDate = new Date(data.dueDate).toISOString();
    }

    if (data.priority && data.priority !== 'none') {
      taskData.priority = data.priority;
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

    updateTaskMutation.mutate(taskData);
  };

  // Group events by date for week view
  const groupEventsByDate = (events: CalendarEvent[]) => {
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
  };

  const groupedEvents = groupEventsByDate(events || []);
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
        {viewMode === 'week' ? (
          // Week View - Grid Layout
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
                          <Box
                            key={event.id}
                            onClick={(e) => {
                              if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                                handleTaskClick(event);
                              }
                            }}
                            cursor="pointer"
                            borderLeftWidth="3px"
                            borderLeftColor={
                              event.priority === 'urgent'
                                ? 'red.default'
                                : event.priority === 'high'
                                  ? 'orange.default'
                                  : event.priority === 'medium'
                                    ? 'yellow.default'
                                    : 'blue.default'
                            }
                            borderRadius="md"
                            p="2"
                            bg="bg.subtle"
                            transition="background 0.2s"
                            _hover={{ bg: 'bg.muted' }}
                          >
                            <HStack gap="2" alignItems="start">
                              <Checkbox
                                size="sm"
                                checked={event.completed}
                                onCheckedChange={() =>
                                  completeTask(event.id, event.instanceDate || event.dueDate)
                                }
                                onClick={(e) => e.stopPropagation()}
                                mt="0.5"
                              />
                              <VStack flex="1" gap="1" alignItems="start">
                                <Text
                                  color={event.completed ? 'fg.subtle' : 'fg.default'}
                                  textDecoration={event.completed ? 'line-through' : 'none'}
                                  fontSize="sm"
                                  fontWeight="medium"
                                  lineClamp="2"
                                >
                                  {event.title}
                                </Text>
                                {event.dueDate && (
                                  <Text color="fg.muted" fontSize="xs">
                                    {format(new Date(event.dueDate), 'h:mm a')}
                                  </Text>
                                )}
                                {event.labels && event.labels.length > 0 && (
                                  <HStack gap="1" flexWrap="wrap">
                                    {event.labels.slice(0, 2).map((label) => (
                                      <Badge key={label} variant="subtle" size="sm">
                                        {label}
                                      </Badge>
                                    ))}
                                    {event.labels.length > 2 && (
                                      <Text color="fg.muted" fontSize="xs">
                                        +{event.labels.length - 2}
                                      </Text>
                                    )}
                                  </HStack>
                                )}
                              </VStack>
                            </HStack>
                          </Box>
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
        ) : (
          // Day View - Grid Layout
          <Grid gap="4" gridTemplateColumns="3fr 1fr">
            {/* Tasks for the day */}
            <Box borderRadius="lg" borderWidth="1px" p="4">
              <VStack gap="2" alignItems="stretch">
                <Text mb="2" fontSize="lg" fontWeight="semibold">
                  Tasks
                </Text>
                {groupedEvents[format(selectedDate, 'yyyy-MM-dd')]?.map((event) => (
                  <HStack
                    key={event.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
                        handleTaskClick(event);
                      }
                    }}
                    cursor="pointer"
                    gap="2"
                    borderLeftWidth="3px"
                    borderLeftColor={
                      event.priority === 'urgent'
                        ? 'red.default'
                        : event.priority === 'high'
                          ? 'orange.default'
                          : event.priority === 'medium'
                            ? 'yellow.default'
                            : 'gray.default'
                    }
                    borderRadius="md"
                    p="2"
                    bg="bg.subtle"
                    _hover={{ bg: 'bg.muted' }}
                  >
                    <Checkbox
                      checked={event.completed}
                      onCheckedChange={() => completeTask(event.id, event.dueDate)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <VStack flex="1" gap="0.5" alignItems="start">
                      <Text
                        color={event.completed ? 'fg.subtle' : 'fg.default'}
                        textDecoration={event.completed ? 'line-through' : 'none'}
                      >
                        {event.title}
                      </Text>
                      {event.description && (
                        <Text color="fg.muted" fontSize="sm">
                          {event.description}
                        </Text>
                      )}
                      <HStack gap="2">
                        {event.dueDate && (
                          <Badge variant="outline" size="sm">
                            {format(new Date(event.dueDate), 'h:mm a')}
                          </Badge>
                        )}
                        {event.labels?.map((label) => (
                          <Badge key={label} variant="subtle" size="sm">
                            {label}
                          </Badge>
                        ))}
                      </HStack>
                    </VStack>
                  </HStack>
                ))}
                {(!groupedEvents[format(selectedDate, 'yyyy-MM-dd')] ||
                  groupedEvents[format(selectedDate, 'yyyy-MM-dd')].length === 0) && (
                  <Text py="8" color="fg.subtle" textAlign="center">
                    No tasks scheduled
                  </Text>
                )}
              </VStack>
            </Box>

            {/* Habits Section */}
            <Card.Root>
              <Card.Header>
                <Card.Title>Daily Habits</Card.Title>
              </Card.Header>
              <Card.Body>
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
                        onCheckedChange={() => toggleHabitMutation.mutate(habit.id)}
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
                        {habit.currentStreak && habit.currentStreak > 0 && (
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
              </Card.Body>
            </Card.Root>
          </Grid>
        )}

        {/* Task Dialog */}
        {editingTask && (
          <TaskDialog
            open={isTaskDialogOpen}
            onClose={() => {
              setIsTaskDialogOpen(false);
              setEditingTask(null);
            }}
            mode="edit"
            task={editingTask as any}
            onSubmit={handleUpdateTask}
          />
        )}
      </VStack>
    </Box>
  );
}

// Helper component for task items
function EventItem({
  event,
  onComplete,
  onClick
}: {
  event: CalendarEvent;
  onComplete: () => void;
  onClick: () => void;
}) {
  return (
    <HStack
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('input[type="checkbox"]')) {
          onClick();
        }
      }}
      cursor="pointer"
      gap="2"
      borderLeftWidth="3px"
      borderLeftColor={
        event.priority === 'urgent'
          ? 'red.default'
          : event.priority === 'high'
            ? 'orange.default'
            : event.priority === 'medium'
              ? 'yellow.default'
              : 'gray.default'
      }
      borderRadius="md"
      p="3"
      bg="bg.subtle"
      _hover={{ bg: 'bg.muted' }}
    >
      <Checkbox
        checked={event.completed}
        onCheckedChange={onComplete}
        onClick={(e) => e.stopPropagation()}
      />
      <VStack flex="1" gap="1" alignItems="start">
        <Text
          color={event.completed ? 'fg.subtle' : 'fg.default'}
          textDecoration={event.completed ? 'line-through' : 'none'}
        >
          {event.title}
        </Text>
        {event.description && (
          <Text color="fg.muted" fontSize="sm">
            {event.description}
          </Text>
        )}
        <HStack gap="2">
          {event.dueDate && (
            <Badge variant="outline" size="xs">
              {format(new Date(event.dueDate), 'h:mm a')}
            </Badge>
          )}
          {event.labels?.map((label) => (
            <Badge key={label} variant="subtle" size="xs">
              {label}
            </Badge>
          ))}
        </HStack>
      </VStack>
      {event.type === 'reminder' && <Bell width="16" height="16" />}
      {event.type === 'habit' && <Target width="16" height="16" />}
    </HStack>
  );
}
