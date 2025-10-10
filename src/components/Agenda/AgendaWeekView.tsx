import { format, isSameDay, addDays, startOfWeek } from 'date-fns';
import { ExternalLink } from 'lucide-react';
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
}

export function AgendaWeekView({
  selectedDate,
  viewMode,
  groupedEvents,
  habits,
  onToggleHabit,
  onTaskClick,
  onToggleTask
}: AgendaWeekViewProps) {
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i));

  return (
    <VStack gap="3" alignItems="stretch" w="full" h="full" overflow="hidden">
      <Box w="full" h="full" overflowY="auto">
        <Grid gap="2" gridTemplateColumns="repeat(7, 1fr)" w="full">
          {weekDates.map((date) => {
            const isToday = isSameDay(date, new Date());
            const dateKey = format(date, 'yyyy-MM-dd');
            const dayEvents = groupedEvents[dateKey] || [];
            const isPast = date < new Date() && !isSameDay(date, new Date());

            return (
              <Box
                className={css({
                  borderColor: 'border.default',
                  bg: 'bg.default',
                  opacity: 1,
                  '&[data-is-today=true]': {
                    borderColor: 'colorPalette.default',
                    bg: 'colorPalette.subtle'
                  },
                  '&[data-is-past=true]': {
                    opacity: 0.7
                  }
                })}
                key={date.toISOString()}
                data-is-today={isToday}
                data-is-past={isPast}
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
                  p="2"
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
                              p="1.5"
                              transition="all 0.2s"
                              _hover={{ bg: 'bg.subtle' }}
                            >
                              <HStack gap="1.5" justifyContent="space-between" alignItems="center">
                                <Checkbox
                                  checked={habit.completedToday}
                                  size="sm"
                                  readOnly
                                  flex="1"
                                >
                                  <VStack gap="0.5" alignItems="start">
                                    <Text
                                      textDecoration={
                                        habit.completedToday ? 'line-through' : 'none'
                                      }
                                      fontSize="xs"
                                      fontWeight="medium"
                                      lineHeight="1.2"
                                    >
                                      {habit.name}
                                    </Text>
                                    {habit.reminderTime && (
                                      <Text color="fg.muted" fontSize="2xs" lineHeight="1">
                                        {format(
                                          new Date(`2000-01-01T${habit.reminderTime}`),
                                          'h:mm a'
                                        )}
                                      </Text>
                                    )}
                                  </VStack>
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
                            <Box
                              key={`${event.id}-${event.instanceDate}`}
                              onClick={() => onTaskClick(event)}
                              data-priority={event.priority || 'none'}
                              cursor="pointer"
                              borderLeftWidth="3px"
                              borderLeftColor="colorPalette.default"
                              borderRadius="sm"
                              p="1.5"
                              bg="bg.muted"
                              transition="all 0.2s"
                              _hover={{
                                bg: 'bg.subtle',
                                borderLeftColor: 'colorPalette.emphasized'
                              }}
                            >
                              <HStack gap="1.5" alignItems="start">
                                <Checkbox
                                  size="sm"
                                  checked={isTaskCompleted(event)}
                                  onCheckedChange={() => onToggleTask(event)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <VStack flex="1" gap="0.5" alignItems="start">
                                  <Text
                                    color={isTaskCompleted(event) ? 'fg.subtle' : 'fg.default'}
                                    textDecoration={
                                      isTaskCompleted(event) ? 'line-through' : 'none'
                                    }
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
      </Box>
    </VStack>
  );
}
