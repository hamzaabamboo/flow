import { format } from 'date-fns';
import { VStack, HStack } from 'styled-system/jsx';
import * as Card from '../ui/styled/card';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
import { TaskItem } from './TaskItem';
import type { CalendarEvent } from '../../shared/types/calendar';
import type { ReactNode } from 'react';

interface UpcomingTasksCardProps {
  tasks: CalendarEvent[];
  onToggleComplete: (task: CalendarEvent) => void;
  onTaskClick: (task: CalendarEvent) => void;
  onDuplicate?: (task: CalendarEvent) => void;
  onDelete?: (task: CalendarEvent) => void;
  onMove?: (task: CalendarEvent) => void;
  onCreateCopy?: (event: CalendarEvent) => void;
  extraActions?: Array<{
    value: string;
    label: string;
    icon: ReactNode;
    onClick: (task: CalendarEvent) => void;
  }>;
}

export function UpcomingTasksCard({
  tasks,
  onToggleComplete,
  onTaskClick,
  onDuplicate,
  onDelete,
  onMove,
  onCreateCopy,
  extraActions
}: UpcomingTasksCardProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card.Root>
      <Card.Header p="4">
        <HStack justifyContent="space-between" alignItems="center">
          <VStack gap="0" alignItems="start">
            <Card.Title fontSize="lg">Upcoming & Unscheduled</Card.Title>
            <Text color="fg.muted" fontSize="sm">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </Text>
          </VStack>
        </HStack>
      </Card.Header>
      <Card.Body p="4" pt="0" overflow="visible">
        <VStack gap="2" alignItems="stretch">
          {tasks.map((originalEvent) => {
            // Ensure completion state is false for upcoming view
            const event = {
              ...originalEvent,
              type: originalEvent.type || ('task' as const),
              completed: false, // Upcoming tasks are never completed in this view
              isUpcoming: true
            };

            return (
              <TaskItem
                key={`${event.id}-${event.instanceDate || event.dueDate}`}
                event={event}
                onToggleComplete={() => onToggleComplete(event)}
                onTaskClick={() => onTaskClick(event)}
                onDuplicate={onDuplicate ? () => onDuplicate(event) : undefined}
                onDelete={onDelete ? () => onDelete(event) : undefined}
                onMove={onMove ? () => onMove(event) : undefined}
                onCreateCopy={onCreateCopy ? () => onCreateCopy(event) : undefined}
                hideCheckboxOnOverdue={false}
                extraActions={extraActions}
                extraBadges={
                  <>
                    <Badge size="sm" variant="solid" colorPalette="gray">
                      {event.dueDate ? format(new Date(event.dueDate), 'MMM d') : 'No date'}
                    </Badge>
                    {event.boardName && event.columnName && (
                      <>
                        <Badge size="sm" variant="outline">
                          {event.boardName}
                        </Badge>
                        <Badge size="sm" variant="subtle">
                          {event.columnName}
                        </Badge>
                      </>
                    )}
                  </>
                }
              />
            );
          })}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
