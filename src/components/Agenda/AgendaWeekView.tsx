import * as React from 'react';
import {
  format,
  isSameDay,
  addDays,
  startOfWeek,
  setHours,
  setMinutes,
  setSeconds
} from 'date-fns';
import { ExternalLink, GripVertical } from 'lucide-react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragOverlay } from '@dnd-kit/core';
import { VStack, HStack, Grid, Box } from 'styled-system/jsx';
import { css } from 'styled-system/css';
import { Text } from '../ui/text';
import { Checkbox } from '../ui/checkbox';
import type { CalendarEvent, Habit } from '../../shared/types/calendar';
import { isTaskCompleted } from '../../shared/utils/taskCompletion';

interface AgendaWeekViewProps {
  selectedDate: Date;
  viewMode: 'day' | 'week';
  groupedEvents: Record<string, CalendarEvent[]>;
  habits: Habit[] | undefined;
  onToggleHabit: (params: { habitId: string; date: Date; completed: boolean }) => void;
  onTaskClick: (event: CalendarEvent) => void;
  onToggleTask: (event: CalendarEvent) => void;
  onTaskDrop?: (taskId: string, newDate: Date) => void;
  onCreateCopy?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

// Draggable Task Component
function DraggableTask({
  event,
  dateKey,
  onTaskClick,
  onToggleTask,
  onCreateCopy
}: {
  event: CalendarEvent;
  dateKey: string;
  onTaskClick: (event: CalendarEvent) => void;
  onToggleTask: (event: CalendarEvent) => void;
  onCreateCopy?: (event: CalendarEvent) => void;
}) {
  const isExternal = event.type === 'external';

  // Only enable drag for non-external events
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.id}-${dateKey}`,
    data: { event, originalDate: dateKey },
    disabled: isExternal
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1
      }
    : {};

  return (
    <Box
      key={`${event.id}-${event.instanceDate}`}
      ref={!isExternal ? setNodeRef : undefined}
      data-priority={event.priority || 'none'}
      data-calendar-color={isExternal ? event.externalCalendarColor : undefined}
      style={style}
      borderLeftWidth="3px"
      borderLeftColor="colorPalette.default"
      borderRadius="sm"
      p="1"
      bg={'bg.muted'}
      transition="all 0.2s"
      _hover={isExternal ? {} : { bg: 'bg.subtle' }}
    >
      <HStack gap="1" justifyContent="space-between" alignItems="center">
        {/* Drag Handle - only for HamFlow tasks */}
        {!isExternal && (
          <Box
            {...attributes}
            {...listeners}
            cursor="grab"
            _active={{ cursor: 'grabbing' }}
            color="fg.muted"
            _hover={{ color: 'fg.default' }}
            transition="color 0.2s"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </Box>
        )}

        {isExternal ? (
          <Text fontSize="xs" fontWeight="medium" lineHeight="1.2" flex="1" minW="0">
            {event.title}
          </Text>
        ) : (
          <Checkbox
            checked={isTaskCompleted(event)}
            size="sm"
            onCheckedChange={() => onToggleTask(event)}
            flex="1"
            minW="0"
          >
            <Text
              textDecoration={isTaskCompleted(event) ? 'line-through' : 'none'}
              fontSize="xs"
              fontWeight="medium"
              lineHeight="1.2"
              cursor="pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onTaskClick(event);
              }}
            >
              {event.title}
            </Text>
          </Checkbox>
        )}
      </HStack>
    </Box>
  );
}

// Droppable Day Column Component
function DroppableDay({
  date,
  dateKey,
  isToday,
  isPast,
  dayHabits,
  dayEvents,
  onToggleHabit,
  onTaskClick,
  onToggleTask,
  onCreateCopy,
  onDateClick
}: {
  date: Date;
  dateKey: string;
  isToday: boolean;
  isPast: boolean;
  dayHabits: Habit[];
  dayEvents: CalendarEvent[];
  onToggleHabit: (params: { habitId: string; date: Date; completed: boolean }) => void;
  onTaskClick: (event: CalendarEvent) => void;
  onToggleTask: (event: CalendarEvent) => void;
  onCreateCopy?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
    data: { date, dateKey }
  });

  return (
    <Box
      ref={setNodeRef}
      className={css({
        borderColor: 'border.default',
        bg: 'bg.default',
        opacity: 1,
        transition: 'all 0.2s',
        '&[data-is-today=true]': {
          borderColor: 'colorPalette.default',
          bg: 'colorPalette.subtle'
        },
        '&[data-is-past=true]': {
          opacity: 0.7
        },
        '&[data-is-over=true]': {
          borderColor: 'colorPalette.default',
          borderWidth: '2px'
        }
      })}
      key={date.toISOString()}
      data-is-today={isToday}
      data-is-past={isPast}
      data-is-over={isOver}
      borderRadius="lg"
      borderWidth="1px"
      overflow="hidden"
    >
      {/* Day Header */}
      <Box
        className={css({
          bg: 'bg.subtle',
          '&[data-is-today=true]': {
            bg: 'colorPalette.subtle'
          }
        })}
        data-is-today={isToday}
        borderBottomWidth="1px"
        borderBottomColor="border.default"
        py="1"
        px="1"
        cursor={onDateClick ? 'pointer' : 'default'}
        onClick={onDateClick ? () => onDateClick(date) : undefined}
        transition="all 0.2s"
        _hover={onDateClick ? { bg: isToday ? 'colorPalette.muted' : 'bg.muted' } : {}}
      >
        <VStack gap="0" alignItems="center">
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
            fontSize="lg"
            fontWeight="bold"
          >
            {format(date, 'd')}
          </Text>
        </VStack>
      </Box>

      {/* Day Content */}
      <Box minH="xs" maxH="2xl" p="1" overflowY="auto">
        <VStack gap="1" alignItems="stretch">
          {/* Combined Habits and Tasks - Sorted by Time */}
          {(() => {
            // Combine habits and tasks with a type indicator
            const combined = [
              ...dayHabits.map((h) => ({
                type: 'habit' as const,
                item: h,
                time: h.reminderTime
              })),
              ...dayEvents.map((e) => ({
                type: 'task' as const,
                item: e,
                time: e.dueDate
              }))
            ];

            // Sort by time
            combined.sort((a, b) => {
              if (a.time && b.time) {
                let aTime: number;
                let bTime: number;

                // For habits, reminderTime is "HH:mm" format - convert to minutes since midnight
                if (a.type === 'habit') {
                  const [hours, minutes] = a.time.split(':').map(Number);
                  aTime = hours * 60 + minutes;
                } else {
                  // For tasks, dueDate is ISO string - extract time
                  const taskDate = new Date(a.time);
                  aTime = taskDate.getHours() * 60 + taskDate.getMinutes();
                }

                if (b.type === 'habit') {
                  const [hours, minutes] = b.time.split(':').map(Number);
                  bTime = hours * 60 + minutes;
                } else {
                  const taskDate = new Date(b.time);
                  bTime = taskDate.getHours() * 60 + taskDate.getMinutes();
                }

                return aTime - bTime;
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
                    className={css({
                      bg: 'bg.muted',
                      '&[data-completed=true]': {
                        bg: 'green.subtle'
                      }
                    })}
                    key={`habit-${habit.id}-${dateKey}`}
                    onClick={() =>
                      onToggleHabit({
                        habitId: habit.id,
                        date,
                        completed: !habit.completedToday
                      })
                    }
                    data-completed={habit.completedToday}
                    cursor="pointer"
                    borderLeftWidth="3px"
                    borderLeftColor="colorPalette.default"
                    borderRadius="sm"
                    p="1"
                    transition="all 0.2s"
                    _hover={{ bg: 'bg.subtle' }}
                  >
                    <HStack gap="1" justifyContent="space-between" alignItems="center">
                      <Checkbox checked={habit.completedToday} size="sm" readOnly flex="1" minW="0">
                        <Text
                          textDecoration={habit.completedToday ? 'line-through' : 'none'}
                          fontSize="xs"
                          fontWeight="medium"
                          lineHeight="1.2"
                        >
                          {habit.name}
                        </Text>
                      </Checkbox>
                      <HStack gap="1" alignItems="center">
                        {habit.link && (
                          <a
                            href={habit.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center' }}
                          >
                            <ExternalLink width="12" height="12" />
                          </a>
                        )}
                        {(habit.currentStreak ?? 0) > 0 && (
                          <Text fontSize="xs" fontWeight="bold">
                            🔥{habit.currentStreak}
                          </Text>
                        )}
                      </HStack>
                    </HStack>
                  </Box>
                );
              } else {
                const event = item.item;
                return (
                  <DraggableTask
                    key={`${event.id}-${event.instanceDate}`}
                    event={event}
                    dateKey={dateKey}
                    onTaskClick={onTaskClick}
                    onToggleTask={onToggleTask}
                    onCreateCopy={onCreateCopy}
                  />
                );
              }
            });
          })()}
        </VStack>
      </Box>
    </Box>
  );
}

export function AgendaWeekView({
  selectedDate,
  viewMode,
  groupedEvents,
  habits,
  onToggleHabit,
  onTaskClick,
  onToggleTask,
  onTaskDrop,
  onCreateCopy,
  onDateClick
}: AgendaWeekViewProps) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i));
  const [activeTask, setActiveTask] = React.useState<CalendarEvent | null>(null);

  const handleDragStart = (event: DragEndEvent) => {
    const dragData = event.active.data.current;
    if (dragData?.event) {
      setActiveTask(dragData.event as CalendarEvent);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTask(null);

    if (!over || !onTaskDrop) return;

    // Extract task info from dragged item
    const dragData = active.data.current;
    if (!dragData?.event) return;

    const task = dragData.event as CalendarEvent;
    const targetDateKey = over.id as string;

    // If dropped on same date, do nothing
    if (dragData.originalDate === targetDateKey) return;

    // Parse target date and preserve time from original due date
    const originalDate = task.dueDate ? new Date(task.dueDate) : new Date();
    const targetDate = new Date(targetDateKey);

    // Set the new date while preserving the original time
    const newDueDate = setSeconds(
      setMinutes(setHours(targetDate, originalDate.getHours()), originalDate.getMinutes()),
      originalDate.getSeconds()
    );

    onTaskDrop(task.id, newDueDate);
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <VStack gap="2" alignItems="stretch" w="full" h="full" overflow="hidden">
        <Box w="full" h="full" overflowY="auto" overflowX="auto">
          <Grid gap="1" gridTemplateColumns="repeat(7, minmax(140px, 1fr))" w="full" height="100%">
            {weekDates.map((date) => {
              const isToday = isSameDay(date, new Date());
              const dateKey = format(date, 'yyyy-MM-dd');
              const dayEvents = groupedEvents[dateKey] || [];
              const isPast = date < new Date() && !isSameDay(date, new Date());

              const dayHabits =
                habits?.filter((habit) => {
                  // In week view, habits from API already have checkDate for filtering
                  if (viewMode === 'week') {
                    return habit.checkDate === dateKey;
                  }
                  // In day view, use frequency logic
                  if (habit.frequency === 'daily') return true;
                  if (habit.frequency === 'weekly' && habit.targetDays) {
                    return habit.targetDays.includes(date.getDay());
                  }
                  return false;
                }) || [];

              return (
                <DroppableDay
                  key={date.toISOString()}
                  date={date}
                  dateKey={dateKey}
                  isToday={isToday}
                  isPast={isPast}
                  dayHabits={dayHabits}
                  dayEvents={dayEvents}
                  onToggleHabit={onToggleHabit}
                  onTaskClick={onTaskClick}
                  onToggleTask={onToggleTask}
                  onCreateCopy={onCreateCopy}
                  onDateClick={onDateClick}
                />
              );
            })}
          </Grid>
        </Box>
      </VStack>
      <DragOverlay>
        {activeTask ? (
          <Box
            borderLeftWidth="3px"
            borderLeftColor="colorPalette.default"
            borderRadius="sm"
            p="1.5"
            bg="bg.muted"
            boxShadow="lg"
            opacity={0.9}
          >
            <HStack gap="1.5" justifyContent="space-between" alignItems="center">
              <Checkbox checked={isTaskCompleted(activeTask)} size="sm" readOnly flex="1">
                <VStack gap="0" alignItems="start">
                  <Text
                    textDecoration={isTaskCompleted(activeTask) ? 'line-through' : 'none'}
                    fontSize="xs"
                    fontWeight="medium"
                    lineHeight="1.2"
                  >
                    {activeTask.title}
                  </Text>
                  {activeTask.dueDate && (
                    <Text color="fg.muted" fontSize="2xs" lineHeight="1">
                      {format(new Date(activeTask.dueDate), 'h:mm a')}
                    </Text>
                  )}
                </VStack>
              </Checkbox>
            </HStack>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
