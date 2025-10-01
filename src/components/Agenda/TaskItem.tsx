import { format } from 'date-fns';
import { ExternalLink, Edit2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Text } from '../ui/text';
import { IconButton } from '../ui/icon-button';
import { PriorityBadge } from '../ui/priority-badge';
import { LinkifiedText } from '../ui/linkified-text';
import type { CalendarEvent } from '../../shared/types/calendar';
import { Box, HStack, VStack } from 'styled-system/jsx';
import { getPriorityColor } from '../../utils/priority';
import type { ReactNode } from 'react';

export function TaskItem({
  event,
  onToggleComplete,
  onTaskClick,
  extraBadges,
  actions
}: {
  event: CalendarEvent;
  onToggleComplete: () => void;
  onTaskClick: () => void;
  extraBadges?: ReactNode;
  actions?: ReactNode;
}) {
  const colorPalette = getPriorityColor(event.priority);

  return (
    <Box
      onClick={onToggleComplete}
      colorPalette={colorPalette}
      cursor="pointer"
      borderWidth="1px"
      borderColor="border.default"
      borderLeftWidth="4px"
      borderLeftColor="colorPalette.default"
      borderRadius="md"
      p="3"
      w="full"
      bg="bg.default"
      transition="all 0.2s"
      _hover={{ bg: 'bg.subtle', boxShadow: 'sm' }}
    >
      <HStack gap="2" alignItems="center" justify="space-between">
        <HStack gap="2" alignItems="center" flex="1">
          <Checkbox
            size="sm"
            checked={event.completed}
            onCheckedChange={onToggleComplete}
            onClick={(e) => e.stopPropagation()}
          />
          <VStack flex="1" gap="1" alignItems="start">
            <HStack gap="2" alignItems="center" flexWrap="wrap">
              <LinkifiedText
                color={event.completed ? 'fg.subtle' : 'fg.default'}
                textDecoration={event.completed ? 'line-through' : 'none'}
                fontSize="sm"
                fontWeight="medium"
                lineClamp="2"
              >
                {event.title}
              </LinkifiedText>
              {event.link && (
                <IconButton
                  asChild
                  variant="ghost"
                  size="xs"
                  colorPalette="gray"
                  aria-label="Open link"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a href={event.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink width="14" height="14" />
                  </a>
                </IconButton>
              )}
              {event.priority && <PriorityBadge priority={event.priority} size="sm" />}
              {extraBadges}
            </HStack>
            {event.dueDate && (
              <Text color="fg.muted" fontSize="xs">
                {format(new Date(event.dueDate), 'h:mm a')}
              </Text>
            )}
            <HStack gap="2" flexWrap="wrap">
              {event.labels && event.labels.length > 0 && (
                <>
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
                </>
              )}
            </HStack>
          </VStack>
        </HStack>
        <HStack gap="1" flexShrink={0}>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Edit task"
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick();
            }}
          >
            <Edit2 width="16" height="16" />
          </IconButton>
          {actions && (
            <Box onClick={(e) => e.stopPropagation()}>
              {actions}
            </Box>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}
