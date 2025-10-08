import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { VStack } from 'styled-system/jsx';
import * as Card from '../ui/styled/card';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
import { TaskItem } from './TaskItem';
import type { CalendarEvent } from '../../shared/types/calendar';

interface AgendaDayViewProps {
  selectedDate: Date;
  events: CalendarEvent[];
  onToggleComplete: (event: CalendarEvent) => void;
  onTaskClick: (event: CalendarEvent) => void;
  onDuplicate?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
  onMove?: (event: CalendarEvent) => void;
  onCarryOver?: (taskId: string, targetDate: Date) => void;
  extraActions?: Array<{
    value: string;
    label: string;
    icon: ReactNode;
    onClick: (task: CalendarEvent) => void;
  }>;
}

export function AgendaDayView({
  selectedDate,
  events,
  onToggleComplete,
  onTaskClick,
  onDuplicate,
  onDelete,
  onMove,
  onCarryOver,
  extraActions
}: AgendaDayViewProps) {
  const sortedEvents = events.toSorted((a, b) => {
    // Sort by dueDate time (earliest first)
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    // Tasks without due times go to bottom
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return 0;
  });

  return (
    <Card.Root minH="lg">
      <Card.Body p="4">
        <VStack gap="2" alignItems="stretch">
          <Text mb="2" fontSize="lg" fontWeight="semibold">
            Tasks for {format(selectedDate, 'MMM d')}
          </Text>
          {sortedEvents.map((event) => (
            <TaskItem
              key={`${event.id}-${event.instanceDate}`}
              event={event}
              onToggleComplete={() => onToggleComplete(event)}
              onTaskClick={() => onTaskClick(event)}
              onDuplicate={onDuplicate ? () => onDuplicate(event) : undefined}
              onDelete={onDelete ? () => onDelete(event) : undefined}
              onMove={onMove ? () => onMove(event) : undefined}
              onCarryOver={onCarryOver}
              hideCheckboxOnOverdue={true}
              extraActions={extraActions}
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
            />
          ))}
          {events.length === 0 && (
            <Text py="8" color="fg.subtle" textAlign="center">
              No tasks scheduled
            </Text>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
