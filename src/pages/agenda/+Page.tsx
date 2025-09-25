import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { Container } from '../../../styled-system/jsx';
import { VStack, HStack } from '../../../styled-system/jsx';
import * as Card from '../../components/ui/styled/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Text } from '../../components/ui/text';
import { Heading } from '../../components/ui/heading';
import { useSpace } from '../../contexts/SpaceContext';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  completed?: boolean;
  type: 'task' | 'reminder' | 'habit';
  space?: string;
}

interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  completedToday: boolean;
  currentStreak: number;
}

export default function AgendaPage() {
  const { currentSpace } = useSpace();
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());

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
    queryKey: ['habits'],
    queryFn: async () => {
      const response = await fetch('/api/habits');
      if (!response.ok) throw new Error('Failed to fetch habits');
      return response.json();
    }
  });

  // Toggle habit completion
  const toggleHabit = async (habitId: string) => {
    try {
      const response = await fetch(`/api/habits/${habitId}/toggle`, {
        method: 'POST'
      });
      if (response.ok) {
        refetchHabits();
      }
    } catch (error) {
      console.error('Failed to toggle habit:', error);
    }
  };

  // Mark task as complete
  const completeTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true })
      });
      if (response.ok) {
        refetchEvents();
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
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
                  setSelectedDate((prev) =>
                    viewMode === 'day' ? addDays(prev, -1) : addDays(prev, -7)
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
                  setSelectedDate((prev) =>
                    viewMode === 'day' ? addDays(prev, 1) : addDays(prev, 7)
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
                📅 Subscribe
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

              return (
                <Card.Root key={dateKey} minH="400px" bg={isToday ? 'bg.muted' : 'bg.default'}>
                  <Card.Header pb="2">
                    <Text color={isToday ? 'colorPalette.fg' : 'fg.default'} fontWeight="semibold">
                      {format(date, 'EEE d')}
                    </Text>
                  </Card.Header>
                  <Card.Body>
                    <VStack gap="2" alignItems="stretch">
                      {dayEvents.map((event) => (
                        <EventItem
                          key={event.id}
                          event={event}
                          onComplete={() => completeTask(event.id)}
                          compact
                        />
                      ))}
                      {dayEvents.length === 0 && (
                        <Text color="fg.subtle" fontSize="sm" textAlign="center">
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
                      onComplete={() => completeTask(event.id)}
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
                      onClick={() => toggleHabit(habit.id)}
                      cursor="pointer"
                      borderRadius="md"
                      p="3"
                      bg={habit.completedToday ? 'green.subtle' : 'bg.subtle'}
                      transition="all 0.2s"
                      _hover={{ bg: habit.completedToday ? 'green.muted' : 'bg.muted' }}
                    >
                      <Checkbox checked={habit.completedToday} onChange={() => {}} />
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
                        {habit.currentStreak > 0 && (
                          <Badge variant="subtle" size="sm">
                            🔥 {habit.currentStreak} day streak
                          </Badge>
                        )}
                      </VStack>
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
          <Card.Body>
            <HStack gap="8" justifyContent="center">
              <VStack gap="1">
                <Text colorPalette="blue" color="colorPalette.fg" fontSize="2xl" fontWeight="bold">
                  {events?.filter((e) => e.type === 'task' && !e.completed).length || 0}
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Tasks Due
                </Text>
              </VStack>
              <VStack gap="1">
                <Text colorPalette="green" color="colorPalette.fg" fontSize="2xl" fontWeight="bold">
                  {habits?.filter((h) => h.completedToday).length || 0}/{habits?.length || 0}
                </Text>
                <Text color="fg.muted" fontSize="sm">
                  Habits Done
                </Text>
              </VStack>
              <VStack gap="1">
                <Text
                  colorPalette="purple"
                  color="colorPalette.fg"
                  fontSize="2xl"
                  fontWeight="bold"
                >
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
    </Container>
  );
}

// Event Item Component
function EventItem({
  event,
  onComplete,
  compact = false
}: {
  event: CalendarEvent;
  onComplete: () => void;
  compact?: boolean;
}) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'task':
        return '📝';
      case 'reminder':
        return '⏰';
      case 'habit':
        return '✅';
      default:
        return '📅';
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
          onChange={onComplete}
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
