import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Text } from '../ui/text';
import type { CalendarEvent } from '../../shared/types/calendar';
import { Box, HStack, VStack } from 'styled-system/jsx';

const priorityColorPalette = {
  urgent: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue'
};

export function TaskItem({
  event,
  onToggleComplete,
  onTaskClick
}: {
  event: CalendarEvent;
  onToggleComplete: () => void;
  onTaskClick: () => void;
}) {
  const priority = event.priority || 'low';
  const colorPalette =
    priorityColorPalette[priority as keyof typeof priorityColorPalette] || 'blue';

  return (
    <Box
      onClick={onTaskClick}
      colorPalette={colorPalette}
      cursor="pointer"
      borderLeftWidth="3px"
      borderLeftColor="color-palette.default"
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
          onCheckedChange={onToggleComplete}
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
  );
}
