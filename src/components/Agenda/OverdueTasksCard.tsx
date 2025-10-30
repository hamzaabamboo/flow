import { useState } from 'react';
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { VStack, HStack } from 'styled-system/jsx';
import * as Card from '../ui/styled/card';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';
import { CarryOverControls } from './CarryOverControls';
import { TaskItem } from './TaskItem';
import type { CalendarEvent } from '../../shared/types/calendar';

interface OverdueTasksCardProps {
  overdueTasks: CalendarEvent[];
  onCarryOver: (taskIds: string[], targetDate: Date) => void;
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
  isCarryingOver?: boolean;
}

export function OverdueTasksCard({
  overdueTasks,
  onCarryOver,
  onToggleComplete,
  onTaskClick,
  onDuplicate,
  onDelete,
  onMove,
  onCreateCopy,
  extraActions,
  isCarryingOver
}: OverdueTasksCardProps) {
  const [showCarryOverAll, setShowCarryOverAll] = useState(false);

  if (overdueTasks.length === 0) {
    return null;
  }

  return (
    <Card.Root borderColor="red.default" borderWidth="2px" overflow="visible">
      <Card.Header p="4">
        <VStack gap="3" alignItems="stretch">
          <HStack justifyContent="space-between">
            <VStack gap="0" alignItems="start">
              <Card.Title color="red.default" fontSize="lg">
                Overdue Tasks
              </Card.Title>
              <Text color="fg.muted" fontSize="sm">
                {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} overdue
              </Text>
            </VStack>
          </HStack>

          {/* Carry Over All Button */}
          <Button
            size="sm"
            variant="solid"
            onClick={() => setShowCarryOverAll(true)}
            colorPalette="red"
          >
            <ArrowRight width="16" height="16" />
            Carry Over All
          </Button>
        </VStack>
      </Card.Header>
      <Card.Body p="4" pt="0" overflow="visible">
        <VStack gap="2" alignItems="stretch">
          {overdueTasks
            .toSorted((a, b) => {
              if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
              }
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return 0;
            })
            .map((event) => (
              <TaskItem
                key={`${event.id}-${event.instanceDate}`}
                event={event}
                onToggleComplete={() => onToggleComplete(event)}
                onTaskClick={() => onTaskClick(event)}
                onDuplicate={onDuplicate ? () => onDuplicate(event) : undefined}
                onDelete={onDelete ? () => onDelete(event) : undefined}
                onMove={onMove ? () => onMove(event) : undefined}
                onCarryOver={(taskId, targetDate) => onCarryOver([taskId], targetDate)}
                onCreateCopy={onCreateCopy ? () => onCreateCopy(event) : undefined}
                hideCheckboxOnOverdue={true}
                extraActions={extraActions}
                extraBadges={
                  <>
                    <Badge size="sm" variant="solid" colorPalette="red">
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
            ))}
        </VStack>
      </Card.Body>

      {/* Carry Over All Dialog */}
      <CarryOverControls
        open={showCarryOverAll}
        onOpenChange={setShowCarryOverAll}
        onCarryOver={(targetDate) => {
          onCarryOver(
            overdueTasks.map((t) => t.id),
            targetDate
          );
        }}
        isCarryingOver={isCarryingOver}
        buttonText="Carry Over All"
        colorPalette="red"
      />
    </Card.Root>
  );
}
