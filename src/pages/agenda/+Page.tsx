import { useState, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { Task } from '../../shared/types';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { FileText, Bell, Target, Calendar, Edit2 } from 'lucide-react';
import { Container, Box, VStack, HStack } from '../../../styled-system/jsx';
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
  const [viewMode, setViewMode] = useQueryState<'day' | 'week'>('view', 'day');
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

  // Toggle habit completion
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

  // Track in-progress completions to prevent duplicates
  const completingTasks = useRef<Set<string>>(new Set());

  // Mark task as complete
  const completeTask = async (taskId: string, instanceDate?: string | Date) => {
    // Create unique key for this completion
    const completionKey = `${taskId}-${instanceDate ? String(instanceDate) : 'no-date'}`;

    // Prevent duplicate calls
    if (completingTasks.current.has(completionKey)) {
      return;
    }

    completingTasks.current.add(completionKey);

    try {
      // Find the specific task instance - for recurring tasks, match by both ID and instanceDate
      const task = events?.find((e) => {
        if (e.id !== taskId) return false;

        // For recurring tasks, also match the instanceDate
        if (instanceDate && e.instanceDate) {
          const eventDateStr =
            typeof e.instanceDate === 'string'
              ? e.instanceDate
              : new Date(e.instanceDate).toISOString().split('T')[0];
          const targetDateStr =
            instanceDate instanceof Date
              ? instanceDate.toISOString().split('T')[0]
              : typeof instanceDate === 'string' && instanceDate.includes('T')
                ? instanceDate.split('T')[0]
                : instanceDate;
          return eventDateStr === targetDateStr;
        }

        // For non-recurring tasks, just match by ID
        return true;
      });

      // Toggle task completion - for recurring tasks, pass the instanceDate as ISO string
      const instanceDateStr = instanceDate
        ? instanceDate instanceof Date
          ? instanceDate.toISOString()
          : instanceDate
        : undefined;

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !task?.completed,
          ...(task?.recurringPattern && instanceDateStr ? { instanceDate: instanceDateStr } : {})
        })
      });

      if (response.ok) {
        await refetchEvents();
      }
    } catch (error) {
      console.error('Failed to toggle task:', error);
    } finally {
      // Remove from set after a short delay to allow for refetch
      setTimeout(() => {
        completingTasks.current.delete(completionKey);
      }, 1000);
    }
  };

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      const response = await fetch(`/api/tasks/${editingTask?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
      setIsTaskDialogOpen(false);
      setEditingTask(null);
    }
  });

  const handleTaskClick = (event: CalendarEvent) => {
    if (event.type === 'task') {
      // Convert CalendarEvent to ExtendedTask format
      const extendedTask: ExtendedTask = {
        id: event.id,
        title: event.title,
        description: event.description,
        dueDate: typeof event.dueDate === 'string' ? event.dueDate : event.dueDate?.toISOString(),
        priority: event.priority as 'low' | 'medium' | 'high' | 'urgent' | undefined,
        completed: event.completed || false,
        columnId: event.columnId || '', // Will be populated by TaskDialog
        columnName: '',
        boardName: '',
        boardId: '',
        boardSpace: currentSpace,
        createdAt: '',
        updatedAt: '',
        labels: event.labels,
        subtasks: event.subtasks,
        recurringPattern: event.recurringPattern,
        recurringEndDate: event.recurringEndDate
      };
      setEditingTask(extendedTask);
      setIsTaskDialogOpen(true);
    }
  };

  const handleTaskSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const taskData: Record<string, unknown> = {
      title: data.title,
      description: data.description || undefined,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      columnId: data.columnId
    };

    // Parse JSON fields that TaskDialog adds as hidden inputs
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

  // Get calendar subscription URL
  const { data: calendarUrl } = useQuery({
    queryKey: ['calendar', 'feed-url'],
    queryFn: async () => {
      const response = await fetch('/api/calendar/feed-url');
      if (!response.ok) throw new Error('Failed to get calendar URL');
      return response.json();
    }
  });

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

  return (
    <Container maxW="6xl" py="8">
      <VStack gap="6">
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center" width="100%">
          <Heading size="3xl">Agenda</Heading>

          <HStack gap="4">
            {/* View Mode Toggle */}
            <HStack gap="2">
              <Button
                variant={viewMode === 'day' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                Day
              </Button>
              <Button
                variant={viewMode === 'week' ? 'solid' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                Week
              </Button>
            </HStack>

            {/* Date Navigation */}
            <HStack gap="2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedDate(
                    viewMode === 'day' ? addDays(selectedDate, -1) : addDays(selectedDate, -7)
                  )
                }
              >
                ←
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedDate(
                    viewMode === 'day' ? addDays(selectedDate, 1) : addDays(selectedDate, 7)
                  )
                }
              >
                →
              </Button>
            </HStack>

            {/* Calendar Subscription */}
            {calendarUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(calendarUrl.url);
                  alert('Calendar URL copied! Add it to your calendar app.');
                }}
              >
                <HStack gap="2">
                  <Calendar width="16" height="16" />
                  Subscribe
                </HStack>
              </Button>
            )}
          </HStack>
        </HStack>

        {/* Current Date Display */}
        <Text color="fg.muted" fontSize="xl">
          {viewMode === 'day'
            ? format(selectedDate, 'EEEE, MMMM d, yyyy')
            : `Week of ${format(startOfWeek(selectedDate), 'MMMM d, yyyy')}`}
        </Text>

        {/* Main Content Grid */}
        <div
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: viewMode === 'week' ? 'repeat(7, 1fr)' : '2fr 1fr',
            width: '100%'
          }}
        >
          {/* Events Section */}
          {viewMode === 'week' ? (
            // Week View - 7 columns
            Object.entries(groupedEvents).map(([dateKey, dayEvents]) => {
              const date = new Date(dateKey);
              const isToday = isSameDay(date, new Date());
              const isPast = date < new Date() && !isToday;

              return (
                <Card.Root
                  key={dateKey}
                  borderColor={isToday ? 'blue.default' : 'border.default'}
                  borderWidth="2px"
                  minH="300px"
                  bg={isPast ? 'bg.subtle' : 'bg.default'}
                  opacity={isPast ? 0.75 : 1}
                >
                  <Card.Header borderBottomWidth="1px" pb="3">
                    <VStack gap="1" alignItems="start">
                      <Text
                        color={isToday ? 'blue.default' : 'fg.default'}
                        fontSize="sm"
                        fontWeight="bold"
                      >
                        {format(date, 'EEE')}
                      </Text>
                      <Text
                        color={isToday ? 'blue.default' : 'fg.muted'}
                        fontSize="2xl"
                        fontWeight="bold"
                      >
                        {format(date, 'd')}
                      </Text>
                      {dayEvents.length > 0 && (
                        <Badge variant="subtle" colorPalette="blue">
                          {dayEvents.length} {dayEvents.length === 1 ? 'task' : 'tasks'}
                        </Badge>
                      )}
                    </VStack>
                  </Card.Header>
                  <Card.Body pt="3">
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
                                  : 'gray.default'
                          }
                          borderRadius="md"
                          p="2"
                          bg={event.completed ? 'bg.muted' : 'bg.surface'}
                          opacity={event.completed ? 0.6 : 1}
                          transition="all 0.2s"
                          _hover={{
                            bg: event.completed ? 'bg.muted' : 'bg.emphasized',
                            transform: 'translateY(-1px)',
                            boxShadow: 'sm'
                          }}
                        >
                          <VStack gap="1" alignItems="start">
                            <HStack gap="2" width="100%">
                              {event.type === 'task' && (
                                <Checkbox
                                  checked={event.completed}
                                  onCheckedChange={() =>
                                    void completeTask(event.id, event.instanceDate || event.dueDate)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  size="sm"
                                />
                              )}
                              <Text
                                flex="1"
                                textDecoration={event.completed ? 'line-through' : 'none'}
                                fontSize="xs"
                                fontWeight="medium"
                                lineClamp={2}
                              >
                                {event.title}
                              </Text>
                            </HStack>
                            {event.dueDate && (
                              <Text color="fg.muted" fontSize="2xs">
                                {format(new Date(event.dueDate), 'h:mm a')}
                              </Text>
                            )}
                          </VStack>
                        </Box>
                      ))}
                      {dayEvents.length === 0 && (
                        <Text py="4" color="fg.subtle" fontSize="xs" textAlign="center">
                          No events
                        </Text>
                      )}
                    </VStack>
                  </Card.Body>
                </Card.Root>
              );
            })
          ) : (
            // Day View - Tasks column
            <Card.Root>
              <Card.Header>
                <Card.Title>Today's Schedule</Card.Title>
              </Card.Header>
              <Card.Body>
                <VStack gap="3" alignItems="stretch">
                  {groupedEvents[format(selectedDate, 'yyyy-MM-dd')]?.map((event) => (
                    <EventItem
                      key={event.id}
                      event={event}
                      onComplete={() => void completeTask(event.id, event.dueDate)}
                      onClick={() => handleTaskClick(event)}
                    />
                  ))}
                  {(!groupedEvents[format(selectedDate, 'yyyy-MM-dd')] ||
                    groupedEvents[format(selectedDate, 'yyyy-MM-dd')].length === 0) && (
                    <Text py="8" color="fg.subtle" textAlign="center">
                      No events scheduled for today
                    </Text>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}

          {/* Habits Section (only in day view) */}
          {viewMode === 'day' && (
            <Card.Root>
              <Card.Header>
                <Card.Title>Daily Habits</Card.Title>
              </Card.Header>
              <Card.Body>
                <VStack gap="3" alignItems="stretch">
                  {habits?.map((habit) => (
                    <HStack
                      key={habit.id}
                      borderRadius="md"
                      p="3"
                      bg={habit.completedToday ? 'green.subtle' : 'bg.subtle'}
                      transition="all 0.2s"
                    >
                      <Checkbox
                        checked={habit.completedToday}
                        onCheckedChange={() => toggleHabitMutation.mutate(habit.id)}
                      />
                      <VStack flex="1" gap="1" alignItems="start">
                        <Text
                          textDecoration={habit.completedToday ? 'line-through' : 'none'}
                          fontWeight="medium"
                        >
                          {habit.name}
                        </Text>
                        {habit.description && (
                          <Text color="fg.muted" fontSize="sm">
                            {habit.description}
                          </Text>
                        )}
                        <HStack gap="2" flexWrap="wrap">
                          {habit.reminderTime && (
                            <Badge variant="outline" size="sm" colorPalette="blue">
                              🕐 {habit.reminderTime}
                            </Badge>
                          )}
                          {habit.currentStreak && habit.currentStreak > 0 && (
                            <Badge variant="subtle" size="sm">
                              🔥 {habit.currentStreak} day streak
                            </Badge>
                          )}
                        </HStack>
                      </VStack>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        onClick={() => (window.location.href = '/habits')}
                        aria-label="Edit habit"
                      >
                        <Edit2 width="16" height="16" />
                      </IconButton>
                    </HStack>
                  ))}
                  {(!habits || habits.length === 0) && (
                    <Text py="4" color="fg.subtle" textAlign="center">
                      No habits yet
                    </Text>
                  )}
                </VStack>
              </Card.Body>
            </Card.Root>
          )}
        </div>

        {/* Quick Stats */}
        <Card.Root>
          <Card.Body py="6">
            <HStack gap="8" justifyContent="center">
              <VStack gap="1" alignItems="center">
                <Text color="blue.default" fontSize="2xl" fontWeight="bold">
                  {events?.filter((e) => e.type === 'task' && !e.completed).length || 0}
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Tasks Due
                </Text>
              </VStack>
              <VStack gap="1" alignItems="center">
                <Text color="green.default" fontSize="2xl" fontWeight="bold">
                  {habits?.filter((h) => h.completedToday).length || 0}/{habits?.length || 0}
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Habits Done
                </Text>
              </VStack>
              <VStack gap="1" alignItems="center">
                <Text color="purple.default" fontSize="2xl" fontWeight="bold">
                  {events?.filter((e) => e.type === 'reminder').length || 0}
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Reminders
                </Text>
              </VStack>
            </HStack>
          </Card.Body>
        </Card.Root>
      </VStack>

      {/* Task Edit Dialog */}
      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        task={editingTask as Task | null}
        onSubmit={handleTaskSubmit}
        mode="edit"
      />
    </Container>
  );
}

// Event Item Component
function EventItem({
  event,
  onComplete,
  onClick,
  compact = false
}: {
  event: CalendarEvent;
  onComplete: () => void;
  onClick?: () => void;
  compact?: boolean;
}) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'task':
        return <FileText width="16" height="16" />;
      case 'reminder':
        return <Bell width="16" height="16" />;
      case 'habit':
        return <Target width="16" height="16" />;
      default:
        return <Calendar width="16" height="16" />;
    }
  };

  const getPriorityColor = () => {
    switch (event.priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'gray';
      default:
        return 'blue';
    }
  };

  return (
    <HStack
      onClick={onClick}
      cursor={onClick ? 'pointer' : 'default'}
      gap={compact ? '2' : '3'}
      border="1px solid"
      borderColor={event.completed ? 'border.subtle' : 'border.default'}
      borderRadius="md"
      p={compact ? '2' : '3'}
      bg={event.completed ? 'bg.subtle' : 'bg.default'}
      opacity={event.completed ? 0.7 : 1}
      transition="all 0.2s"
      _hover={{ borderColor: 'colorPalette.default' }}
    >
      {event.type === 'task' && (
        <Checkbox
          checked={event.completed}
          onCheckedChange={onComplete}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      <Text fontSize={compact ? 'lg' : 'xl'}>{getEventIcon()}</Text>

      <VStack flex="1" gap="1" alignItems="start">
        <Text
          textDecoration={event.completed ? 'line-through' : 'none'}
          fontSize={compact ? 'sm' : 'md'}
          fontWeight={compact ? 'normal' : 'medium'}
        >
          {event.title}
        </Text>

        {!compact && event.description && (
          <Text color="fg.muted" fontSize="sm">
            {event.description}
          </Text>
        )}

        {!compact && event.dueDate && (
          <Text color="fg.subtle" fontSize="xs">
            {format(new Date(event.dueDate), 'h:mm a')}
          </Text>
        )}
      </VStack>

      {event.priority && (
        <Badge variant="subtle" size="sm" bg={`${getPriorityColor()}.100`}>
          {event.priority}
        </Badge>
      )}

      {event.space && !compact && (
        <Badge variant="outline" size="sm">
          {event.space}
        </Badge>
      )}
    </HStack>
  );
}
