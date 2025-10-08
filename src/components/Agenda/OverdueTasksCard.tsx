import { useState } from 'react';
import type { ReactNode } from 'react';
import { format, addDays, addWeeks, endOfDay, startOfDay, endOfMonth } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { VStack, HStack, Box } from 'styled-system/jsx';
import * as Card from '../ui/styled/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Text } from '../ui/text';
import { Select, createListCollection } from '../ui/select';
import { SimpleDatePicker } from '../ui/simple-date-picker';
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
  extraActions,
  isCarryingOver
}: OverdueTasksCardProps) {
  const [carryOverTarget, setCarryOverTarget] = useState<
    'end_of_today' | 'tomorrow' | 'next_week' | 'end_of_month' | 'custom'
  >('end_of_today');
  const [customCarryOverDate, setCustomCarryOverDate] = useState<Date>(new Date());

  const carryOverOptions = createListCollection({
    items: [
      { label: 'End of Today', value: 'end_of_today' },
      { label: 'Tomorrow', value: 'tomorrow' },
      { label: 'Next Week', value: 'next_week' },
      { label: 'End of Month', value: 'end_of_month' },
      { label: 'Custom Date', value: 'custom' }
    ]
  });

  const getTargetDate = (): Date => {
    switch (carryOverTarget) {
      case 'end_of_today':
        return endOfDay(new Date());
      case 'tomorrow':
        return startOfDay(addDays(new Date(), 1));
      case 'next_week':
        return startOfDay(addWeeks(new Date(), 1));
      case 'end_of_month':
        return endOfMonth(new Date());
      case 'custom':
        return customCarryOverDate;
    }
  };

  const handleCarryOverAll = () => {
    onCarryOver(
      overdueTasks.map((t) => t.id),
      getTargetDate()
    );
  };

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

          {/* Carry Over Controls */}
          <VStack gap="2" alignItems="stretch">
            <HStack gap="2" flexWrap={{ base: 'wrap', md: 'nowrap' }}>
              <Box flex="1" minW={{ base: 'full', md: '200px' }}>
                <Select.Root
                  collection={carryOverOptions}
                  value={[carryOverTarget]}
                  onValueChange={(details) => {
                    setCarryOverTarget(details.value[0] as typeof carryOverTarget);
                  }}
                  size="sm"
                >
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select target date" />
                  </Select.Trigger>
                  <Select.Positioner>
                    <Select.Content maxW="300px">
                      {carryOverOptions.items.map((item) => (
                        <Select.Item key={item.value} item={item}>
                          <Select.ItemText>{item.label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              </Box>

              {carryOverTarget === 'custom' && (
                <Box flex="1" minW={{ base: 'full', md: '200px' }}>
                  <SimpleDatePicker
                    value={format(customCarryOverDate, 'yyyy-MM-dd')}
                    onChange={(dateStr) => {
                      if (dateStr) {
                        const [year, month, day] = dateStr.split('-').map(Number);
                        setCustomCarryOverDate(new Date(year, month - 1, day));
                      }
                    }}
                    size="sm"
                  />
                </Box>
              )}

              <Button
                size="sm"
                variant="solid"
                onClick={handleCarryOverAll}
                disabled={isCarryingOver}
                colorPalette="red"
                minW={{ base: 'full', md: 'auto' }}
              >
                <ArrowRight width="16" height="16" />
                Carry Over All
              </Button>
            </HStack>

            <Text color="fg.muted" fontSize="xs">
              Moving to:{' '}
              {carryOverTarget === 'custom'
                ? format(customCarryOverDate, 'MMM d, yyyy')
                : carryOverOptions.items.find((i) => i.value === carryOverTarget)?.label}
            </Text>
          </VStack>
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
    </Card.Root>
  );
}
